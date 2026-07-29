# Bug Report — Buffer runs out of "easy" questions mid-game

**Date:** 2026-07-25
**Reporter:** Martin Martinov
**Component:** Backend question selection (real BE, staging/live) + confirmation of FE behavior
**Severity:** High — degrades gameplay/difficulty curve; admin counts misrepresent availability

---

## Symptom

With a game duration timer of **90 s** and answering rapidly (~1 s/question), around the
**15th–20th question** the buffer starts returning **only `medium` and `hard`** questions —
never `easy` again.

The admin panel reports **35 easy, 39 medium, 50 hard** standard questions, so it looks like
there should be plenty of easy questions left.

Observed in the network log (`GET .../questions/next`): early buffers lead with an `easy`
question (e.g. id 6, id 15), later buffers lead with `medium` (e.g. id 21) and never fall
back to `easy`.

---

## Root cause

**An `event_id` scoping mismatch between the admin bank and the game.** The admin panel counts
questions *globally*; the game can only serve the subset whose `event_id` matches the live
event. `easy` is simply the tier that exhausts first.

### Evidence

1. **The game filters strictly by the live event's id** — every selection query in
   `SessionStarter` (`firstQuestion`, `bufferFor` slot 0 and slot 1, `selectStandardIds`):
   ```php
   // app/Services/Game/SessionStarter.php:119, 148, 213
   ->where('event_id', $eventId)   // $eventId = Event::where('status','live')->first()->id
   ```

2. **Admin-created questions get `event_id = NULL`.** Neither creation path sets it:
   - Single create — `app/Http/Controllers/Admin/QuestionController.php:63-73` (no `event_id`).
   - CSV import — `app/Http/Controllers/Admin/QuestionCsvController.php:93-98` (no `event_id`).
   - No global scope / boot hook backfills it. Model even documents the intent:
     *"Questions are NOT event-scoped: event_id stays nullable"* (`app/Models/Question.php:13`).

3. **The admin count is global — no event filter:**
   ```php
   // app/Http/Controllers/Admin/QuestionController.php:43
   'total' => Question::count(),   // counts every row, incl. event_id = NULL
   ```

4. **Only the seeded questions carry the event id** — `DemoSeeder` creates the bank with
   `['event_id' => $event->id]` (`database/seeders/DemoSeeder.php:180-181`), **15 per difficulty**
   (`DemoSeeder.php:26`).

### Why question 15–20, and why only `easy`

Effective pools for the live event:

| Tier   | Admin shows (global) | Game-visible (event-scoped) |
|--------|----------------------|------------------------------|
| easy   | 35                   | ~15 (seeded)                 |
| medium | 39                   | ~15 (seeded)                 |
| hard   | 50                   | ~30 (15 hard + 15 hard_plus, if hard_plus disabled) |

- `bufferFor` **always fills slot 0 with the easiest available question**, so an `easy`
  question is pulled into every buffer and answered on every wrong/low-streak turn.
- At ~1 s/question, the ~15 real `easy` questions are exhausted (moved into
  `answered_ids` + `in_flight_ids`) in roughly **15–20 turns**.
- Slot 0's fallback loop then steps up the chain (`easy → medium → hard`), so from that point
  the buffer contains only `medium`/`hard`.
- `hard` lasts longest because, with `hard_plus` disabled, `queryDifficulties('hard')` also
  pulls the seeded `hard_plus` rows (~30 effective).

This matches the reported numbers: 35 shown, but the game runs dry at ~15 — the "missing" ~20
easy questions are the NULL-`event_id` admin/CSV questions the game cannot see.

---

## Frontend assessment — not the cause

The FE consumes whatever the buffer contains. Its one related behavior — `pickFromBuffer`
falling back to `buffer[0]` when the requested tier is absent
(`src/app/core/stores/game/game.updaters.ts:43`) — is a *symptom*: after `easy` is exhausted,
a post-wrong-answer "easy" request returns the `medium` `buffer[0]`. This is correct handling,
not the origin of the bug.

Minor, unrelated observation (not the cause): `bufferFor` does a non-atomic read-modify-write
of `in_flight_ids` (`SessionStarter.php:109` read, `:166` write). Under rapid overlapping
`GET /questions/next` calls this can race, but it does not drain the `easy` pool.

---

## How to confirm on staging

```sql
SELECT difficulty,
       COUNT(*) FILTER (WHERE event_id = '<live-event-id>') AS in_event,
       COUNT(*) AS global
FROM questions
WHERE type = 'standard' AND status = 'active' AND deleted_at IS NULL
GROUP BY difficulty;
```

Expected: `in_event` ≈ 15 for `easy` while `global` = 35.

---

## Fix options (pick one design direction)

1. **Assign `event_id` on admin create + CSV import** — make admin questions belong to the
   event. Correct if questions are genuinely per-event.
2. **Make the game event-agnostic** — drop the `->where('event_id', …)` filters in
   `SessionStarter` and match the admin's global counting. Matches the model's stated
   "NOT event-scoped" design; smallest change.
3. **At minimum, make the admin count match the game** — filter the admin stats by the live
   event's id so the numbers stop overstating availability.

> Options 1 and 2 are contradictory design choices: decide whether questions are scoped
> per-event or form a single global bank, then align both the admin and the game to it.

### Recommended hardening (regardless of option)

- Add a guard/log in `bufferFor` when a difficulty tier is genuinely exhausted, so silent
  fallback up the chain is observable.
- Add a test: seed N easy questions for an event, play > N turns, assert the buffer keeps
  offering `easy` (option 1/2) or fails loudly/observably.

---

## Affected files

- `E:/Projects/pm-trivia-BE/app/Services/Game/SessionStarter.php`
- `E:/Projects/pm-trivia-BE/app/Http/Controllers/Admin/QuestionController.php`
- `E:/Projects/pm-trivia-BE/app/Http/Controllers/Admin/QuestionCsvController.php`
- `E:/Projects/pm-trivia-BE/app/Models/Question.php`
- `E:/Projects/pm-trivia-BE/database/seeders/DemoSeeder.php`
- `E:/Projects/trivia/trivia-app/src/app/core/stores/game/game.updaters.ts` (symptom only)

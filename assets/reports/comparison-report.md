# PM Trivia — Design / Spec / Demo Comparison Report

> Scope: public mobile game flow + leaderboard + booth display only.
> Admin panel excluded.
> Sources: Figma (Page 1 mobile screens), SPECIFICATION.md, Angular demo (`trivia-app/src`).

---

## Severity legend

| Label | Meaning |
|---|---|
| **BLOCKER** | Feature is in spec/design and will not work at all in the current demo |
| **GAP** | Feature is partially there but functionally incomplete |
| **MISMATCH** | Demo and spec/design disagree on a specific value or behaviour |
| **DEBT** | Works for the demo but will break under real conditions |

---

## 1. Sponsor Question — BLOCKER

### What spec/design says
Sponsor questions appear during or alongside the main trivia session. The question carries sponsor branding, optional media (image or video), and a bonus score. The game must navigate to the sponsored question at a configurable point in the session and return to the normal flow after answering.

### What the demo does
- `GameStore.sponsorQuestion` is populated from `StartSessionResponse` ✓
- A `/sponsor` route exists ✓
- **But there is zero code that ever reads `sponsorQuestion` from the store or navigates to `/sponsor`**
- `game.page.ts` has no sponsor injection logic — it advances linearly through `questions[]` and calls `endGame()` when those run out
- `sponsor.page.ts` ignores `GameStore` entirely; it uses hard-coded choices, a hard-coded score (1,250), and hard-coded navigation to `/results/1001`
- `setSponsorBonus` exists as a store method but is never called from any page

**Impact:** The sponsor question feature is completely inoperative end-to-end. Visiting `/sponsor` produces a standalone demo shell with no connection to the live session.

---

## 2. Difficulty-Based Scoring — BLOCKER

### What spec says (§5.1)
| Difficulty | Base Points |
|---|---|
| Easy | 100 |
| Medium | 150 |
| Hard | 200 |

Formula: `points = base_points × streak_multiplier`

### What the demo does
- `ScoringService.BASE_POINTS = 100` — single constant, all difficulties
- `mock.interceptor.ts` line 179: `const points = correct ? Math.round(100 * multiplier) : 0` — also hard-coded to 100
- `QuestionDto` has a `difficulty` field but scoring never reads it

**Impact:** Every question awards Easy-level points regardless of difficulty. A full hard game scores the same as a full easy game.

---

## 3. Timer Progress Bar Hard-Coded to 90 s — BLOCKER

### What spec says (§9.3)
Session time is admin-configurable.

### What the demo does
```ts
// game.page.ts
readonly timeLeft = signal(90);
readonly timeLeftPct = computed(() => (this.timeLeft() / 90) * 100);
```

The denominator `90` is a magic number. The `StartSessionResponse` already returns `endsAt` (which determines remaining seconds), but the initial total duration is never stored. If the backend returns a 120-second session, the bar would show 133% at start and would take 30 seconds to drop to 100%.

**Fix needed:** Store `sessionDurationSeconds` from `StartSessionResponse` (or derive it from `endsAt − startedAt`) and use that as the denominator.

---

## 4. Image Questions Not Modeled or Rendered — BLOCKER

### What spec/design says
The Figma design clearly shows an image question screen with a photo above the question text. The spec (§9.5) states questions have an optional image.

### What the demo does
- `QuestionDto` has no `imageUrl` or `mediaUrl` field
- `game.page.html` renders only `currentQuestion()!.prompt` — no image slot
- Mock data has no image URLs

**Impact:** Image questions can never be displayed. If the backend sends image questions, the frontend silently ignores them.

---

## 5. Booth Display Missing Core Spec Features — BLOCKER

### What spec says (§8.2)
The TV display must show:
- "Live Leaderboard" title
- Top 10 players
- Reset note ("Resets at midnight")
- **QR code** (scan to play)
- "Scan to play" instructions
- Today's played count
- **Average score**
- **Hot streak panel**
- **Sponsor cards**

### What the demo does
`booth-display.page.html` contains:
- Brand header ✓
- Top 10 rows in a 2-column grid ✓
- Player count ✓
- Text URL only — `practicalmachinist.com/trivia` (hard-coded, no QR code) ✗
- No reset note ✗
- No average score ✗
- No hot streak panel ✗
- No sponsor cards ✗

`BoothDisplayResponse` model also lacks `avgScore`, `hotStreak`, and `sponsorCards` fields — so the backend contract doesn't support the full design either.

---

## 6. Sponsor Question Flow — GAP

### What spec says (§4.1)
Admin defines whether sponsored questions appear before the bonus round, during the session, or after N standard questions. The question must integrate with the session score.

### What the demo does
There is no routing logic connecting the game page to the sponsor page. The spec requires this decision to be made dynamically (based on admin settings). The current state (`sponsorQuestion` in `GameStore`) is populated but ignored.

**What's missing:**
1. Logic to decide at which position in `questions[]` the sponsor question is injected (or whether it appears after all standard questions)
2. Navigation: `game.page.ts → /sponsor → game.page.ts` (continuing the session)
3. `sponsor.page.ts` must read from `GameStore`, not use hard-coded data
4. `setSponsorBonus` must be called after the sponsor question is answered

---

## 7. Phone Field — MISMATCH

### What spec says (§3.2)
Phone number is **Required**.

### What the demo does
```ts
phone: new FormControl(''),  // no Validators.required
```

The field is optional. The placeholder also shows `(555) 123-4567` but there is no validation pattern (e.g. `Validators.pattern`).

---

## 8. Results Screen: "ANSWERED" Shows Wrong Field — MISMATCH

### What the results page renders
```html
<div class="text-[26px] font-black text-ink">{{ result()!.correctAnswers }}</div>
<!-- label: "ANSWERED" -->
```

`correctAnswers` is the number of questions answered **correctly**. The label "ANSWERED" implies total questions attempted. `SessionResultDto` has a separate `totalAnswers` field for that.

The Figma results screen shows a stat that should represent total questions answered, not only the correct subset.

---

## 9. `hard_plus` Difficulty in Demo, Not in Spec — MISMATCH

`api.models.ts`:
```ts
export type Difficulty = 'easy' | 'medium' | 'hard' | 'hard_plus';
```

Mock question 5 uses `difficulty: 'hard_plus'`. The spec defines exactly three levels (Easy, Medium, Hard). `hard_plus` has no defined base point value in the spec and is not shown as a difficulty label in the design. Either it was removed from scope or it should be removed from the type.

---

## 10. No Pre-Game Countdown — GAP

### What spec says (§3.4)
"Optional countdown before start (e.g. 3 seconds)"

### What the demo does
`game.page.ts ngOnInit` calls `startSession()` and `startTimer()` immediately. The timer is already counting down before the first question renders. There is no 3-second "Get ready" screen.

---

## 11. Sponsor Page: Video Countdown Mislabeled — MISMATCH

`sponsor.page.ts`:
```ts
readonly countdown = signal(30);
// ...
const total = 3000; // 3 seconds real time
```

The countdown display shows "30" (seconds) but the actual timeout is 3,000 ms (3 seconds). The displayed number decrements from 30 to 0 in 3 seconds — i.e. it counts in 10× speed. The spec and design show the sponsor video as being 30 seconds long. The demo never plays a real 30-second video; it simulates it in 3 seconds with a mislabeled counter.

---

## 12. Leaderboard Scope Switching Breaks Polling — DEBT

`leaderboard.store.ts`:
- `startPolling` starts a 10-second `timer` observable using `store.activeScope()` at each tick ✓
- `setScope` calls `load(scope)` (a one-shot fetch), then updates `activeScope` in state

When a user switches from "Today" to "This Week", `setScope` fires a one-shot `load`, but the running `startPolling` observable was bound to the previous scope. On the next tick (up to 10s later) it will re-read `store.activeScope()` and pick up the new scope — so polling will eventually self-correct, but there is a window of up to 10 seconds where the newly selected tab shows stale data from the previous scope.

**Impact:** Minor UX delay after tab switch, not a hard blocker.

---

## 13. Question Count Progress Not Shown — GAP

### What design shows
The game HUD includes a counter showing questions answered out of total (e.g. "3 of 10").

### What the demo shows
```html
{{ 'GAME.ANSWERED' | translate }} {{ gameStore.totalAnswers() }}
```

This shows only the count without the total. There is no `questions.length` denominator surfaced in the template.

---

## 14. Booth Display Uses Hard-Coded Strings, No Translations — DEBT

`booth-display.page.ts` does not import `TranslatePipe`. All visible strings are hard-coded in English:
- `"players today"`
- `"Scan to play → practicalmachinist.com/trivia"`
- Emoji medals

This is inconsistent with every other page. Not a blocker for a single-language MVP, but will be a problem if translation is extended to the booth display.

---

## 15. Double `endGame()` Risk at Session Boundary — DEBT

In `game.page.ts`:

```ts
// poll for result then advance
const poll = setInterval(() => {
  const result = this.gameStore.lastResult();
  if (result) {
    ...
    setTimeout(() => {
      if (!this.gameStore.hasMoreQuestions()) {
        this.endGame();   // (A) called from answer poll
      }
    }, 1100);
  }
}, 100);
```

And separately the interval timer:
```ts
if (remaining === 0) this.endGame();  // (B) called from timer
```

If the player answers the last question with ≤1.1 seconds left on the clock, **both paths can fire**. Path A calls `clearTimer()` which stops path B from re-firing, but the 1100 ms `setTimeout` inside path A runs asynchronously. If the timer hits 0 during that 1100 ms window, path B fires first, clears the timer, navigates, and then path A's `setTimeout` fires and navigates again.

In practice this would result in double navigation to `/results` and a second `completeSession` call.

---

## Summary Table

| # | Area | Severity | Description |
|---|---|---|---|
| 1 | Sponsor question integration | **BLOCKER** | `/sponsor` route exists but is fully disconnected from game flow and GameStore |
| 2 | Difficulty scoring | **BLOCKER** | Always uses 100 pts base; Easy/Medium/Hard differentiation not implemented |
| 3 | Timer progress bar | **BLOCKER** | Hard-coded 90s denominator; breaks with any other session duration |
| 4 | Image questions | **BLOCKER** | No `imageUrl` in DTO; no render slot in game template |
| 5 | Booth display | **BLOCKER** | QR code, avg score, hot streak, sponsor cards all missing |
| 6 | Sponsor injection point | **GAP** | No logic for when/where in the question sequence sponsor appears |
| 7 | Phone required | **MISMATCH** | Demo has phone optional; spec requires it |
| 8 | Results "ANSWERED" field | **MISMATCH** | Shows `correctAnswers`, should show `totalAnswers` |
| 9 | `hard_plus` difficulty | **MISMATCH** | Not in spec; has no defined base point value |
| 10 | Pre-game countdown | **GAP** | 3-second countdown before session start is missing |
| 11 | Sponsor video countdown | **MISMATCH** | Shows "30 s" but completes in 3 s |
| 12 | Leaderboard scope polling | **DEBT** | Up to 10 s stale window after tab switch |
| 13 | Question progress counter | **GAP** | Shows count only, not "X of Y" |
| 14 | Booth display translations | **DEBT** | Hard-coded English strings |
| 15 | Double endGame() | **DEBT** | Race condition at last question + timer expiry |

---

*Report generated 2026-06-08*

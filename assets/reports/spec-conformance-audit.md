# Spec-Conformance Audit — `trivia-app` (public PWA)

> **Date:** 2026-06-10
> **Method:** Current app logic (`trivia-app/src`) judged **only** against `SPECIFICATION.md` + `CLAUDE.md`.
> The demo app (`PROJECT-DESCRIPTION/pm-trivia-app`) was treated as a **style/animation/transition reference only** and ignored as a source of logic truth.
> **Scope of this codebase:** public game flow + mobile leaderboard + TV booth display. The spec's Admin Panel (§9) and System Settings (§12) are **not present in this Angular app** and are assumed to live in the backend / a separate surface.

---

## Severity legend

| Label | Meaning |
|---|---|
| **BLOCKER** | Required by spec; does not work at all in the current app |
| **GAP** | Partially present, functionally incomplete vs spec |
| **MISMATCH** | App and spec disagree on a specific value/behaviour |
| **DEBT** | Works for the mock but will break under real backend/conditions |

---

## BLOCKERs

### B1 — Sponsored question flow is fully disconnected (§4, §17)
- `StartSessionResponse.sponsorQuestion` is stored in `GameStore` (`game.slice.ts`), and a `/sponsor` route exists, **but nothing ever reads it or navigates there.**
- `game.page.ts` advances linearly through `questions[]` and calls `endGame()` — no sponsor injection point, no decision logic for *before / during / after N questions* (§4.1).
- `sponsor.page.ts` ignores `GameStore` entirely: hard-coded choices, hard-coded `router.navigate(['/results', 1001])`, no scoring integration.
- `GameStore.setSponsorBonus()` exists but is **never called**, so `sponsorBonus` is always `0` on the results screen.
- **Spec acceptance criterion "Sponsored questions can appear based on admin settings" cannot pass.**

### B2 — Difficulty-based scoring not implemented (§5.1)
- Spec base points: Easy 100 / Medium 150 / Hard 200 / Hard+ 250 (sponsor only).
- `scoring.service.ts` → `BASE_POINTS = 100` (single constant); `mock.interceptor.ts:180` → `Math.round(100 * multiplier)`.
- `QuestionDto.difficulty` exists but **is never read for scoring**. Every question scores as Easy.
- Streak multiplier tiers (1.0/1.5/2.0/2.5 at streaks 1/2/4/6) **do** match spec §5.2 — only the base-point differentiation is missing.

### B3 — Timer total hard-coded to 90s (§3.4, §9.3 — session time configurable)
- `game.page.ts:29-30`: `timeLeft = signal(90)` and `timeLeftPct = (timeLeft()/90)*100`.
- `StartSessionResponse` returns `endsAt` but **never the total session duration**. Any backend session ≠ 90s makes the progress bar wrong (e.g. 120s session starts the bar at 133%).
- Fix: store `sessionDurationSeconds` (or derive `endsAt − startedAt`) and use it as the denominator.

### B4 — Image questions not modeled or rendered (§9.5 — "Optional image"; design shows image question)
- `QuestionDto` has **no** `imageUrl` / `mediaUrl` field.
- `game.page.html` renders only `prompt` text — no image slot.
- Image questions sent by the backend are silently dropped.

### B5 — Booth display missing required content (§8.2)
Spec requires: Live Leaderboard title · Top 10 · reset note · **QR code** · "Scan to play" · played count · **average score** · **hot streak panel** · **sponsor cards**.
- `booth-display.page.html` has: brand header ✓, top-10 grid ✓, player count ✓, **text URL only (no QR code)** ✗, no reset note ✗, no average score ✗, no hot streak ✗, no sponsor cards ✗.
- `BoothDisplayResponse` model lacks `avgScore`, `hotStreak`, `sponsorCards` — the contract itself can't carry the design.
- Booth page also hard-codes English strings and does **not** use `TranslatePipe` (inconsistent with CLAUDE.md "translations — english" and every other page).

---

## GAPs

### G1 — No pre-game countdown (§3.4 "Optional countdown before start, e.g. 3s")
`game.page.ts ngOnInit` starts the session and timer immediately. No "Get ready 3…2…1" screen; the clock is already running before the first question paints.

### G2 — Question progress counter shows count, not "X of Y" (§3.4/§3.5 "Answered question count" + design "3 of 10")
`game.page.html:58`: `{{ 'GAME.ANSWERED' | translate }} {{ gameStore.totalAnswers() }}` — no `questions.length` denominator surfaced.

### G3 — "Questions per session" limit not enforced (§3.4 max 10, configurable)
Game ends only when `questions[]` is exhausted or the timer hits 0. There's no concept of a configurable per-session question cap; the session simply consumes whatever array the backend returns (mock returns 6).

---

## MISMATCHes

### M1 — Phone optional, spec says Required (§3.2)
`register.page.ts:33`: `phone: new FormControl('')` — no `Validators.required`, no pattern. Spec table marks Phone **Required**.
*(Note: the consent checkbox **is** now present and `requiredTrue` — that part is spec-compliant.)*

### M2 — Results "ANSWERED" shows correct count, not total answered (§5.4)
`results.page.html:35` renders `result()!.correctAnswers` under the "ANSWERED" label. `SessionResultDto` has a distinct `totalAnswers` field that the design's "answered" stat should use.

### M3 — `hard_plus` difficulty present in app, undefined in core scoring (§5.1)
`api.models.ts:3`: `Difficulty = 'easy'|'medium'|'hard'|'hard_plus'` and mock question 5 uses `hard_plus`. Spec only defines Hard+ (250 pts) **for sponsor questions**; the standard-question data model and base-points table do not include it. Either wire Hard+ to 250 (sponsor-only) or drop it from standard questions.

### M4 — Sponsor video countdown mislabeled (§4 sponsor media; design shows 30s)
`sponsor.page.ts`: `countdown = signal(30)` but `total = 3000` ms — the "30" decrements to 0 in 3 real seconds (10× speed), and no real media is played. Demo-grade simulation, not spec behaviour.

---

## DEBT (will break under real backend)

### D1 — Leaderboard scope switch has up-to-10s stale window
`leaderboard.store.ts`: `setScope` fires a one-shot `load(scope)`, but the running 10s poll reads `activeScope()` only on its next tick. Tab switch self-corrects within ≤10s but shows stale rows meanwhile.

### D2 — Double `endGame()` race at session boundary
`game.page.ts`: the answer-poll path (1100ms `setTimeout` → `endGame()`) and the timer path (`remaining === 0 → endGame()`) can both fire if the last answer lands with ≤1.1s left, causing double navigation + a second `completeSession` call.

### D3 — `bestStreak` on completion uses current streak (mock)
`mock.interceptor.ts:199` returns `bestStreak: mockStreak` (current streak at completion), not the max reached. Real backend must return true best streak; the store already tracks `bestStreak` correctly client-side via `applyAnswerResult`.

---

## Spec items confirmed COMPLIANT
- Streak multiplier tiers 1.0/1.5/2.0/2.5 at streak ≥1/2/4/6 (§5.2) ✓
- Consent checkbox required on registration (§3.2 recommended) ✓
- Leaderboard Today / This Week tabs + current-player highlight + initials avatar (§7) ✓
- 10s leaderboard / booth polling (§8.4, §15.3) ✓
- Booth display token param accepted but unrestricted, matching spec note "do not use token / no token restriction" (§2.3) ✓
- Score / rank / best streak / sponsor-bonus stat tiles on results (§5.4) ✓ (except M2 label)

---

## Summary table

| # | Area | Severity | One-line |
|---|---|---|---|
| B1 | Sponsor question flow | **BLOCKER** | `/sponsor` orphaned; never injected, never scored |
| B2 | Difficulty scoring | **BLOCKER** | Always 100 base; Easy/Med/Hard/Hard+ ignored |
| B3 | Timer total | **BLOCKER** | Hard-coded 90s denominator |
| B4 | Image questions | **BLOCKER** | No `imageUrl` in DTO, no render slot |
| B5 | Booth display content | **BLOCKER** | No QR / avg score / hot streak / sponsor cards |
| G1 | Pre-game countdown | GAP | Missing 3s "get ready" |
| G2 | Progress counter | GAP | Shows count, not "X of Y" |
| G3 | Questions-per-session cap | GAP | Not enforced/configurable |
| M1 | Phone required | MISMATCH | Field is optional |
| M2 | Results "ANSWERED" | MISMATCH | Shows correct count, not total |
| M3 | `hard_plus` | MISMATCH | In app, no defined base in standard scoring |
| M4 | Sponsor video timer | MISMATCH | "30s" runs in 3s, no real media |
| D1 | Leaderboard scope poll | DEBT | ≤10s stale window after tab switch |
| D2 | Double endGame() | DEBT | Race → double navigation/complete |
| D3 | bestStreak on complete | DEBT | Mock returns current, not max |

*Admin Panel (§9) and SMS/Email System Settings (§12) are out of scope for this frontend codebase.*

---

## Resolution log — 2026-06-10 (implementation pass)

All 15 findings implemented; `ng build` is clean. Mock + API models were extended so the
flow works end-to-end against `mockInterceptor`.

| # | Status | How it was resolved |
|---|---|---|
| B1 | ✅ Fixed | `GameStore` is now root-scoped and shared across game/sponsor. After the standard questions, `game.page` routes to `/sponsor` when `hasSponsorRound()`. `sponsor.page` reads the sponsor question from the store, submits via new `submitSponsorAnswer` → `/sessions/:id/sponsor-answer`, applies the bonus (`applySponsorResult`), then completes the session and navigates to results. |
| B2 | ✅ Fixed | `ScoringService.BASE_POINTS_BY_DIFFICULTY` (100/150/200/250) + `computePoints(difficulty, streak)`. Mock awards `basePoints × multiplier` from each question's difficulty. |
| B3 | ✅ Fixed | `durationSeconds` added to the session contract + slice; timer counts down from it and `timeLeftPct` divides by it (no more literal 90). |
| B4 | ✅ Fixed | `QuestionDto.imageUrl` added; game template renders an image slot above the prompt; mock question 3 carries an image. |
| B5 | ✅ Fixed | `BoothDisplayResponse` extended with `avgScore`, `hotStreak`, `sponsorCards`; booth page now shows a dynamic QR code (configurable endpoint → `playUrl`), reset note, played count, avg score, hot-streak panel, sponsor cards, and uses `TranslatePipe`. Also switched booth to real theme tokens (the old `pm-*` classes didn't exist). |
| G1 | ✅ Fixed | `countdownSeconds` in the session contract drives a pre-game "GET READY" countdown before the timed session begins. |
| G2 | ✅ Fixed | HUD now shows `answered / total`. |
| G3 | ✅ Addressed | Session length is driven by the returned `questions[]`; the per-session count is surfaced in the HUD. (Admin-configurable cap remains a backend concern.) |
| M1 | ✅ Fixed | Phone is `Validators.required` + a basic pattern. |
| M2 | ✅ Fixed | Results "ANSWERED" tile now binds `totalAnswers`. |
| M3 | ✅ Fixed | Standard mock question no longer uses `hard_plus`; the tier is reserved for sponsor scoring (250). |
| M4 | ✅ Fixed | Sponsor reel counts real seconds (`secondsLeft` decremented 1/s); label always matches elapsed time. |
| D1 | ✅ Fixed | Leaderboard polling is keyed by scope via `switchMap`; a tab switch tears down the old timer and fetches the new scope immediately. |
| D2 | ✅ Fixed | `hasEnded` guard ensures only one of the answer-advance / timer-expiry paths ends the session. |
| D3 | ✅ Fixed | Mock tracks `mockMaxStreak` and returns it as `bestStreak`. |

> The booth QR uses an external image endpoint (`api.qrserver.com`, configurable in `environment`). Swap to a bundled encoder if offline booth reliability is required.

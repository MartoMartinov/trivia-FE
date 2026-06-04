# PM Trivia — Specification & Design Audit

> **Date:** 2026-06-04 (revised)
> **Scope:** `SPECIFICATION.md` and the Figma wireframes, reconciled against the **working Angular demo** at
> `assets/ignore/agents/PROJECT-DESCRIPTION/pm-trivia-app`.
> **Purpose:** Reconcile the three artifacts before building the Angular player app + Laravel API/SSR admin.

## Source-of-truth hierarchy (per `AGENTS.md`)

When the artifacts disagree, resolve in this order:

1. **The demo (`pm-trivia-app`) — highest priority.** It is a runnable Angular 17 + Ionic 8 player app that encodes concrete gameplay, scoring, and flow decisions. Where it exercises a behavior, **its behavior is the decision** — even where it contradicts the spec or the wireframes.
2. **`SPECIFICATION.md`** — governs everything the demo does *not* cover (the entire admin panel, the API, notifications, CSV, the data model, security).
3. **Figma wireframes** — visual reference; superseded by the demo wherever they conflict.

> **Consequence vs. the previous audit:** the prior version excluded prototypes and treated scoring, difficulty tiers, the multiplier ceiling, sponsor bonus, the bonus timer, replay, and share as *open blocking decisions*. The demo settles all of these — they are now recorded as fact in **What the demo actually implements** below and dropped as findings. Only what the demo genuinely leaves open remains in this audit (admin surfaces, server-authority, legal/consent, multi-event).

Severity: **Critical** (breaks integrity/security/legal) · **High** (wrong/contradictory behavior) · **Medium** (gap/ambiguity) · **Low** (polish). The **Frontend** items are now **Resolved** (decisions recorded below); the **Backend** items remain **Open** — the demo does not cover them, so the spec governs and a decision is still needed.

---

## What the demo actually implements (the authoritative baseline)

All references are to `pm-trivia-app/src/app`.

| Behavior | Demo implementation | Ref |
|---|---|---|
| **Difficulty tiers** | **4** — `EASY / MEDIUM / HARD / HARD+` | `core/game.service.ts:7` |
| **Base points (fixed per question, by difficulty)** | EASY **80** · MEDIUM **100** · HARD **150** · HARD+ **200** | `core/game.service.ts:35–47` |
| **Scoring model** | `awarded = round(base_points × streak_multiplier)` — fixed per-question base **×** an **independent** streak multiplier | `pages/gameplay.page.ts:116` |
| **Streak multiplier ladder** | `streak ≥ 4 → 2×` · `streak ≥ 2 → 1.5×` · else `1×` (**max 2×**) | `core/game.service.ts:79–81` |
| **HUD multiplier badge** | Shows `1.5×` / `2×`, appears at `streak ≥ 2`. **No 3× anywhere** | `pages/gameplay.page.ts:32–34` |
| **Session timer** | **90 s**, single session clock; ends → sponsor round | `core/game.service.ts:30`, `pages/gameplay.page.ts:100–104` |
| **Sponsor bonus scoring** | `bonusPoints(200) × multiplier(1)` = **fixed +200**, **not** multiplied by streak | `core/game.service.ts:49–54`, `pages/sponsor.page.ts:136` |
| **Sponsor question placement** | Runs **after** the main question bank is exhausted → **extra**, not part of the main set | `pages/gameplay.page.ts:95,127–131` |
| **Sponsor video** | **Watch-to-unlock** — answers are gated until the 30 s reel finishes | `pages/sponsor.page.ts:116–129` |
| **Registration** | First/Last/Email/Company/Phone, all required, email regex-validated; **no consent checkbox** — implicit footnote instead | `pages/register.page.ts:40–59,69,88` |
| **Replay** | "**One play per day**" (messaging only; no enforcement in-app) | `pages/results.page.ts:70` |
| **Leaderboard** | Today / This Week tabs (**This Week is a static button, no handler**); top 10 + "You" row | `pages/leaderboard.page.ts:27–30,91–95` |
| **Reset** | "Resets at midnight" (copy only) | `pages/leaderboard.page.ts:25,56`, `pages/results.page.ts:74` |
| **Tie-break** | Sort by **score only** | `core/game.service.ts:94–96` |
| **Share** | `navigator.share()` with clipboard fallback | `pages/results.page.ts:94–100` |
| **Routes** | `/` (register) · `/play` · `/sponsor` · `/results` · `/leaderboard` | `app/app.routes.ts` |
| **State** | In-memory, single play-through, **no backend** ("wire to Laravel when ready") | `core/game.service.ts:18–28`, `README.md:33` |

---

## Still open (demo is silent — spec governs)

Each item is filed under its **primary owner**. Items that span both tiers carry an `↔` note pointing at the other side.

### Frontend — Angular player app (decisions made — these override the demo)

#### H5 — Resolved — Explicit consent **checkbox**, persisted server-side  ↔ backend
Add an explicit, required consent checkbox to the register form — **overriding** the demo's implicit footnote (`register.page.ts:69`). This satisfies spec §3.2/§14. `↔` Backend persists `consent_status` (§10.1) and gates email/SMS sends on it. Resolves spec open-question #10.

#### L3 — Resolved — Accessible answers via semantic HTML
Re-implement answer choices with **native semantic elements** (`<button>`), proper labels, and a correct focus order — not the demo's `<div (click)>` rows (`gameplay.page.ts:57–63`, `sponsor.page.ts:81–87`). Must pass AXE / WCAG AA.

#### FE-1 — Resolved — Use the **spec** route naming, not the demo's
Follow spec §16: `/register`, `/game`, `/results/{sessionId}`, `/leaderboard`, `/booth-display`. The demo's `/` and `/play` are **not** adopted.

#### FE-2 — Resolved — Implement the **spec** countdown + question limit
Implement the §3.4 **3-second countdown** and the **10-question-per-session** limit, both seeded from backend `GameSettings` (`countdown_seconds`, `questions_per_session`). The demo exercises neither — the spec governs here.

#### FE-3 — Resolved — Build to the **build-plan** stack targets
Target **Angular 21 / Ionic 8 / Tailwind 4** per `pm-trivia-build-plan.md`, not the demo's Angular 17 / Tailwind 3.4 (`README.md:3`). The demo is the **behavioral** reference only.

### Backend — Laravel (replicate the `fangri-la-BE` foundation)

> **Decision:** the backend is built by **replicating the existing `fangri-la-BE` project** (`C:\Users\twrkh\Projects\fangri-la-BE`) and layering the trivia features on top. That repo is the reference for stack, structure, and — most importantly — **authentication**. The points below are re-scoped accordingly: most of the "design from scratch" work the prior audit implied is replaced by "follow the established pattern."

#### Foundation to replicate (verified against the repo)

**Stack — overrides the build plan's assumptions.** The foundation is **Laravel 10** (`laravel/framework ^10.10`), **PHP 8.1+** (8.3 recommended), **MySQL 8**, **Sanctum 3**, **Fortify 1**, **PHPUnit 10** (`composer.json`). It uses the **Laravel 10 layout**: `app/Http/Kernel.php` for middleware (not `bootstrap/app.php`), `routes/api.php` + `routes/web.php`. The admin UI is **Blade SSR** (server-rendered forms via `app/Forms/*` helpers — `SelectList`, `SelectItem`, `InputFieldNames`, `DataTypes` — plus `resources/views/admin/**` and Blade components), **not Livewire**.
> ⚠️ This contradicts `pm-trivia-build-plan.md`, which targets Laravel 12 / Livewire 3 / Pest 4 / `bootstrap/app.php`. **The foundation wins for the backend** — update the build plan to L10 / Blade+Forms / PHPUnit. (The frontend FE-3 decision — Angular 21 / Tailwind 4 — is unaffected.)

**Structure to mirror:**
- `app/Http/Controllers/Api/*` — thin controllers extending a base `ApiController` exposing `apiResponse($message, $data, $status, $error)` (envelope: `{ message: { subtitle }, data }`).
- `app/Http/Controllers/Admin/*` — resource controllers extending `PanelController`, one per entity (`ArtistController` → `QuestionController`, `SponsorController`, `PlayerController`, …).
- `app/Http/Requests/Admin/*` — a `FormRequest` per admin action (no inline validation).
- `app/Services/*` — integration/business logic in dedicated service classes (e.g. `Shopify/`, `MediaStorage/`); trivia's `ScoringService`/`LeaderboardService`/`QuestionSelectionService` live here.
- `app/Models/*`, `app/helpers.php`, `app/Forms/*`, `resources/views/admin/**`.
- **API routes are locale-prefixed**: `/api/{locale}/...` behind a `localization` middleware (suits the project's English-translation requirement). Admin routes are grouped under `Route::prefix('admin')->middleware(['auth','role:admin'])` in `web.php`.

#### C2 — Resolved (replicate) · was Critical — Admin auth + roles
**No longer design-from-scratch.** Replicate the foundation's admin auth exactly: **Fortify on the `web` (session) guard** with `Features::resetPasswords/updateProfileInformation/updatePasswords` enabled and **registration disabled** (admins are seeded/invited, not self-registered); Fortify actions in `app/Actions/Fortify/*`; login view in `resources/views/auth/*`; login rate-limited 5/min by email+IP (`FortifyServiceProvider`). Authorization via the custom **`roles` table (`id`, `name`) + `role_id` FK on the user + `HasRoleMiddleware` (`role:admin`)** — **not** spatie. Admin panel gated by `['auth','role:admin']` (`web.php`). **Remaining decision:** map spec §9.1 roles (Super Admin · Admin · Booth Operator · Marketing) to `roles` rows and decide which routes each may hit.

#### C3 — Re-scoped (mechanism exists) · Critical — Player identity + registration rate limit
The token + rate-limit **machinery already exists**: the foundation issues a **Sanctum personal access token** with configurable expiry plus a **rotating refresh token** (sha256-hashed `UserRefreshToken`, httpOnly/secure cookie) via its `formattedResponse()`/`refresh()` flow, and rate-limits with `RateLimiter::for(...)`. Trivia players have **no password** (registration is contact-capture), so mirror `formattedResponse()` **minus** password/OAuth/Shopify/StreamChat — register → issue token. **Remaining product decision (unchanged):** how to treat a returning email — fresh session keyed to email vs. write-back to one profile (spec §3.3 / open-question #1) — and apply the existing rate limiter to `register` + `session/start`.

#### H3 — Re-scoped · High — Reports screen (build on the admin + CSV pattern)
Still greenfield content, but the **pattern is in the foundation**: build it as an `Admin/ReportController` + Blade view like the other admin entities, and reuse the existing **CSV export** approach (`VaultItemController::exportInstancesCsv`). Capture `SponsorInteraction` events (§4.2 / §10.7) from day one via a `SponsorTrackingService` in `app/Services/`.

#### M5 — Re-scoped · Medium — Server-authoritative scoring/timing
Unchanged in intent (the demo is client-only by design), but place the logic per the foundation: `ScoringService` / `LeaderboardService` / `QuestionSelectionService` in **`app/Services/`**, called from thin `Api/*` controllers that return via `ApiController::apiResponse`. The demo's `GameService` is the **reference formula** to port, not the runtime authority.

#### M1 — Open · Medium — Sponsors management entry point
Build as an admin resource controller + Blade (mirroring `ArtistController`/`PageController`). **Decision still needed:** manage sponsors inside Questions (sponsor type) or as a dedicated `Admin/SponsorController` list (spec §9.6).

#### M2 — Re-scoped · Medium — Admin tablet/responsive
The foundation ships an existing **admin Blade theme/layout**; inherit it, so tablet behavior is whatever that theme already provides. **Decision:** accept the inherited responsiveness or define explicit tablet breakpoints (spec §15.1).

#### M3 — Open · Medium — Game Settings (reset time + timezone)
No settings screen exists in the demo. Build a `GameSettings` model + an admin settings screen following the foundation's `settings/*` pattern (cf. `Admin/TestModeController` + `settings.` route group). Add reset-time + timezone (spec §6.1/§9.3, open-question #5).

#### M6 — Open · Medium — "This Week" window is undefined  ↔ frontend
Spec §6.2 leaves the weekly window unconfirmed. Define calendar/event/rolling-7d and build the leaderboard query in `LeaderboardService`. `↔` Frontend wires the **This Week** tab, which the demo renders as a static button with no handler (`leaderboard.page.ts:29`) (open-question #6).

#### L2 — Open · Low — Booth display token security  ↔ frontend
The demo's player app has **no booth-display route**. Spec §8/§13 want the TV link token-protected if it exposes non-public data. Reuse a foundation-style mechanism — a signed route or a dedicated Sanctum-style token (cf. `StorageProxyController`). **Decision:** public vs. tokenized (open-question #11). `↔` Frontend booth-display page consumes the token when built.

#### L4 — Open · Low — Multi-event support
The demo hardcodes IMTS branding and a single mock board; the data model carries `event_id`. **Decision:** single vs. multi-event, then shape the schema (open-question #9).

---

## Open decisions still required (demo silent — spec governs)

### Frontend — Angular player app (all resolved)
| Item | Decision |
|---|---|
| Consent UI | Explicit **required checkbox** ↔ backend stores `consent_status` |
| Answer-row accessibility | Native `<button>` + labels + focus order (WCAG AA) |
| Route naming | **Spec §16** routes (`/register`, `/game`, `/results/{sessionId}`, …) |
| Countdown + question limit | **Per spec** (3 s, 10/session) from `GameSettings` |
| Stack target | **Build plan** — Angular 21 / Ionic 8 / Tailwind 4 |

### Backend — Laravel, on the `fangri-la-BE` foundation

**Replicate (no open decision — follow the foundation):**
| Concern | Pattern to copy from `fangri-la-BE` |
|---|---|
| Stack | Laravel 10 · PHP 8.1+ · MySQL 8 · Sanctum 3 · Fortify 1 · PHPUnit · `app/Http/Kernel.php` |
| Admin auth | Fortify (web/session) + `roles` table + `HasRoleMiddleware` (`role:admin`); registration disabled |
| Player auth | Sanctum token + rotating refresh-token cookie (`formattedResponse`/`refresh`), **minus** password/OAuth |
| API shape | `Api/*` → `ApiController::apiResponse` envelope; FormRequests; `/api/{locale}/…`; `RateLimiter::for` |
| Admin UI | Blade SSR + `app/Forms/*` helpers + `resources/views/admin/**` (not Livewire) |
| Services / CSV | logic in `app/Services/*`; CSV export à la `VaultItemController::exportInstancesCsv` |

**Still to decide (foundation doesn't answer these):**
| Decision | Next step |
|---|---|
| Admin role map | Map spec §9.1 roles → `roles` rows + per-route gating |
| Player identity on returning email | Fresh session vs. profile write-back (spec §3.3) |
| Persist `consent_status` + gate sends | Spec §3.2/§14 — follows the FE consent decision |
| Sponsors management entry point | Inside Questions vs. dedicated `SponsorController` (spec §9.6) |
| Reset time + timezone | Add to `GameSettings` (spec §6.1/§9.3) |
| "This week" window | Define + build query in `LeaderboardService` (spec §6.2) |
| Admin tablet/responsive scope | Accept inherited theme vs. explicit breakpoints (spec §15.1) |
| Booth link public vs. tokenized | Spec §8/§13 |
| Single vs. multi-event | Spec §10 — confirm schema |

---

## Summary

With the demo promoted to source of truth, the scoring/gameplay conflicts the old audit flagged as blocking are settled and captured in **What the demo actually implements** — build to that table verbatim (fixed per-difficulty base 80/100/150/200 × an independent streak multiplier capped at 2×; keep HARD+; flat +200 sponsor bonus, extra and video-gated; one play/day; native share).

What remains is split by owner. **Frontend** (Angular player app) is now fully **decided**: explicit consent checkbox, semantic/accessible answers, **spec** route naming, **spec** countdown + question limit, and the **build-plan** stack (Angular 21 / Tailwind 4) — note these last three deliberately override the demo.

**Backend** (Laravel) is now anchored on the **`fangri-la-BE` foundation**: replicate its stack (Laravel 10 / Sanctum / Fortify / Blade-SSR admin / PHPUnit) and especially its **auth** — Fortify + `roles` + `HasRoleMiddleware` for admin (closing C2), and Sanctum token + refresh-cookie issuance for players (the mechanism for C3). That converts most former "design" work into "follow the pattern," leaving a short list of genuine product decisions: the admin role map, returning-email identity, consent persistence, sponsors entry point, reset/timezone settings, the weekly window, admin responsiveness, booth token, and multi-event.

> **Downstream — update `pm-trivia-build-plan.md`:** (1) settle gameplay items 1–4, 7, 12 per **What the demo actually implements**; (2) **correct the backend stack** — it specifies Laravel 12 / Livewire 3 / Pest 4, but the `fangri-la-BE` foundation (which we are replicating) is **Laravel 10 / Blade + `app/Forms` / PHPUnit**, so §2 and §5 must be revised to match.

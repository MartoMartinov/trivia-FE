# PM Trivia — Build Plan & Architecture Analysis

> **Date:** 2026-06-03
> **Scope:** End-to-end build strategy for the Practical Machinist event-booth trivia platform — Angular/Ionic player app + Laravel SSR admin + shared Laravel API.
> **Inputs:** `specifications/spec.md`, the Figma wireframes, project rules in `CLAUDE.md` / `AGENTS.md`, the SignalStore convention guide `assets/ignore/agents/FRONTEND/ANGULAR/ngrx-signalstore.md`, and the findings in `pm-trivia-audit.md`.

---

## 1. Executive summary

The platform is **three deployables on two codebases**:

1. **Player app** — Angular 21 + Ionic + Capacitor. Public, mobile-first. The only thing a visitor touches: register → play → results → leaderboard, plus the TV booth display.
2. **Admin site** — Laravel 12 server-side rendered (Livewire + Blade). Separate site, desktop-first, all sensitive management.
3. **API** — Laravel 12 JSON API (same Laravel install as the admin), Sanctum-authenticated, serving the Angular app.

The guiding principle is a hard **trust boundary**: all scoring, timing, answer-validation, and ranking happen on the Laravel server. The Angular client renders and reports; it never decides correctness or score. This is the direct lesson from the audit (the prototypes computed everything client-side).

```
┌────────────────────────┐        JSON / Sanctum        ┌──────────────────────────────┐
│  Player app (Angular)  │ ───────────────────────────► │           Laravel 12          │
│  Ionic + Capacitor     │ ◄─────────────────────────── │  routes/api.php  → API        │
│  public game + booth   │                              │  routes/web.php  → Admin SSR  │
└────────────────────────┘                              │  Livewire + Blade (admin UI)  │
                                                         │  Fortify (admin auth)         │
┌────────────────────────┐         HTTPS / session      │  Sanctum (player tokens)      │
│  Admin browser         │ ───────────────────────────► │  MySQL · Queue · Mailer · SMS │
└────────────────────────┘                              └──────────────────────────────┘
```

---

## 2. Confirmed technology stack (verified against npm, June 2026)

### Frontend
| Concern | Package | Version |
|---|---|---|
| Framework | `@angular/core` | 21.2.15 |
| UI components | `@ionic/angular` | 8.8.8 |
| Native shell | `@capacitor/core` / `android` / `ios` | 8.4.0 |
| Token storage | `@capacitor/preferences` | latest |
| State | `@ngrx/signals` | 21.1.0 |
| Styling | `tailwindcss` | 4.3.0 |
| Language | `typescript` | 6.0.3 |

### Backend
| Concern | Package | Version |
|---|---|---|
| Framework | `laravel/framework` | 12 |
| Language | PHP | 8.5 |
| Admin auth | `laravel/fortify` | 1 |
| API auth | `laravel/sanctum` | latest |
| Admin UI | `livewire/livewire` | 3 |
| Testing | `pestphp/pest` | 4 |
| Formatting | `laravel/pint` | 1 |
| Styling | `tailwindcss` | 4 |

> Per `CLAUDE.md` ("up to date as of 01.06.2026") versions are re-checked at install time, and `search-docs` is used for version-specific Angular/Ionic/Laravel/Tailwind docs rather than training data.

---

## 3. Blocking decisions (must resolve before coding scoring/schema)

These come straight from `pm-trivia-audit.md` and gate implementation:

| # | Decision | Blocks | Default if unanswered |
|---|---|---|---|
| 1 | **Scoring model** — per-difficulty base × multiplier (spec) **vs** flat 100 × multiplier, difficulty coupled to streak (design) | scoring code, schema, settings UI | Follow **design** (flat 100 × multiplier) — it's the more recent artifact |
| 2 | Sponsor bonus formula + whether bonus Qs count toward the 10-question limit | scoring, session builder | Fixed **+200**, **extra** (not counted) |
| 3 | Keep or drop `HARD+` (4th difficulty) | enums, CSV, editor | Keep (design shows it) |
| 4 | Replay per day + best-vs-latest score | identity, leaderboard | **Best daily score**, one play/day |
| 5 | Daily reset time + timezone | leaderboard | Event-local midnight |
| 6 | "This week" window | leaderboard | Calendar week |
| 7 | Consent / GDPR handling | registration | Required consent checkbox |
| 8 | Admin auth + roles | admin site | Email/password + single Admin role |
| 9 | Reports screen design | admin Reports | Build from spec §9.10 columns |
| 10 | Booth link public vs tokenized | booth display | Tokenized |
| 11 | Single vs multi-event | schema, routes | Multi-event-ready schema, single active event |
| 12 | Bonus-question timer model | gameplay | Pause session clock during bonus |

The build proceeds with the "default" column where a decision is outstanding, isolating each behind config so a reversal is cheap.

### 3.1 Cross-artifact scoring evidence (informs decisions #1, #3)
How the four artifacts actually handle difficulty and scoring — they disagree, which is why these decisions are blocking:

| Aspect | Angular demo | Spec §5 | Figma design | HTML prototype |
|---|---|---|---|---|
| Difficulty tiers | EASY/MEDIUM/HARD/**HARD+** (4) | easy/medium/hard (3) | EASY/MEDIUM/HARD/**HARD+** (4) | Easy/Medium/Hard (3) |
| Base points | 80 / 100 / 150 / 200 | 100 / 150 / 200 | flat **100** for all | 100 / 150 / 200 |
| Difficulty driver | fixed per question | fixed per question | **coupled to streak** | fixed per question |
| Multiplier ladder | 1 / 1.5 / 2 (cap) | 1 / 1.5 / 2 / 2.5 | 1 / 1.5 / 2 / 2.5 | 1 / 1.5 / 2 / 2.5 |
| Multiplier max | streak ≥ 4 → **2×** | streak ≥ 6 → **2.5×** | **2.5×** (HUD shows 3×) | **2.5×** |

**Reads for the decisions:**
- **#3 (HARD+):** present in the two newer artifacts (Angular demo + Figma design), absent from spec §10.3 + HTML prototype → keeping it is the better-supported default.
- **#1 (scoring model):** the Angular demo uses the **spec model** (per-question base × independent streak multiplier), *not* the design's flat-100 / streak-coupled-difficulty model — so the artifacts split on the core scoring approach.
- **Multiplier ceiling** is inconsistent everywhere (2× vs 2.5× vs a stray 3× on the design HUD) and must be pinned regardless of which model wins.

> Source refs: Angular demo `game.service.ts:7` (levels), `:35–47` (base points), `:79–81` (`multiplierFor`); `gameplay.page.ts:116` (`points × multiplier`), `:48` (static difficulty chip). Figma *Admin Game Settings* (node 264:2). Audit C1/H1/H2.

---

## 4. Frontend — Player app (Angular 21 + Ionic + Capacitor)

### 4.1 Scope
Public player surfaces only: `/play`, `/game`, `/sponsor`, `/results/:id`, `/leaderboard`, `/booth-display`. No admin code ever lives here.

### 4.2 Initialization
```bash
ionic start trivia-app blank --type=angular --capacitor
npm install @capacitor/android @capacitor/ios @capacitor/preferences
```
Dev server at `http://localhost:8100`. Platforms are **not** added yet (`npx cap add` deferred per project rules).

### 4.3 Folder structure
```
src/app/
├── core/
│   ├── stores/        one folder per store, each split per the conventions doc
│   │   ├── features/  reusable signalStoreFeatures: with-base · with-request-status · with-loading
│   │   ├── auth/        auth.slice.ts · auth.updaters.ts · auth.store.ts
│   │   ├── game/        game.slice.ts · game.updaters.ts · game.store.ts
│   │   ├── player/      player.slice.ts · player.updaters.ts · player.store.ts
│   │   └── leaderboard/ leaderboard.slice.ts · leaderboard.updaters.ts · leaderboard.store.ts
│   ├── services/      api · token-storage · scoring · leaderboard  (side-effects only, return Observables)
│   ├── interceptors/  auth.interceptor.ts
│   ├── guards/        auth.guard.ts · session-active.guard.ts
│   └── models/        api.models.ts
├── shared/
│   ├── ionic.imports.ts      Ionic standalone component barrel
│   ├── angular.imports.ts    common pipes/directives barrel
│   └── components/    pm-header · answer-chip · timer · streak-badge · qr-code
└── pages/
    ├── register/     register.page.{ts,html,scss}
    ├── game/         game.page.{ts,html,scss}
    ├── sponsor/      sponsor.page.{ts,html,scss}
    ├── results/      results.page.{ts,html,scss}
    ├── leaderboard/  leaderboard.page.{ts,html,scss}
    └── booth-display/booth-display.page.{ts,html,scss}
```
Every page and shared component is a `.ts` / `.html` / `.scss` trio (per the Angular rule that logic, template, and styles are separate files).

### 4.4 Component & language conventions (enforced everywhere)
- Standalone components (no `standalone: true` — default in v21), `ChangeDetectionStrategy.OnPush`.
- Signals for state; `input()` / `output()` functions, never decorators.
- `inject()` for DI, never constructor injection.
- `@if` / `@for` / `@switch`; never `*ngIf` / `*ngFor`. No `ngClass` / `ngStyle` (use `[class]` / `[style]`). No `@HostBinding` / `@HostListener` (use `host: {}`).
- No `any` — `unknown` or generics. `const` / `readonly` by default.
- Tailwind 4 utilities first; SCSS only for what Tailwind can't express.
- Every screen passes AXE / WCAG AA (focus, contrast, ARIA).

### 4.5 State — NgRx SignalStore

> All stores follow the project convention guide `assets/ignore/agents/FRONTEND/ANGULAR/ngrx-signalstore.md`. That doc is authoritative for SignalStore mechanics; this section records only the app-specific decisions.

| Store | Scope | Holds | Computed |
|---|---|---|---|
| `AuthStore` | `root` | token, player, tokenExpiry | `isAuthenticated` |
| `GameStore` | **route** (`/game` providers) | sessionId, endsAt, questions[], currentIndex, score, streak, status, lastResult | `currentQuestion`, `isGameOver`, `progress` |
| `PlayerStore` | `root` | registered profile | `displayName`, `initials` |
| `LeaderboardStore` | route (leaderboard/booth) | today[], week[], activeTab, totalPlayers | `currentPlayerRow` |

**Conventions applied (from the guide):**

- **Feature library first.** Build `withBase(name)` (central `withDevtools`), `withRequestStatus()` (idle/pending/fulfilled/error + derived flags), and `withLoading(name)` (bridges to the Ionic loading/toast UI) before the stores; each store composes them rather than re-implementing status/loading.
- **Mutations:** only via `patchState` + **named pure updaters** (in each `*.updaters.ts`) — never inline literals, never direct signal writes, never `mutate()`.
- **Async:** every server call is a `rxMethod` + `tapResponse`, with the flattening operator matched to intent:

  | Action | Operator | Rationale |
  |---|---|---|
  | `submitAnswer`, `register`, `startGame` | `exhaustMap` | ignore re-taps while in-flight — prevents double-submit / double-scoring |
  | `loadLeaderboard` (10s poll), tab switch | `switchMap` | cancel the stale request; latest wins |

- **Booth + mobile both poll, no WebSockets.** Both `/leaderboard` (mobile) and `/booth-display` poll every ~10s via an rxjs `timer` → `switchMap`. No Echo, no reconnect logic; the server-side cache + `ETag`/`304` keep polling cheap and consistent across all viewers. Up to ~10s latency is invisible on a booth screen.
- **Derivations** live in `withComputed`, not components.
- **Scope is deliberate:** `GameStore` is route-scoped (listed in the `/game` route `providers`) so session state is destroyed on leave and cannot bleed into a replay; `AuthStore`/`PlayerStore` are root singletons.
- **Token persistence (pitfall #5):** never persist whole state or tokens via a `withLocalStorage` effect. The Sanctum token is written explicitly through `TokenStorageService` (Capacitor Preferences); `AuthStore` holds it in memory as signal state only. No `withLocalStorage` on `AuthStore`.
- **`LeaderboardStore` uses plain arrays**, not `withEntities()` — rows are replaced wholesale each poll and never mutated individually.
- HTTP stays in `services/` (returns Observables); stores hold state and convert via `rxMethod`. The two layers are not merged.

### 4.6 Routing & guards
Lazy `loadComponent` per page. `authGuard` protects `/game`, `/sponsor`, `/results/:id`. `/play`, `/leaderboard` public; `/booth-display` public-but-token-gated via `?token=`.

### 4.7 Auth flow (player)
No passwords. Registration issues a Sanctum token →
1. `POST /api/players/register` → `{ token, player }`
2. token persisted via `@capacitor/preferences` (web + native parity)
3. `authInterceptor` attaches `Authorization: Bearer <token>`
4. `provideAppInitializer` calls `AuthStore.restoreSession()` on boot to rehydrate
5. `authGuard` blocks game routes without a token

### 4.8 Server-authoritative client behavior
- Questions arrive **without** the correct answer; correctness returns only from `POST /sessions/{id}/answers`.
- `endsAt` is server-supplied; the on-screen timer is display-only; the server rejects late answers.
- The frontend `ScoringService` mirrors the backend formula **only** for instant optimistic UI feedback; the authoritative score is whatever the API returns.

### 4.9 Styling tokens (Tailwind 4 `@theme`)
`pm-orange #F34D23` · `pm-navy #1E2A3B` / `#0F1429` · `pm-navy-deep #0E1524` · `pm-gold #F5B400` · `pm-paper #F7F8FA` · sponsor red `#DE0016`. Font: Inter 400–900. Booth display targets 1920×1080, full-screen, auto-refresh, zero interaction.

---

## 5. Backend — Laravel 12 (API + SSR admin)

### 5.1 Structure (Laravel 12 streamlined)
Middleware/exceptions/routing registered in `bootstrap/app.php` (no `Http/Kernel.php`). `routes/api.php` for the player API, `routes/web.php` for the admin SSR site.

```
app/
├── Models/                 Eloquent models + casts() methods
├── Http/
│   ├── Controllers/Api/    thin API controllers → services
│   ├── Controllers/Admin/  thin admin controllers → Livewire/Blade
│   ├── Requests/           FormRequest per action (no inline validation)
│   └── Resources/          Eloquent API Resources (API responses)
├── Livewire/               admin UI components
├── Services/               ScoringService · LeaderboardService ·
│                           QuestionSelectionService · SponsorTrackingService
├── Jobs/                   queued notifications (ShouldQueue)
└── Policies/               authorization
database/
├── migrations/  factories/  seeders/
resources/views/admin/      Blade layouts + Livewire views
```

### 5.2 Data model (per spec §10, all with factories + seeders)
`Player`, `GameSession`, `Question`, `QuestionChoice`, `Sponsor`, `GameAnswer`, `SponsorInteraction`, `AdminUser`, `MessageTemplate`, `GameSettings`. Each table built with `php artisan make:model -mfs`. `event_id` carried on session/settings for multi-event readiness. Casts defined in `casts()` methods. Column modifications restate all prior attributes (L12 rule).

### 5.3 Player API (`routes/api.php`, Sanctum)
```
POST /api/players/register        rate-limited; email primary identifier
POST /api/sessions/start          builds & locks the question set to the session
GET  /api/sessions/{id}/questions returns questions WITHOUT correct answers
POST /api/sessions/{id}/answers   validates server-side; returns correctness + points
POST /api/sessions/{id}/complete  finalizes score + rank
GET  /api/sessions/{id}/result    result metrics
GET  /api/leaderboard?scope=      today | week, server-computed reset/timezone
GET  /api/booth-display?token=    token-gated TV payload, polled ~10s; ETag → 304 when unchanged
```
All responses via API Resources; all inputs via FormRequests; rate limiting on register + session start.

**Booth refresh (no WebSockets):** the booth polls `GET /api/booth-display?token=` every ~10s — same `LeaderboardService` and payload as the mobile board. The computed leaderboard is **server-cached (~5–10s) and shared across all viewers**, and the endpoint returns an `ETag` so unchanged polls get a cheap `304`. Payload is display-only (rank, first name + last initial, company, score) — no email/phone. Polling is stateless and self-healing (no reconnect logic); Reverb/Echo can be added later for instant push without changing the booth's render path.

### 5.4 Core services
- **`ScoringService`** — single source of truth for the scoring formula (decision #1/#2). Mirrored, not trusted, by the frontend.
- **`QuestionSelectionService`** — selects N active questions per `GameSettings`, injects active sponsor questions within run dates, locks the set to the session at start (so mid-session settings changes don't apply).
- **`LeaderboardService`** — best daily score per player, tie-break (score → duration → streak → submission), configurable reset time + timezone, weekly aggregation.
- **`SponsorTrackingService`** — records every `SponsorInteraction` (`card_view`, `media_view`, `video_play`, `answer_correct/incorrect`, `website_click`) feeding the Reports screen.

### 5.5 Admin SSR site (`routes/web.php`)
Livewire 3 + Blade + Alpine + Tailwind 4, behind Fortify auth. Screens (per spec §9 and the Figma nav): Login*, Dashboard, Questions, Edit Question, Players, Edit Player, Edit Sponsor, Game Settings, **Reports***, Templates, Admin Users, System Settings. (*Login and Reports are missing from the design — audit C2/H3 — and will be designed before build.)

Key Livewire components: `DashboardStats` (`wire:poll` 10s), `QuestionTable` (filter/sort/CSV import+export), `SponsorForm` (brand color, media upload, run dates, bonus config), `PlayerTable` (search + filter tabs + CSV), `SponsorReport` (date range + CSV), `TemplateEditor` (email/SMS + variable validation), `GameSettings` (session/streak/replay/reset/timezone — adding the controls missing from the wireframe, audit M3/M4), `SmtpSettings`/`TwilioSettings` (masked inputs + test send).

### 5.6 Auth & security
- **Fortify**: admin login, password reset, sessions (+ roles per decision #8).
- **Sanctum**: player API tokens.
- CSRF on all Blade forms; rate limiting on `/register` and `/sessions/start`; encrypted SMTP/Twilio credentials (config-only, never `env()` in app code); file-type/size validation on logo/media uploads; booth token; no public access to admin data.

### 5.7 Notifications & jobs
Queued jobs (`ShouldQueue`): daily winner, sponsor thank-you, play-again reminder, daily digest. Each respects the player's email/SMS toggles, consent status, and template active state. All sends logged.

### 5.8 CSV
Import validates every row and returns a per-row error report before persisting. Exports (players, today's leaderboard, sessions, sponsor reports, question performance) include event name + timestamp in the filename.

---

## 6. Shared contract (DTOs)
The Angular `core/models/api.models.ts` mirrors the API Resources exactly. Critical invariant: `QuestionDto` carries **no** correct answer; `SubmitAnswerResponse` is the only place correctness appears. `Difficulty` union includes `hard_plus` pending decision #3. `endsAt`/`resetsAt` are ISO strings computed server-side.

---

## 7. Testing strategy
- **Backend (Pest 4):** feature tests against a real database for every API endpoint and every admin Livewire action; unit tests for `ScoringService` and `LeaderboardService` (tie-breaking, reset boundaries, sponsor bonus). Factories + custom states; no mocked DB. `php artisan test --compact`.
- **Frontend (Angular, zoneless):** "Act → `await fixture.whenStable()` → Assert"; no `fixture.detectChanges()`; `useAutoTick()` for timers. Unit-test the mirrored `ScoringService` against backend fixtures to guarantee parity. Store tests for `GameStore` transitions.
- **Formatting/CI:** `vendor/bin/pint --dirty --format agent` before finalizing PHP; Angular lint/format enforced.

---

## 8. Build sequencing
1. **Foundations** — Laravel install, schema + migrations + factories/seeders, `GameSettings`; resolve decisions #1–#7.
2. **Scoring core** — `ScoringService` + `LeaderboardService` + `QuestionSelectionService` with full Pest coverage (highest-risk logic first).
3. **Player API** — register → session → answer → complete → result → leaderboard, Sanctum, rate limiting, Resources, FormRequests. Booth/leaderboard payloads server-cached (~5–10s) with `ETag` support.
4. **Angular player app** — scaffold, stores, auth flow, then pages in flow order (register → game → sponsor → results → leaderboard → booth), wired to the API; mirrored `ScoringService`. Booth + mobile leaderboard both poll ~10s (no WebSockets).
5. **Admin SSR** — Fortify auth + login, Dashboard, Questions/Sponsor, Players, Game Settings, Reports, Templates, System Settings.
6. **Notifications** — queued email/SMS jobs + template processing.
7. **Hardening** — security pass, a11y/AXE pass, performance (game load < 2s, leaderboard ≤ 10s, dashboard < 3s), CSV import/export, booth long-running stability (poll survives Wi-Fi blips / server restarts; verified over a multi-hour session).
8. **Capacitor** — add iOS/Android platforms only when native packaging is required.

---

## 9. Key risks
- **Scoring ambiguity (decision #1)** is the top risk — it shapes schema, API, settings UI, and both `ScoringService`s. Resolve before step 2.
- **Client/server scoring drift** — mitigated by testing the Angular `ScoringService` against shared backend fixtures.
- **Leaderboard correctness** (timezone, reset, tie-breaks) is subtle — covered by dedicated unit tests.
- **Design gaps** (admin login, Reports, consent, reset/timezone + replay settings) must be designed before their build step, not discovered during it.
- **Booth uptime** — the screen runs unattended for hours. Mitigated by stateless polling (no socket to drop) + server-side leaderboard cache; if instant updates are ever needed, Reverb/Echo can be layered in later without changing the booth's render path.

---

## 10. Summary
Two codebases, three deployables, one rule: the server owns truth. Angular delivers a fast, accessible, signal-driven player experience; Laravel owns scoring, ranking, sponsor analytics, and the SSR admin. The plan front-loads the scoring engine and its tests because every other component depends on it, and it carries the 12 open decisions as explicit, config-isolated defaults so the audit's ambiguities never silently become bugs.

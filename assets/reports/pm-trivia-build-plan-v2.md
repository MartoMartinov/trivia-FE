# PM Trivia — Build Plan & Architecture Analysis (v2)

> **Date:** 2026-06-04
> **Version:** 2 — supersedes `pm-trivia-build-plan.md` (v1) for the **auth model only**. Everything else is carried forward unchanged.
> **Scope:** End-to-end build strategy for the Practical Machinist event-booth trivia platform — Angular/Ionic player app + Laravel SSR admin + shared Laravel API.
> **Inputs:** `specifications/spec.md`, the Figma wireframes, project rules in `CLAUDE.md` / `AGENTS.md`, the auth guide `assets/ignore/agents/BACKEND/LARAVEL.md`, the SignalStore convention guide `assets/ignore/agents/FRONTEND/ANGULAR/ngrx-signalstore.md`, and the findings in `pm-trivia-audit.md`.

## What changed from v1

v1 used a **single Sanctum bearer token persisted in `@capacitor/preferences`** for the player, with the same transport on web and native. v2 replaces that with the full token architecture from `LARAVEL.md` and a **platform-aware transport**:

- **Access token** (Sanctum PAT, ~30 min) lives **in memory only** on both platforms — never persisted.
- **Refresh token** (custom, hashed, ~30 days, rotated) is delivered **per platform**:
  - **Web** → `httpOnly; Secure; SameSite=None` cookie `refresh_token` (path `/api`), exactly as `LARAVEL.md` specifies. JS never sees it.
  - **Native (Capacitor)** → encrypted **capacitor-secure-storage** (iOS Keychain / Android Keystore), because httpOnly cookies are unreliable across native WebView origins.
- Silent re-auth on cold start via `/auth/refresh` (cookie on web, stored token on native).

The reasoning, mechanics, and backend changes are in **§4.7** and **§5.6**.

---

## 1. Executive summary

The platform is **three deployables on two codebases**:

1. **Player app** — Angular 21 + Ionic + Capacitor. Public, mobile-first. The only thing a visitor touches: register → play → results → leaderboard, plus the TV booth display.
2. **Admin site** — Laravel 12 server-side rendered (Livewire + Blade). Separate site, desktop-first, all sensitive management.
3. **API** — Laravel 12 JSON API (same Laravel install as the admin), Sanctum-authenticated, serving the Angular app.

The guiding principle is a hard **trust boundary**: all scoring, timing, answer-validation, and ranking happen on the Laravel server. The Angular client renders and reports; it never decides correctness or score. This is the direct lesson from the audit (the prototypes computed everything client-side).

```
┌────────────────────────┐   access token (Bearer, in-memory)   ┌──────────────────────────────┐
│  Player app (Angular)  │ ───────────────────────────────────► │           Laravel 12          │
│  Ionic + Capacitor     │ ◄─────────────────────────────────── │  routes/api.php  → API        │
│  WEB:    refresh cookie │     refresh: cookie (web) /          │  routes/web.php  → Admin SSR  │
│  NATIVE: secure-storage │              body (native)           │  Livewire + Blade (admin UI)  │
└────────────────────────┘                                      │  Fortify (admin auth)         │
                                                                 │  Sanctum PAT (access tokens)  │
┌────────────────────────┐              HTTPS / session         │  UserRefreshToken (rotation)  │
│  Admin browser         │ ───────────────────────────────────► │  MySQL · Queue · Mailer · SMS │
└────────────────────────┘                                      └──────────────────────────────┘
```

---

## 2. Confirmed technology stack (verified against npm, June 2026)

### Frontend
| Concern | Package | Version |
|---|---|---|
| Framework | `@angular/core` | 21.2.15 |
| UI components | `@ionic/angular` | 8.8.8 |
| Native shell | `@capacitor/core` / `android` / `ios` | 8.4.0 |
| **Secure token storage (native)** | **`capacitor-secure-storage`** (Keychain/Keystore) | latest — verify package at install |
| Non-sensitive prefs | `@capacitor/preferences` | latest |
| State | `@ngrx/signals` | 21.1.0 |
| Styling | `tailwindcss` | 4.3.0 |
| Language | `typescript` | 6.0.3 |

> **Secure-storage package:** the concrete plugin (e.g. `@aparajita/capacitor-secure-storage` or `capacitor-secure-storage-plugin`) is pinned at install time per `CLAUDE.md`. It must back onto **iOS Keychain** and **Android Keystore/EncryptedSharedPreferences** (encrypted at rest), expose an async `get/set/remove` API, and support Capacitor 8. `@capacitor/preferences` is retained **only for non-sensitive flags** — never tokens.

### Backend
| Concern | Package | Version |
|---|---|---|
| Framework | `laravel/framework` | 12 |
| Language | PHP | 8.5 |
| Admin auth | `laravel/fortify` | 1 |
| API access tokens | `laravel/sanctum` | latest |
| Refresh-token layer | **custom** (`UserRefreshToken` model + `user_refresh_tokens` table, SHA256-hashed, rotated) | app code |
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
| 13 | **Player auth lifetime** — how long a device stays silently logged in | refresh-token TTL, returning-player UX | **30-day** refresh token (matches `LARAVEL.md`); covers a multi-day event so a phone remembers the player |
| 14 | **Player identity on returning device** — passwordless re-auth via refresh token vs re-register | auth flow | Refresh token re-auths silently; re-register only if no/expired refresh token |

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
npm install capacitor-secure-storage   # exact package pinned at install (see §2)
```
Dev server at `http://localhost:8100`. Platforms are **not** added yet (`npx cap add` deferred per project rules). The secure-storage plugin has a web fallback for `ionic serve`, but the **real** web auth path is the httpOnly cookie (§4.7), so the plugin is exercised only when running native.

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
│   ├── auth/          AuthStrategy interface + WebAuthStrategy + NativeAuthStrategy (platform-aware)
│   ├── services/      api · scoring · leaderboard  (side-effects only, return Observables)
│   ├── interceptors/  auth.interceptor.ts (Bearer + withCredentials + 401 refresh-retry)
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
Every page and shared component is a `.ts` / `.html` / `.scss` trio (per the Angular rule that logic, template, and styles are separate files). **New in v2:** the `core/auth/` strategy layer (the only place that knows about cookies vs. secure storage).

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
| `AuthStore` | `root` | **accessToken (in-memory), accessExpiresAt, player** | `isAuthenticated`, `isAccessExpired` |
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
  | `refresh` (token) | `exhaustMap` | a single in-flight refresh; concurrent 401s await the same one (see §4.7) |

- **Booth + mobile both poll, no WebSockets.** Both `/leaderboard` (mobile) and `/booth-display` poll every ~10s via an rxjs `timer` → `switchMap`. No Echo, no reconnect logic; the server-side cache + `ETag`/`304` keep polling cheap and consistent across all viewers. Up to ~10s latency is invisible on a booth screen.
- **Derivations** live in `withComputed`, not components.
- **Scope is deliberate:** `GameStore` is route-scoped (listed in the `/game` route `providers`) so session state is destroyed on leave and cannot bleed into a replay; `AuthStore`/`PlayerStore` are root singletons.
- **Token persistence (v2, pitfall #5):** `AuthStore` holds **only the access token in memory** — never persisted, never in `localStorage`, never in a `withLocalStorage` effect. The **refresh** token is the only persisted credential and it never enters a store: on web it lives in the httpOnly cookie (invisible to JS); on native it lives in `capacitor-secure-storage` behind `NativeAuthStrategy`. So no secret is ever held in NgRx state or webview-readable storage.
- **`LeaderboardStore` uses plain arrays**, not `withEntities()` — rows are replaced wholesale each poll and never mutated individually.
- HTTP stays in `services/`/`auth/` (returns Observables); stores hold state and convert via `rxMethod`. The two layers are not merged.

### 4.6 Routing & guards
Lazy `loadComponent` per page. `authGuard` protects `/game`, `/sponsor`, `/results/:id`. `/play`, `/leaderboard` public; `/booth-display` public-but-token-gated via `?token=`. `authGuard` treats "no access token but a refresh credential exists" as **resolve-by-refresh**, not redirect (it awaits `AuthStore.refresh()` once before deciding).

### 4.7 Auth flow (player) — platform-aware (v2)

Built on the `LARAVEL.md` token architecture: a short-lived **Sanctum access token** (~30 min, in memory) plus a long-lived, rotating **refresh token** (~30 days). What differs by platform is **only how the refresh token is transported and stored** — the access-token usage is identical.

#### 4.7.1 The strategy abstraction
A single `AuthStrategy` interface, two implementations chosen once at startup via `Capacitor.isNativePlatform()`:

```ts
export interface AuthStrategy {
  /** Pull a fresh access token using the stored/cookie refresh credential. */
  refresh(): Observable<AccessTokenResponse>;
  /** Persist whatever this platform persists after login/register. */
  persistAfterLogin(res: LoginResponse): Promise<void>;
  /** Wipe the refresh credential on logout. */
  clear(): Promise<void>;
  /** HTTP options this platform needs (e.g. withCredentials on web). */
  readonly httpOptions: { withCredentials: boolean };
  readonly platformHeader: 'web' | 'native';
}
```

| Concern | `WebAuthStrategy` | `NativeAuthStrategy` |
|---|---|---|
| Refresh token storage | httpOnly cookie `refresh_token` (browser-managed; JS can't read it) | `capacitor-secure-storage` (Keychain / Keystore) |
| `persistAfterLogin` | **no-op** — server already `Set-Cookie`'d it | write `res.refreshToken` to secure storage |
| `refresh()` transport | `POST /auth/refresh` with `withCredentials: true` (cookie rides along) | `POST /auth/refresh` with `{ refreshToken }` read from secure storage |
| CSRF | needs Sanctum CSRF cookie + `X-XSRF-TOKEN` (stateful, cookie-based) | none (stateless bearer; no cookies) |
| `httpOptions` | `{ withCredentials: true }` | `{ withCredentials: false }` |

#### 4.7.2 Registration / login
1. Client sends `X-Client-Platform: web | native` on auth requests.
2. **Player registration is passwordless** (spec §3.2 — contact fields only); it issues the same access+refresh pair as a login. Admin / future authenticated users use the password + OAuth endpoints from `LARAVEL.md`.
3. Server response (see §5.6 for the branch):
   - **Access token + expiry** → JSON body (both platforms) → `patchState(AuthStore, …)` (memory only).
   - **Refresh token** → **web:** `Set-Cookie` httpOnly only (NOT in body); **native:** in JSON body → `NativeAuthStrategy` writes it to secure storage.

#### 4.7.3 Per-request
`authInterceptor`:
- attaches `Authorization: Bearer <AuthStore.accessToken()>` (read synchronously from the in-memory signal),
- merges `strategy.httpOptions` (so web sends `withCredentials`),
- sets `X-Client-Platform`,
- on **401**: pauses the request, triggers a **single** `AuthStore.refresh()` (concurrent 401s share the one in-flight refresh via a refresh lock/`shareReplay`), then **retries the original request once**. If refresh fails → `AuthStore.clear()` + route to `/play` (re-register).

#### 4.7.4 Cold start (silent re-auth)
`provideAppInitializer` → `AuthStore.bootstrap()` (must finish before guards/first request):
- **Web:** ensure CSRF cookie (`GET /sanctum/csrf-cookie`), then attempt `POST /auth/refresh` (cookie). Success → access token in memory (silent login). Failure → unauthenticated.
- **Native:** read refresh token from secure storage; if present → `POST /auth/refresh` (body). Success → access token in memory. Absent/expired → unauthenticated.

The access token is intentionally **never** persisted, so a reload/cold start always re-derives it from the refresh credential — one uniform model, with the cookie (web) and the secure store (native) playing the same role.

#### 4.7.5 Logout
`POST /auth/logout` (deletes the server-side refresh-token row + clears the cookie) → `strategy.clear()` (wipes secure storage on native) → `patchState(AuthStore, reset())`.

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
├── Models/                 Eloquent models + casts() methods (incl. UserRefreshToken)
├── Http/
│   ├── Controllers/Api/    thin API controllers → services (incl. AuthController)
│   ├── Controllers/Admin/  thin admin controllers → Livewire/Blade
│   ├── Middleware/         Localization · TestModeMarker · (resolve platform)
│   ├── Requests/           FormRequest per action (no inline validation)
│   └── Resources/          Eloquent API Resources (API responses)
├── Livewire/               admin UI components
├── Services/               ScoringService · LeaderboardService ·
│                           QuestionSelectionService · SponsorTrackingService · TokenService
├── Jobs/                   queued notifications (ShouldQueue)
└── Policies/               authorization
database/
├── migrations/  factories/  seeders/   (incl. personal_access_tokens, user_refresh_tokens)
resources/views/admin/      Blade layouts + Livewire views
```

### 5.2 Data model (per spec §10, all with factories + seeders)
`Player`, `GameSession`, `Question`, `QuestionChoice`, `Sponsor`, `GameAnswer`, `SponsorInteraction`, `AdminUser`, `MessageTemplate`, `GameSettings`, **`UserRefreshToken`** (`token` SHA256-hashed, `expires_at`, owner morph/FK, `created_at`). Each table built with `php artisan make:model -mfs`. `event_id` carried on session/settings for multi-event readiness. Casts defined in `casts()` methods. Column modifications restate all prior attributes (L12 rule).

### 5.3 Player API (`routes/api.php`, Sanctum)
Locale-prefixed per `LARAVEL.md` (`/api/{locale}/…`, e.g. `/api/en/…`); the `localization` middleware sets the locale.

```
# Auth (per LARAVEL.md, adapted for passwordless players)
POST /api/{locale}/auth/register        passwordless player registration → access token (+ refresh: cookie web / body native)
POST /api/{locale}/auth/login           email+password (admin / standard users)
POST /api/{locale}/auth/google|apple    Firebase-verified OAuth (standard users)
POST /api/{locale}/auth/refresh         NO auth header; reads refresh_token COOKIE (web) OR body/X-Refresh-Token (native); rotates
POST /api/{locale}/auth/logout          auth required; deletes refresh token + clears cookie
GET  /api/{locale}/auth/me              auth required; current profile
# password reset / profile endpoints per LARAVEL.md as needed

# Game
POST /api/{locale}/sessions/start          builds & locks the question set to the session
GET  /api/{locale}/sessions/{id}/questions returns questions WITHOUT correct answers
POST /api/{locale}/sessions/{id}/answers   validates server-side; returns correctness + points
POST /api/{locale}/sessions/{id}/complete  finalizes score + rank
GET  /api/{locale}/sessions/{id}/result    result metrics
GET  /api/{locale}/leaderboard?scope=      today | week, server-computed reset/timezone
GET  /api/{locale}/booth-display?token=    token-gated TV payload, polled ~10s; ETag → 304 when unchanged
```
All responses via API Resources; all inputs via FormRequests; rate limiting on register + session start + auth endpoints.

**Booth refresh (no WebSockets):** the booth polls `GET /api/{locale}/booth-display?token=` every ~10s — same `LeaderboardService` and payload as the mobile board. The computed leaderboard is **server-cached (~5–10s) and shared across all viewers**, and the endpoint returns an `ETag` so unchanged polls get a cheap `304`. Payload is display-only (rank, first name + last initial, company, score) — no email/phone. Polling is stateless and self-healing; Reverb/Echo can be added later without changing the booth's render path.

### 5.4 Core services
- **`ScoringService`** — single source of truth for the scoring formula (decision #1/#2). Mirrored, not trusted, by the frontend.
- **`QuestionSelectionService`** — selects N active questions per `GameSettings`, injects active sponsor questions within run dates, locks the set to the session at start (so mid-session settings changes don't apply).
- **`LeaderboardService`** — best daily score per player, tie-break (score → duration → streak → submission), configurable reset time + timezone, weekly aggregation.
- **`SponsorTrackingService`** — records every `SponsorInteraction` (`card_view`, `media_view`, `video_play`, `answer_correct/incorrect`, `website_click`) feeding the Reports screen.
- **`TokenService` (v2)** — the refresh-token engine from `LARAVEL.md`: issue access token (`$user->createToken()`, expiry from `SANCTUM_TOKEN_EXPIRY_MINUTES`), create/rotate `UserRefreshToken` (SHA256-hashed, expiry from `SANCTUM_REFRESH_TOKEN_EXPIRY_DAYS`), and **emit the refresh token in the transport the client asked for** — `Set-Cookie` (httpOnly/Secure/SameSite=None/path `/api`) for `web`, JSON body for `native`. On refresh: look up by hash, validate expiry, **delete the old token before issuing the new pair** (rotation prevents replay).

### 5.5 Admin SSR site (`routes/web.php`)
Livewire 3 + Blade + Alpine + Tailwind 4, behind Fortify auth. Screens (per spec §9 and the Figma nav): Login*, Dashboard, Questions, Edit Question, Players, Edit Player, Edit Sponsor, Game Settings, **Reports***, Templates, Admin Users, System Settings. (*Login and Reports are missing from the design — audit C2/H3 — and will be designed before build.)

Key Livewire components: `DashboardStats` (`wire:poll` 10s), `QuestionTable` (filter/sort/CSV import+export), `SponsorForm` (brand color, media upload, run dates, bonus config), `PlayerTable` (search + filter tabs + CSV), `SponsorReport` (date range + CSV), `TemplateEditor` (email/SMS + variable validation), `GameSettings` (session/streak/replay/reset/timezone — adding the controls missing from the wireframe, audit M3/M4), `SmtpSettings`/`TwilioSettings` (masked inputs + test send).

### 5.6 Auth & security (v2 — platform-aware token transport)

**Token architecture (from `LARAVEL.md`):**
- **Access token** — Sanctum Personal Access Token, expiry `SANCTUM_TOKEN_EXPIRY_MINUTES` (default **30 min**), returned in JSON body, validated by `auth:sanctum` on every protected route. Never assumed long-lived.
- **Refresh token** — `UserRefreshToken`, **SHA256-hashed in DB**, expiry `SANCTUM_REFRESH_TOKEN_EXPIRY_DAYS` (default **30 days**), **rotated** on every refresh (old row deleted before the new pair is issued).

**Platform-aware transport (the v2 change):**

| | Web (browser / PWA) | Native (Capacitor) |
|---|---|---|
| Access token | JSON body → client memory | JSON body → client memory |
| Refresh token out | `Set-Cookie` httpOnly; Secure; SameSite=None; path `/api` — **never in body** | JSON body → client secure storage — **no usable cookie** |
| Refresh token in (`/auth/refresh`) | read from `refresh_token` cookie | read from request body / `X-Refresh-Token` header |
| CSRF | **required** — Sanctum CSRF cookie + `X-XSRF-TOKEN` (stateful, cookie-bearing) | not applicable (stateless bearer, no cookies) |
| Branch trigger | `X-Client-Platform: web` | `X-Client-Platform: native` |

- The cookie flags (`httpOnly`, `Secure`, `SameSite=None`, path `/api`) are fixed per `LARAVEL.md` and must not be weakened. `EncryptCookies` covers the refresh cookie.
- **The raw refresh token is returned in the JSON body only for `native`** — unavoidable (no httpOnly option in a native WebView), and mitigated by storing it in the OS secure enclave (Keychain/Keystore, encrypted at rest). It is **never** in the body for `web`.
- OAuth (Google/Apple) verifies the Firebase ID token **server-side** before trusting identity; `is_active` checked on every login; password rule + min-age (13, parental consent < 18) per `LARAVEL.md` for password accounts.
- **CSRF strategy:** web auth is cookie-stateful → CSRF protected; native auth is bearer-stateless → exempt. The same `/auth/refresh` action serves both by resolving the token from cookie-or-body.

**Other security (carried from v1):** CSRF on all Blade admin forms; rate limiting on `/auth/*`, `/register`, `/sessions/start`; encrypted SMTP/Twilio credentials (config-only, never `env()` in app code); file-type/size validation on logo/media uploads; booth token; no public access to admin data; Fortify for admin login/reset/sessions (+ roles per decision #8).

### 5.7 Notifications & jobs
Queued jobs (`ShouldQueue`): daily winner, sponsor thank-you, play-again reminder, daily digest. Each respects the player's email/SMS toggles, consent status, and template active state. All sends logged.

### 5.8 CSV
Import validates every row and returns a per-row error report before persisting. Exports (players, today's leaderboard, sessions, sponsor reports, question performance) include event name + timestamp in the filename.

---

## 6. Shared contract (DTOs)
The Angular `core/models/api.models.ts` mirrors the API Resources exactly. Critical invariant: `QuestionDto` carries **no** correct answer; `SubmitAnswerResponse` is the only place correctness appears. `Difficulty` union includes `hard_plus` pending decision #3. `endsAt`/`resetsAt` are ISO strings computed server-side. **Auth DTOs (v2):** `LoginResponse { accessToken, accessExpiresAt, player, refreshToken? }` (`refreshToken` present only for `native`); `AccessTokenResponse { accessToken, accessExpiresAt }` from `/auth/refresh`.

---

## 7. Testing strategy
- **Backend (Pest 4):** feature tests against a real database for every API endpoint and every admin Livewire action; unit tests for `ScoringService` and `LeaderboardService` (tie-breaking, reset boundaries, sponsor bonus). **Auth (v2):** test both transports — `web` (refresh via cookie, CSRF enforced, no token in body) and `native` (refresh via body, token returned, no cookie reliance); token **rotation** (old refresh token rejected after use); access-token expiry → 401 → refresh-retry; logout deletes the refresh row. Factories + custom states; no mocked DB. `php artisan test --compact`.
- **Frontend (Angular, zoneless):** "Act → `await fixture.whenStable()` → Assert"; no `fixture.detectChanges()`; `useAutoTick()` for timers. Unit-test the mirrored `ScoringService` against backend fixtures to guarantee parity. Store tests for `GameStore` transitions. **Auth (v2):** test `WebAuthStrategy` vs `NativeAuthStrategy` selection; interceptor 401 → single-refresh → retry (and shared in-flight refresh under concurrent 401s); cold-start `bootstrap()` silent re-auth on each platform.
- **Formatting/CI:** `vendor/bin/pint --dirty --format agent` before finalizing PHP; Angular lint/format enforced.

---

## 8. Build sequencing
1. **Foundations** — Laravel install, schema + migrations + factories/seeders (incl. `personal_access_tokens`, `user_refresh_tokens`), `GameSettings`; resolve decisions #1–#7, #13–#14.
2. **Scoring core** — `ScoringService` + `LeaderboardService` + `QuestionSelectionService` with full Pest coverage (highest-risk logic first).
3. **Auth core (v2)** — `TokenService` + `AuthController` (register/login/refresh/logout/me), cookie-vs-body transport branch on `X-Client-Platform`, rotation, CSRF for web; full Pest coverage of both transports **before** any client work depends on it.
4. **Player API** — session → answer → complete → result → leaderboard, Sanctum, rate limiting, Resources, FormRequests. Booth/leaderboard payloads server-cached (~5–10s) with `ETag` support.
5. **Angular player app** — scaffold, stores, `AuthStrategy` layer + interceptor + `bootstrap()`, then pages in flow order (register → game → sponsor → results → leaderboard → booth), wired to the API; mirrored `ScoringService`. Booth + mobile leaderboard both poll ~10s (no WebSockets).
6. **Admin SSR** — Fortify auth + login, Dashboard, Questions/Sponsor, Players, Game Settings, Reports, Templates, System Settings.
7. **Notifications** — queued email/SMS jobs + template processing.
8. **Hardening** — security pass (incl. auth transport review: cookie flags, CSRF, secure-storage at rest, rotation/replay), a11y/AXE pass, performance (game load < 2s, leaderboard ≤ 10s, dashboard < 3s), CSV import/export, booth long-running stability.
9. **Capacitor** — add iOS/Android platforms; verify `capacitor-secure-storage` against real Keychain/Keystore and the native refresh path end-to-end (only when native packaging is required).

---

## 9. Key risks
- **Scoring ambiguity (decision #1)** is the top risk — it shapes schema, API, settings UI, and both `ScoringService`s. Resolve before step 2.
- **Client/server scoring drift** — mitigated by testing the Angular `ScoringService` against shared backend fixtures.
- **Leaderboard correctness** (timezone, reset, tie-breaks) is subtle — covered by dedicated unit tests.
- **Auth transport complexity (v2)** — two refresh paths (cookie vs secure-storage) double the auth surface. Mitigated by isolating the difference behind one `AuthStrategy` interface (client) and one cookie-or-body resolver in `/auth/refresh` (server), and by testing both transports explicitly. Risks to watch: web CSRF + `SameSite=None` cross-origin cookie setup, native WebView not sending cookies (by design — must use secure storage), and refresh-token rotation races under concurrent 401s (solved by a single shared in-flight refresh).
- **Native cold-start UX** — a returning player on native must re-auth from secure storage before the first guarded route; mitigated by awaiting `bootstrap()` in `provideAppInitializer`.
- **Design gaps** (admin login, Reports, consent, reset/timezone + replay settings) must be designed before their build step.
- **Booth uptime** — runs unattended for hours. Mitigated by stateless polling + server-side leaderboard cache.

---

## 10. Summary
Two codebases, three deployables, one rule: the server owns truth. v2 keeps that intact and upgrades auth to the `LARAVEL.md` token architecture with a **platform-aware transport** — short-lived in-memory access tokens everywhere, and a rotating refresh token delivered as an httpOnly cookie on web and stored in encrypted secure storage on native. The single `AuthStrategy` abstraction (client) and cookie-or-body resolver (server) keep that split from leaking into the rest of the app, so no secret ever lands in NgRx state or webview-readable storage, while web keeps its XSS-resistant httpOnly cookie and native gets a transport that actually works in a WebView.

# Security Audit — Practical Machinist Trivia

Scope: frontend (`trivia-app/`, this repo) + backend (`E:\Projects\pm-trivia-BE`).
Date: 2026-08-14

## Critical

### 1. Account takeover via re-registration
`pm-trivia-BE/app/Http/Controllers/Api/AuthController.php:54`

```php
$player = Player::updateOrCreate(['email' => $data['email']], [... 'password' => $data['password'] ...]);
```

`POST /auth/register` with an already-registered email **overwrites that player's password, name, phone and company**, then returns a valid session for them. There is no ownership proof — no email verification, no existing-password check. The phone guard above it only fires if the attacker reuses the victim's phone; supplying their own phone sails through. Anyone at the booth with a scanned QR token can take over any account whose email they know, and simultaneously destroy that player's PII record.

**Fix:** if the email already exists, require the password to match (i.e. treat it as a login) or reject with 409.

### 2. Debug mode on the staging deployment
`pm-trivia-BE/.env`

`APP_ENV=local`, `APP_DEBUG=true`, `LOG_LEVEL=debug`, with `APP_URL=https://backend.pm.trivia.kipo.work`. If that env is what the staging host runs, every unhandled error returns a Laravel debug page exposing stack traces, SQL, config and environment variables — including `APP_KEY` and the MySQL credentials that are also in this file.

**Fix:** confirm what's deployed; if it matches, set `APP_ENV=production`/`APP_DEBUG=false` and rotate `APP_KEY` and the DB password.

## High

### 3. Missing session ownership check on answer writes
`pm-trivia-BE/app/Http/Controllers/Api/AnswerController.php:22,43,68`

`SessionController` guards every session route with `authorizeSession()` (`SessionController.php:131`), but `AnswerController::store`, `sponsorAnswer` and `sponsorTrack` never call it, and `AnswerRecorder` doesn't check either. Sessions bind on `seq_id` — a small sequential integer (`AppServiceProvider.php:71`). So any registered player can POST answers into any other player's live session. Worse, `finalizeIfComplete()` (`AnswerController.php:105`) will then finalize the victim's session early, locking in a partial score and breaking their game.

**Fix:** add the same `authorizeSession()` check used elsewhere to all three `AnswerController` methods.

### 4. Score inflation — answers unbounded by session
`pm-trivia-BE/app/Services/Game/AnswerRecorder.php:23`

The only guard is "this question wasn't already answered in this session." There is no check that the question belongs to the session's snapshot, that the session is still `started`, or that the session's time window hasn't expired. A player can walk the question-id space and submit an answer to every question in the bank — including sponsor questions at the 3× bonus — long after their session finalized, and `final_score` (which drives the leaderboard and prize selection) keeps incrementing.

**Fix:** validate `questionId` against `settings_snapshot`'s question-id lists and the session's `status`/time window before recording.

### 5. Admin login and password reset are unthrottled
`pm-trivia-BE/routes/auth.php`

No `throttle` middleware on `POST /admin/login` or `POST /admin/forgot-password`, and `bootstrap/app.php` adds no default throttle to the `web` group. Unlimited password guessing against the admin panel, and unlimited reset-mail sending. The player API is carefully rate-limited (`AppServiceProvider.php:26-64`) — the admin panel just got missed.

**Fix:** apply `throttle:login`/a dedicated admin limiter to these routes.

### 6. Stored XSS in static pages
`pm-trivia-BE/app/Http/Controllers/Admin/SettingsController.php:207` + `trivia-app/src/app/pages/static-page/static-page.page.ts:49`

Backend "sanitizes" with `strip_tags($content, '<p><br>...<a>')`. `strip_tags` removes *tags*, not *attributes* — `<a href="javascript:...">` and `<p onclick="...">` both survive. The frontend then calls `bypassSecurityTrustHtml(page.content)` with no DOMPurify pass. (The register page does this correctly via `sanitizeAdminHtml`; the static page was missed.) Script running on the FE origin can read the in-memory access token and drive the API with the credentialed refresh cookie.

**Fix:** HTML Purifier (or similar attribute-aware sanitizer) server-side; run `sanitizeAdminHtml()` client-side on `static-page.page.ts` like the register page does.

## Medium

### 7. Game endpoints have no rate limit
`pm-trivia-BE/routes/api.php:63-68`

`questions/next`, `answers`, `sponsor-answer`, `sponsor-track`, `complete`, `result` carry no throttle at all. Amplifies #3 and #4, and lets the whole question bank be scraped with answers, since every answer response returns `correctIndex`.

### 8. Authorization policies are stubs and never invoked
`pm-trivia-BE/app/Policies/*.php` all `return true`, and no controller calls `authorize()`. Only the global routes are gated by `role:admin`; the per-event group in `routes/web.php` requires nothing beyond `auth:admin`. Any admin-guard user of any role can export the full player PII CSV, delete players, and edit sponsors and game settings for every event.

### 9. The registration QR gate is effectively public
`pm-trivia-BE/app/Http/Controllers/Api/BoothDisplayController.php:98` returns the live `registrationToken` from an unauthenticated endpoint. Booth display is intentionally token-free, so anyone who has the (publicly displayed) booth URL can mint `authPlayToken` values without being at the booth. Combined with #1, that is the remote path to account takeover.

### 10. Admin session cookie not marked Secure
`SESSION_SECURE_COOKIE` is unset, so `config/session.php`'s `'secure' => env('SESSION_SECURE_COOKIE')` is null. `CORS_ALLOWED_ORIGINS` also lists an `http://` origin.

### 11. CSV formula injection in admin exports
`PlayerController.php:207,238,245`, `DashboardController.php:43`, `ReportController.php:53`. Player-supplied `first_name`/`last_name`/`company` go straight into `fputcsv`; a name starting with `=`, `+`, `-` or `@` executes when the export is opened in Excel.

### 12. SVG upload allowed for sponsor logos
`StoreQuestionRequest.php:63` (`mimes:svg,png`); event logos use the `image` rule, which may also accept SVG. Media is served from the API origin at `/storage/media`, so an SVG opened directly is stored XSS on the origin that holds the refresh cookie.

### 13. Redux DevTools enabled in production builds
`trivia-app/src/app/app.config.ts` calls `provideStoreDevtools` unconditionally, exposing store state (including the access token) to any installed extension.

## Low / hardening

- `resubscribe()` sets both `email_opt_in` and `sms_opt_in` to true regardless of what the player originally consented to (`UnsubscribeController.php:34`) — a consent problem more than a security one.
- `game.debug_all_correct` (`AnswerRecorder.php:40`) makes every answer correct if the env var is ever set on a live host.
- Fortify is installed and auto-discovered with `Features::registration()` and `views => true` on the `admin` guard, but there's no app-level Fortify provider or `app/Actions` — verify `/register`, `/login` and `/user/*` aren't reachable on the admin host.
- No CSP or security headers on the frontend (`.htaccess` only rewrites; `index.html` sets none).
- Player passwords require only 6 characters (`AuthController.php:36`).
- `StaticPageController` returns any page id with no published/status check.

## What's solid

Refresh tokens are rotated and stored hashed; the reset flow uses `hash_equals` and a two-step code→token exchange with per-email+IP limits; unsubscribe links are HMAC capability tokens with a per-player signing key; integration settings are `encrypted:json`; the refresh cookie is httpOnly/Secure with a correct deletion counterpart; session finalization is row-locked; no SQL injection or unescaped Blade output found; landing copy goes through DOMPurify.

# Bug Report — "Too Many Attempts." blocks players who have not played today

**Date:** 2026-07-29
**Reported by:** Client (via Martin Martinov)
**Component:** Backend rate limiting (live/staging BE) + frontend error handling
**Severity:** High now — **Critical for event day** (see finding B)

---

## Symptom (as reported)

> I tried testing the trivia again today, and noticed that it said "too many attempts". I still
> haven't played for this day so I should be allowed.
>
> Also a coworker tried and she hasn't played since 2 weeks ago.

---

## Root cause

**Laravel's request throttler, not the play-limit / replay logic.**

The four hot API routes carry `throttle:10,1` — ten requests per minute
(`pm-trivia-BE/routes/api.php:21-28, 53`):

| Route | Limit | Bucket keyed by |
|---|---|---|
| `POST /auth/register` | 10 / min | **client IP** |
| `POST /auth/login` | 10 / min | **client IP** |
| `POST /auth/refresh` | 10 / min | **client IP** |
| `POST /sessions/start` | 10 / min | player id |

The three `/auth/*` routes are unauthenticated, so Laravel falls back to `$request->ip()` for the
rate-limiter key. **Everyone behind the same public IP shares one ten-per-minute bucket** — and
failed requests count too (401 invalid-credentials and 422 validation errors each consume a slot).

Once the bucket is empty the API answers `429` with Laravel's stock body, and the frontend prints
the backend `message` verbatim — so the player is told *"Too Many Attempts."*, which reads exactly
like a play-limit rejection even though no play-limit check ever ran.

### Reproduced on the live backend

```
POST https://backend.pm.trivia.kipo.work/api/en/auth/login   (bogus credentials)

attempt  1 -> HTTP 401 : {"message": "Invalid credentials."}
...
attempt 10 -> HTTP 401 : {"message": "Invalid credentials."}
attempt 11 -> HTTP 429 : {"message": "Too Many Attempts.",
                          "exception": "Illuminate\\Http\\Exceptions\\ThrottleRequestsException"}
attempt 12 -> HTTP 429 : {"message": "Too Many Attempts."}
```

Bucket keying verified empirically: 12 unauthenticated `POST /sessions/start` calls all returned
`401 Unauthenticated.` and never `429` → the `Authenticate` middleware runs *before*
`ThrottleRequests`, so `/sessions/start` is keyed per player while the `/auth/*` routes are keyed
per IP.

### Why both people were blocked without having played

1. Client and coworker are on the same office NAT → **same public IP → same bucket**. Ten submits
   in a minute between the two of them locks out everyone on that IP for 60 seconds, regardless of
   play history.
2. Compounding it: every cold app load fires `POST /auth/refresh`
   (`trivia-app/src/app/core/stores/auth/auth.store.ts:121-126`), which is also 10/min per IP. A
   first-time visitor with no refresh cookie still burns a slot on the resulting 401. When *that*
   call gets throttled, the interceptor treated it as a failed refresh, logged the user out and
   redirected to `/register` — dropping them onto the login form, which is itself throttled.
3. On native, `NativeAuthStrategy.refresh()` posted `refreshToken: null` when secure storage was
   empty — a guaranteed-401 network round trip that consumed a shared slot for nothing.

### Ruled out — the play-limit logic is innocent

- The play-limit message is different copy: `"You've used up your plays for today. Try tomorrow!"`
  (`pm-trivia-BE/lang/en/api.php:11`). The client did not see this.
- The live deploy **does** include commit `bf3316f` ("scope replay-block check to today"), so the
  coworker's two-week-old session cannot block her. Verified by route probe:
  `POST /api/en/unsubscribe` answers `"Invalid token."` *from the controller* (not
  route-not-found), and that route landed in `aad96a5`, which is newer than `bf3316f`.

### Where the raw message reaches the UI

The frontend contains no "too many attempts" string anywhere — it passes the backend message
straight through:

- `trivia-app/src/app/core/stores/auth/auth.store.ts:57-62, 84-89` — register / login
- `trivia-app/src/app/core/stores/game/game.store.ts:80, 104, 126` — start / answer / sponsor
- toasted at `register.page.ts:91-105` and `game.page.ts:78-91`

---

## Secondary findings (backend — not fixed in this pass)

### A. `APP_DEBUG=true` / `APP_ENV=local` on live 🔴

Every API error returns a full stack trace with absolute server paths
(`/home/trivia/public_html/trivia-backend/vendor/...`), visible in the probe output above.
Should be `APP_DEBUG=false`, `APP_ENV=production`.

### B. Cloudflare + no TrustProxies = one global bucket 🔴 **event-day blocker**

The production API host `practicalmachinist.com` sits behind **Cloudflare** (it currently returns a
CF interstitial for `/api/en/event-config`). `pm-trivia-BE/bootstrap/app.php` never calls
`$middleware->trustProxies(...)` and there is no `TrustProxies` class in `app/Http/Middleware/`.

Behind Cloudflare, `$request->ip()` returns the **Cloudflare edge IP**, so the per-IP bucket
collapses into **10 requests/minute for every player worldwide**. Staging (plain Apache, no CDN)
hides this — a fresh request there correctly gets its own bucket (`X-RateLimit-Remaining: 29`).

### C. 10/min per IP is far too tight for a trade-show booth 🟠

Even with correct client IPs, venue WiFi and mobile-carrier CGNAT put the whole crowd into one
bucket. At IMTS that caps the booth at **ten registrations per minute total**.

Suggested: keep strict brute-force protection on `login` keyed by **email + IP** (the named `login`
limiter already exists at `AppServiceProvider.php:24` but is applied to no route), and loosen the
pure-IP caps on `register` / `refresh` to ~60/min.

### D. `Retry-After` is not exposed through CORS 🟡

`pm-trivia-BE/config/cors.php` has `'exposed_headers' => []`, so a browser on a different origin
than the API cannot read `Retry-After` or `X-RateLimit-*`. The frontend fix below reads the header
when it is available (production is same-origin: FE and API both on `practicalmachinist.com`) and
degrades to a seconds-less message when it is not (staging FE → `backend.pm.trivia.kipo.work`).
Adding `'exposed_headers' => ['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']` makes
the countdown work everywhere. One-line change.

### E. `daily_reset_time` is dead config; replay gate uses UTC 🟡

`daily_reset_time` is migrated, seeded and admin-settable but **no query ever reads it**
(only written: `EventController.php:140`, `GameSettingsController.php:68`). The replay gate uses
`today()` = UTC midnight (`SessionController.php:50,57`, `AuthController.php:72,79`), while the play
window uses the event's own timezone (`Event::todaysPlayWindow`, `Event::isWithinDateRange`,
`config/app.php:71` = `'UTC'`).

For a Chicago event the UTC day rolls over at 19:00 local, so a player finishing after 7pm is
stamped as *tomorrow* and the following day's gate can misfire. Latent — not what bit the client
this time, but it is the same class of bug they described, so worth closing.

---

## Frontend fixes applied

Scope for this pass was frontend only. Backend findings A–E are left for the BE team.

### 1. Rate-limit-aware error mapping — new `core/http/api-error.ts`

Single helper used by every store that surfaces an API error:

- `isRateLimited(err)` — true for HTTP 429.
- `isAuthFailure(err)` — true only for 401 / 403. A 429, a 5xx or an offline browser is
  **transient**, not an expired session.
- `retryAfterSeconds(err)` — parses `Retry-After` (delay-seconds or HTTP-date form); returns `null`
  when the header is absent or hidden by CORS.
- `apiErrorMessage(err, translate)` — passes the backend message through unchanged, **except** for
  429, which becomes translated copy that names the real cause and, when the header is readable,
  the wait time. Translations load asynchronously over HTTP, and `translate.instant()` returns the
  *key* until they land — so the helper only uses its copy when both halves resolved, otherwise it
  falls back to the backend wording rather than putting `ERRORS.RATE_LIMITED_1` in front of a
  player.

### 2. Translated copy — new `ERRORS` block in `src/assets/i18n/en.json`

```
ERRORS.RATE_LIMITED_1          "Too many requests from your network right now."
ERRORS.RATE_LIMITED_2          "Please wait a moment and try again."
ERRORS.RATE_LIMITED_2_SECONDS  "Please wait {{seconds}} seconds and try again."
```

Wording deliberately says *"from your network"* — the limit is per IP, so a player who has not
played is not being accused of replaying.

### 3. A throttled refresh no longer destroys the session

- `core/interceptors/auth.interceptor.ts` — the post-refresh failure path now logs out and
  redirects to `/register` **only on a genuine auth failure (401/403)**. A 429 / network / 5xx
  refresh failure propagates the original error and leaves the session intact, so the player is no
  longer bounced onto a login form that is itself rate-limited.
- `core/stores/auth/auth.store.ts` — the cold-start `refresh()` clears auth state only on 401/403.
  A 429 now leaves the session untouched. It stays silent deliberately: that call fires unprompted
  at app start, and the throttle gets explained properly the moment the player submits something.

### 4. Stop wasting throttle slots on native

`core/auth/native-auth.strategy.ts` — when secure storage holds no refresh token, fail locally with
a synthetic 401 instead of POSTing `refreshToken: null` to the server. Removes one guaranteed-401
request per cold start from the shared per-IP bucket.

### 5. Stores now route through the helper

`auth.store.ts` (register / login / refresh) and `game.store.ts` (start / answer / sponsor answer)
replace their inline `err.error.message` reads with `apiErrorMessage(...)`. Page-level generic
fallbacks (`REGISTER.ERROR_GENERIC_*`, `GAME.START_ERROR_*`) are unchanged and still apply when the
backend sends no message.

---

## Optional frontend follow-up (not done)

The booth-display TV is token-free, but `AuthStore` is root-provided and the auth interceptor
injects it on every request, so its `onInit` hook fires `POST /auth/refresh` on the booth page too.
Each TV reload therefore spends one slot from the venue's shared bucket. Gating the cold-start
refresh on route would remove that, at the cost of putting route awareness inside a store — worth
doing only if the booth page turns out to reload often.

---

## Verification

- `429` reproduced and the exact string `"Too Many Attempts."` confirmed against the live backend.
- Throttle keying (per-IP vs per-player) confirmed by probing `/sessions/start` unauthenticated.
- Deployed backend version dated via the `/unsubscribe` route probe.
- Frontend: `npx tsc --noEmit -p tsconfig.app.json` clean, `ng build --configuration=staging`
  succeeds, `ng lint` reports no new problems (the one pre-existing `pm-header` selector-prefix
  error is untouched and unrelated).
- **Not** verified end-to-end in a browser against a throttled backend — the changed paths have no
  automated coverage either, since the project ships no `*.spec.ts` files. Worth one manual pass:
  trip the limiter (11 login submits inside a minute) and confirm the toast reads the new copy.
- No API contract changed, so nothing to mirror in the backend or mock-backend. The only optional
  backend enabler is finding D (`exposed_headers`), which upgrades the message from
  *"wait a moment"* to *"wait N seconds"* on cross-origin deployments.

# PM Trivia — Security Audit of Build Plan v2

> **Date:** 2026-06-04
> **Auditor:** Report-writer (architecture/threat review)
> **Subject:** `assets/reports/pm-trivia-build-plan-v2.md`
> **Nature:** This is a **design/architecture review** — there is no code yet. Findings are framed as controls to **enforce or verify at build time**. Severities reflect impact *if the control is missing or misimplemented*; several are "don't regress on a stated intent."
> **References:** `assets/ignore/agents/BACKEND/LARAVEL.md` (auth guide), spec §13–§14 (security/privacy).

---

## 1. Executive summary

The v2 auth model is **sound at the architectural level**: a hard server-side trust boundary, hashed + rotated refresh tokens, access tokens held in memory only, httpOnly cookies on web, OS secure storage on native, and a non-PII booth payload. These are the right primitives.

The risk is concentrated **not** in the token plumbing but in three areas the plan under-specifies:

1. **Passwordless identity** — re-auth by email alone is an account-takeover / PII-disclosure path.
2. **Object-level authorization** — session endpoints (`/sessions/{id}/*`) must enforce ownership or expose IDOR.
3. **Admin-supplied sponsor media** — a stored-XSS surface that, on web, defeats the httpOnly-cookie protection by *using* (not reading) the cookie.

Plus a set of standard-but-important transport/secrets controls (CORS-with-credentials, SameSite/CSRF topology, logout token revocation, refresh-token reuse detection, secrets-at-rest and in-logs).

**Counts:** 3 High · 9 Medium · 7 Low/Info.

---

## 2. Scope & method

In scope: the v2 auth flow (web + native transports), player API, booth display, admin SSR auth, secrets handling, and the privacy obligations the plan inherits from the spec. Method: threat-model the documented design against OWASP ASVS / API Security Top 10, RFC 6819 (refresh-token best practice), and the project's own guides, looking for missing controls and unstated assumptions.

Out of scope: implementation-level review (no code exists), infrastructure/host hardening, dependency CVEs.

---

## 3. Findings overview

| # | Severity | Area | Finding |
|---|---|---|---|
| F1 | **High** | AuthN / Privacy | Passwordless re-auth by email alone → impersonation & PII disclosure |
| F2 | **High** | AuthZ | IDOR risk on `/sessions/{id}/*` if ownership isn't enforced |
| F3 | **High** | XSS | Admin-supplied sponsor media/URLs are a stored-XSS surface; on web, XSS can *use* the httpOnly refresh cookie |
| F4 | Medium | Transport | CORS with credentials must be a strict allowlist (no `*`, no Origin reflection) |
| F5 | Medium | Transport | `SameSite=None` widens CSRF exposure; topology (same-origin vs cross-site) drives the safe choice |
| F6 | Medium | Session | Access token (Sanctum PAT) not revoked on logout — valid up to 30 min after |
| F7 | Medium | Session | No refresh-token **reuse detection** (replay of a rotated token should kill the family) |
| F8 | Medium | Game integrity | Answer submission needs server-side replay/idempotency (one answer per question per session) |
| F9 | Medium | Booth | Booth `?token=` should be a signed, expiring URL + `Referrer-Policy` + log scrubbing |
| F10 | Medium | Secrets | SMTP/Twilio credentials must be encrypted at rest (DB-stored via admin UI) |
| F11 | Medium | Logging | Tokens (Authorization header, refresh cookie, native refresh body) must be scrubbed from logs/errors |
| F12 | Medium | File upload | Sponsor logo/media uploads: block SVG/HTML, validate real MIME, serve with safe headers |
| F13 | Medium | Privacy | Consent capture + retention + delete/anonymize must be implemented (spec §14) |
| F14 | Low | Native | Secure-storage compromised on rooted/jailbroken device; consider biometric gating |
| F15 | Low | Session | No absolute session lifetime cap (30-day sliding refresh can persist indefinitely) |
| F16 | Low | AuthN | OAuth: validate Firebase token `aud`/`iss`/`exp`, not just signature |
| F17 | Low | Anti-automation | Rate-limit coverage should include `/answers`, forgotten-password, and booth polling |
| F18 | Low | Redirect | Sponsor website click — validate scheme, `rel="noopener noreferrer"`, avoid open redirect |
| F19 | Info | AuthZ | Admin: confirm role middleware on every route + mass-assignment guards |
| F20 | Info | Transport | Enforce HTTPS + HSTS (Secure cookie depends on it) |

---

## 4. Detailed findings

### F1 — Passwordless re-auth by email enables impersonation & PII disclosure  **[High]**
**Plan refs:** §4.7.2 (passwordless registration), decision #14 (re-auth via refresh token), spec §3.3 (email is primary identifier; "continue under the same profile").
**Risk:** If registration/“login” issues a valid session for *any* email with no proof of ownership, an attacker types a victim's email and — if the system links to the existing profile — gains access to that player's stored PII (`/auth/me`: name, phone, company) and history. Even without linking, it allows leaderboard impersonation and pollution. The spec collects real PII, so this is a disclosure issue, not just a game-fairness one.
**Recommendation:**
- Bind identity to the **device's refresh token**, not to the email. A fresh registration on a new device creates a *new* session that must **not** return another person's PII on email collision.
- To intentionally resume an existing profile across devices, require a **verification step** (email or SMS OTP) before linking — never link silently on email match.
- `/auth/me` and profile reads must scope strictly to the authenticated token's owner.
- Decide #14 with this constraint explicit.

### F2 — IDOR on session endpoints if ownership isn't enforced  **[High]**
**Plan refs:** §5.3 (`/sessions/{id}/answers|complete|result`), §4.8 (server-authoritative).
**Risk:** Sequential/guessable `{id}` plus no ownership check → a player reads/writes another player's session: submit answers into someone else's game, read another player's `result`, or finalize a foreign session.
**Recommendation:** A Laravel **policy/gate** on every `/sessions/{id}/*` asserting `session.player_id === auth()->id()` (and that the session belongs to the active event). Return 404 (not 403) to avoid confirming existence. Add a Pest feature test per endpoint for the cross-owner case. Prefer non-sequential IDs (UUID/ULID) for sessions as defense-in-depth.

### F3 — Stored XSS via sponsor media defeats the httpOnly cookie on web  **[High]**
**Plan refs:** §4.9 / spec §4 (sponsor logo, media image/video, brand color, website URL rendered in player app + booth), §5.6 (httpOnly refresh cookie).
**Risk:** Sponsor fields are admin-entered and rendered to the public player app and booth. If any is rendered unsafely (e.g. `bypassSecurityTrustHtml`, an `<img>`/`<video>` `src` or `style`/brand-color injected into the DOM, or an uploaded SVG), it becomes stored XSS. Critically, on web the httpOnly cookie only stops token *exfiltration* — an injected script can still call same-origin `POST /auth/refresh` (cookie auto-attached) to mint fresh access tokens and act as the user for as long as it runs. So httpOnly is necessary but **not sufficient**.
**Recommendation:**
- Strict **Content-Security-Policy** (no inline script; `img-src`/`media-src` allowlist; `default-src 'self'`). This is the primary mitigation for the cookie-use-under-XSS problem.
- Never bypass Angular's sanitizer for sponsor content. Treat brand-color as a validated hex token, not raw CSS. Treat media URLs as validated absolute http(s) URLs.
- See F12 for the upload side.

### F4 — CORS with credentials must be a strict allowlist  **[Medium]**
**Plan refs:** §4.7 (`withCredentials: true` on web), §5.6.
**Risk:** Credentialed cross-origin requests require `Access-Control-Allow-Credentials: true`. If `Access-Control-Allow-Origin` is `*`, reflects the request Origin, or includes an over-broad list, a malicious site can drive authenticated requests / read responses.
**Recommendation:** Explicit, environment-specific origin allowlist (the Angular app's exact origin[s]); never `*` with credentials; never reflect arbitrary Origin. Configure in Laravel `config/cors.php` and verify preflight handling for the auth routes.

### F5 — `SameSite=None` widens CSRF exposure; choose topology deliberately  **[Medium]**
**Plan refs:** §5.6 (cookie `SameSite=None`), §5.6 (CSRF for web).
**Risk:** `SameSite=None` sends the refresh cookie on cross-site requests, the precondition for CSRF. The plan mandates CSRF tokens for web — good — but `/auth/refresh` is called with *no* auth header and reads the cookie; confirm it is **also** CSRF-protected (or otherwise unforgeable), else a cross-site POST can force token rotation.
**Recommendation:**
- If the SPA and API can be served **same-origin** (API under `/api` via reverse proxy), use `SameSite=Lax`/`Strict` and drop the cross-site exposure entirely — strongly preferred.
- If cross-site is unavoidable (separate registrable domains), keep `SameSite=None; Secure`, enforce CSRF on every cookie-bearing state-changing route **including `/auth/refresh`**, and pair with the strict CORS allowlist (F4).
- Document which topology is chosen; it changes the cookie config.

### F6 — Access token not revoked on logout  **[Medium]**
**Plan refs:** §4.7.5 / §5.6 (logout deletes refresh token + clears cookie).
**Risk:** Sanctum access tokens are stateless-ish PATs valid until expiry. Deleting only the refresh token leaves the **current access token usable for up to ~30 min** after logout — meaningful if the token was captured (shared/kiosk device, F3).
**Recommendation:** On logout, also delete the current access token: `$request->user()->currentAccessToken()->delete()` (and consider `tokens()->delete()` for "log out everywhere"). Verify with a test that a post-logout access token returns 401.

### F7 — No refresh-token reuse detection  **[Medium]**
**Plan refs:** §5.4 `TokenService` (rotation: delete old before issuing new).
**Risk:** Rotation alone prevents a *used* token from working twice, but if a token is stolen and the attacker refreshes before the victim, the victim's next refresh fails silently and the attacker holds the family — with no signal. RFC 6819 best practice is **reuse detection**.
**Recommendation:** Keep a token-family/lineage id. If a refresh token that has already been rotated (consumed) is presented, treat it as compromise → **revoke the entire family** and force re-auth. Log the event for monitoring.

### F8 — Answer submission needs server-side replay/idempotency  **[Medium]**
**Plan refs:** §4.5 (client `exhaustMap`), §4.8 / §5.3 (`/answers` validates server-side).
**Risk:** Client-side `exhaustMap` is UX, not a control. Without server enforcement, a player could resubmit answers to the same question, submit out of order, or answer after `endsAt` to farm points.
**Recommendation:** Server enforces, per session: question is in the locked set, not already answered (unique `(session_id, question_id)`), session not expired (server clock), and session status `started`. Reject duplicates idempotently. Cover with tests (double-submit, late-submit, foreign-question).

### F9 — Booth token should be a signed, expiring URL  **[Medium]**
**Plan refs:** §5.3 (`booth-display?token=`), §5.6 ("booth token"), decision #10.
**Risk:** A static token in the URL leaks via access logs, proxy/CDN logs, browser history, and — because the booth renders external sponsor media — the `Referer` header to third-party origins. Data sensitivity is low (non-PII payload) but a non-expiring token is needlessly durable.
**Recommendation:** Use a Laravel **`temporarySignedRoute`** (HMAC-signed, expiring) minted by the admin "View on booth" action; add `Referrer-Policy: no-referrer` on the booth page; scrub the token param from access logs; `Cache-Control: no-store`. (Carried from the prior discussion; still unaddressed in v2.)

### F10 — SMTP/Twilio credentials encrypted at rest  **[Medium]**
**Plan refs:** §5.5 (`SmtpSettings`/`TwilioSettings` admin UI, masked inputs), §5.6 ("encrypted … never `env()`"), spec §9.12.
**Risk:** Admin-editable credentials live in the DB. If stored plaintext, a DB read (backup, SQLi, insider) leaks the ability to send mail/SMS as the org.
**Recommendation:** Laravel `encrypted` cast on those columns; decrypt only at send time; keep masked in the UI (already planned); ensure `APP_KEY` management/rotation is documented. "Send test" must not echo the secret back.

### F11 — Tokens must be scrubbed from logs and error reports  **[Medium]**
**Plan refs:** §4.7 (Bearer header; native refresh token in request body), §5.6.
**Risk:** Default request logging / exception capture can record the `Authorization` header, the `refresh_token` cookie, or the native refresh token in the JSON body — landing long-lived credentials in log storage.
**Recommendation:** Add these to Laravel's `$dontFlash`/log-sanitization and any APM/error-reporter scrubbers. Never log full request bodies on `/auth/*`. Verify the refresh cookie isn't logged by the web server.

### F12 — Harden sponsor file uploads  **[Medium]**
**Plan refs:** §5.6 (file-type/size validation), spec §4/§9.6 (logo + image/video upload).
**Risk:** Extension-only checks allow disguised payloads; **SVG** can carry script (feeds F3); user-controlled Content-Type enables sniffing attacks.
**Recommendation:** Validate **real MIME** (not extension); allowlist raster image + video types, **exclude SVG/HTML** (or sanitize SVG server-side); store outside the webroot / on a separate origin or CDN; serve with correct `Content-Type`, `X-Content-Type-Options: nosniff`, and `Content-Disposition` where appropriate; randomize stored filenames.

### F13 — Consent, retention, deletion/anonymization  **[Medium]**
**Plan refs:** decision #7, data model `consent_status` + `deleted_at/anonymized_at`, spec §14.
**Risk:** PII (name/email/phone/company) collected for marketing follow-up without enforced consent/retention is a compliance exposure.
**Recommendation:** Capture and persist consent at registration (timestamp + text version); implement the delete/anonymize path (spec requires the columns); define and enforce a retention window; gate notification sends on `consent_status` (already noted in §5.7 — verify it's enforced, not just modeled).

### F14 — Native secure-storage on compromised devices  **[Low]**
**Risk:** On rooted/jailbroken devices, Keychain/Keystore protections weaken; the refresh token could be extracted.
**Recommendation:** Accept as residual risk for a low-value player token; optionally enable biometric/passcode gating on the secure-storage entry for higher assurance. Consider lightweight root/jailbreak detection only if threat model warrants.

### F15 — No absolute session lifetime cap  **[Low]**
**Risk:** A 30-day refresh token rotated on each use can keep a device authenticated indefinitely.
**Recommendation:** Add an absolute max session age (e.g. issued-at + N days) independent of rotation; for a multi-day event, a tighter cap (event duration + buffer) is reasonable.

### F16 — Validate OAuth ID-token claims fully  **[Low]**
**Plan refs:** §5.6 (Firebase ID token verified server-side).
**Recommendation:** Beyond signature (RS256), validate `aud` (your Firebase project), `iss`, `exp`, and email-verified where relevant before trust. (Players are passwordless; this applies to the standard/admin OAuth paths from the guide.)

### F17 — Rate-limit coverage  **[Low]**
**Plan refs:** §5.3 (rate limiting on register/start/auth).
**Recommendation:** Extend throttling to `/answers` (anti-automation), `forgotten-password` (enumeration/email-bomb), and ensure the booth's 10s poll is allowlisted while still bounding abuse from the same token.

### F18 — Sponsor website click hygiene  **[Low]**
**Recommendation:** Validate the sponsor URL scheme (http/https only); open with `rel="noopener noreferrer"`; if click-through is tracked via a redirect endpoint, validate the target against the stored sponsor URL to avoid an open redirect.

### F19 — Admin authorization hygiene  **[Info]**
**Recommendation:** Confirm every `routes/web.php` admin route is behind auth + role middleware (decision #8); apply policies and mass-assignment guards (`$fillable`) on all admin CRUD; CSRF on Blade forms (already planned).

### F20 — Transport hardening  **[Info]**
**Recommendation:** Enforce HTTPS everywhere (the `Secure` cookie and Sanctum depend on it); enable HSTS; ensure TLS termination doesn't strip the `Secure`/`SameSite` attributes.

---

## 5. What the design already gets right

- **Server-authoritative trust boundary** — scoring/timing/ranking on the server; client never decides correctness (§4.8). This neutralizes the prototype's client-side-scoring class of cheats.
- **Refresh tokens hashed at rest + rotated** (§5.4) — limits DB-leak impact and single-use replay.
- **Access token in memory only, never persisted** (§4.5) — minimizes the persisted-secret surface; reload re-derives via refresh.
- **httpOnly cookie on web / OS secure storage on native** (§5.6) — the right per-platform primitive in each case; raw refresh token returned in-body only for native, where there's no alternative.
- **Booth payload is non-PII** (§5.3) — display-only fields, no email/phone on the wire; public-channel-safe.
- **Stateless polling** for booth/leaderboard with server-side cache + ETag — no socket attack surface, no reconnect-state bugs.
- **FormRequests + API Resources** everywhere — centralizes input validation and output shaping (helps F1/F3 if used consistently).

---

## 6. Prioritized remediation, mapped to build sequence

| When (v2 §8 step) | Do |
|---|---|
| **Step 1 (Foundations)** | F13 consent/retention columns enforced; UUID/ULID for sessions (F2); decide same-origin vs cross-site topology (F5). |
| **Step 3 (Auth core)** | F1 identity binding + verified profile-linking; F6 revoke access token on logout; F7 reuse detection; F4 CORS allowlist; F5 CSRF on `/auth/refresh`; F11 log scrubbing; F16 OAuth claims; F15 absolute cap. |
| **Step 4 (Player API)** | F2 session ownership policies; F8 answer replay/idempotency; F17 rate limits; F9 booth signed URL. |
| **Step 5 (Angular app)** | F3 strict CSP + no sanitizer bypass; F18 link hygiene. |
| **Step 6 (Admin SSR)** | F10 secrets encrypted at rest; F12 upload hardening; F19 admin authz hygiene. |
| **Step 8 (Hardening)** | F20 HTTPS/HSTS; F14 native device-compromise posture; full re-test of auth transports (both web + native), IDOR, replay, and XSS. |

---

## 7. Conclusion

v2's auth architecture is the right shape and its token primitives are correct. The audit found **no flaw in the token model itself**; the High-severity risks are in **adjacent controls** the plan leaves implicit — passwordless identity verification (F1), object-level authorization (F2), and sponsor-content XSS (F3) — each of which can undo the careful token design if shipped without the named control. Addressing F1–F3 in the auth/API build steps, and the Medium transport/secrets items alongside, would bring v2 to a solid posture for an event-booth deployment handling real PII.

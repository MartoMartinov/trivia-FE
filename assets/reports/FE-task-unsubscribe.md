# FE Task: Unsubscribe / Re-subscribe Pages

## Background

Every notification email sent to players will include an **unsubscribe link** in the footer.
Clicking that link must bring the player to a dedicated FE page where they can confirm the action.
No login is required — the link works via a secure token embedded in the URL.

After unsubscribing, the backend sends a confirmation email containing a **re-subscribe link**.
That link leads to a second FE page where the player can reverse the action.

Both pages must work without an authenticated session.

---

## Backend contract

### Tokens

Each player has a unique, stable `unsubscribe_token` (opaque string, 64 chars).
The backend embeds this token in email footer links that point to the FE:

```
{FE_BASE_URL}/unsubscribe?token={token}
{FE_BASE_URL}/resubscribe?token={token}
```

Note: no `{locale}` segment in the FE URL — the FE app has no locale-prefixed routing today (locale is a build-time/app-level concern, not part of the URL). The backend route/API call still includes `{locale}` (see below); the FE simply uses its own configured locale when calling the API.

The same token is used for both directions — it never changes unless explicitly regenerated.

---

### Endpoint 1 — Unsubscribe

```
POST /api/{locale}/unsubscribe
```

**Body**
```json
{ "token": "string" }
```

**Responses**

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `{ "message": "You have been unsubscribed." }` | Success — flags set to false, confirmation email sent |
| 404 | `{ "message": "Invalid token." }` | Token not found |

**Side effects (backend):**
- Sets `email_opt_in = false` and `sms_opt_in = false` for the player
- Sends a confirmation email to the player with a re-subscribe link

---

### Endpoint 2 — Re-subscribe

```
POST /api/{locale}/resubscribe
```

**Body**
```json
{ "token": "string" }
```

**Responses**

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `{ "message": "You have been re-subscribed." }` | Success — flags set to true |
| 404 | `{ "message": "Invalid token." }` | Token not found |

**Side effects (backend):**
- Sets `email_opt_in = true` and `sms_opt_in = true` for the player

---

## FE pages to implement


### Page 1 — `/unsubscribe`

**URL:** `/unsubscribe?token={token}`

**States:**

| State | Trigger | Content |
|-------|---------|---------|
| **Initial** | Page load | Explanation text + "Unsubscribe" button |
| **Loading** | Button clicked | Disable button, show spinner |
| **Success** | 200 from API | Confirmation message — no further action needed |
| **Invalid** | 404 from API | Error message: token not found or already used |
| **No token** | `token` param missing | Error message: link is invalid |

**UX notes:**
- Do **not** call the API automatically on page load — require explicit button click to prevent accidental unsubscribes triggered by email preview clients
- After success, do not redirect — keep the player on the page with the success message

**Suggested copy:**

```
Title:   Unsubscribe from notifications
Body:    You are about to unsubscribe from all email and SMS notifications
         sent by this platform. You can re-subscribe at any time.
Button:  Unsubscribe
Success: You have been successfully unsubscribed.
         A confirmation email has been sent to you with a link
         to re-subscribe if you change your mind.
Error:   This link is invalid or has already been used.
```

---

### Page 2 — `/resubscribe`

**URL:** `/resubscribe?token={token}`

**States:**

| State | Trigger | Content |
|-------|---------|---------|
| **Initial** | Page load | Explanation text + "Re-subscribe" button |
| **Loading** | Button clicked | Disable button, show spinner |
| **Success** | 200 from API | Confirmation message |
| **Invalid** | 404 from API | Error message |
| **No token** | `token` param missing | Error message: link is invalid |

**UX notes:**
- Same pattern as the unsubscribe page — explicit button click required
- After success, optionally show a link back to the main app

**Suggested copy:**

```
Title:   Re-subscribe to notifications
Body:    Click below to re-subscribe to email and SMS notifications
         from this platform.
Button:  Re-subscribe
Success: You have been successfully re-subscribed.
         You will now receive notifications again.
Error:   This link is invalid or has already been used.
```

---

## Locale

The FE routes themselves carry no `{locale}` segment (e.g. just `/unsubscribe?token=...`).
The `{locale}` segment only exists on the backend API call — use the app's current/configured
locale (same source the rest of the app already uses to build API URLs) when calling:

```
POST /api/bg/unsubscribe
POST /api/en/unsubscribe
```

The backend will respond and send emails in the matching language.

---

## Expected result

| Scenario | Result |
|----------|--------|
| Player clicks unsubscribe link in email (FE_BASE_URL points to `/unsubscribe`, no locale in FE URL) | `/unsubscribe?token=...` page loads |
| Player clicks "Unsubscribe" button | API call → success → confirmation shown |
| Player receives confirmation email, clicks re-subscribe link | `/resubscribe?token=...` page loads |
| Player clicks "Re-subscribe" button | API call → success → player is re-subscribed |
| Token is missing or invalid | Error message shown, no API call made (or graceful API error handled) |

---

## Security considerations

The token-in-URL model (a stable, opaque, reusable bearer token mailed to the player) is the
standard "capability URL" pattern used by most email platforms (Mailchimp, SendGrid, Postmark,
etc.) for unsubscribe/resubscribe flows, and is appropriate here since the blast radius is low
(a notification preference toggle, not account access or PII exposure). Requiring an explicit
button click rather than acting on page load is already load-bearing: email clients and security
scanners (Outlook Safe Links, corporate proxies, antivirus) routinely pre-fetch every link in an
email via GET, and would silently trigger the action for every recipient if it fired on page load.

Additional hardening worth confirming with backend before/while implementing:

- **Referrer leakage** — if either page loads any third-party resource (analytics, fonts, ads)
  via absolute URL, the browser's `Referer` header can leak the full URL, including the token, to
  that third party. Set `Referrer-Policy: no-referrer` (or at least `same-origin`) on both pages.
- **Access logs** — query strings are typically logged verbatim by servers/CDNs/proxies, so the
  token can end up sitting in log aggregation (Datadog, CloudWatch, etc.) indefinitely. Confirm
  whether logs are scrubbed for these routes, or accept it as a tradeoff.
- **Rate limiting** — no rate limiting is specified. Even with a large token keyspace, the
  endpoint should throttle repeated 404s from the same IP as defense-in-depth.
- **Token storage** — confirm the backend stores a hash of the token rather than the raw value,
  so a database leak doesn't directly hand out working unsubscribe/resubscribe links.
- **Token generation** — confirm the 64-char token is generated via a CSPRNG (not sequential or
  otherwise guessable), since the security of the whole model rests on that assumption.

import { HttpErrorResponse } from '@angular/common/http';
import type { TranslateService } from '@ngx-translate/core';

const RATE_LIMITED = 429;

/** True when the API rejected the call because the rate limiter's bucket is empty. */
export function isRateLimited(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === RATE_LIMITED;
}

/**
 * True only for a genuine credentials/session rejection. Everything else a request can fail
 * with — a 429 from the shared per-IP throttle, a 5xx, an offline browser — is transient and
 * must not be mistaken for an expired session.
 */
export function isAuthFailure(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403);
}

/**
 * Seconds to wait, from the `Retry-After` header (both the delay-seconds and the HTTP-date form).
 * Null when the header is missing — or when it is present on the wire but hidden from JS because
 * the response is cross-origin and the API doesn't list it in CORS `exposed_headers`. Callers must
 * therefore treat a missing value as "unknown wait", not "no wait".
 */
export function retryAfterSeconds(err: unknown): number | null {
  if (!(err instanceof HttpErrorResponse)) return null;

  const raw = err.headers?.get('Retry-After');
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));

  const until = Date.parse(raw);
  if (Number.isNaN(until)) return null;

  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/** ngx-translate hands back the key itself until the language file has loaded over HTTP. */
function translated(translate: TranslateService, key: string, params?: object): string | null {
  const value: unknown = translate.instant(key, params);
  return typeof value === 'string' && value !== key ? value : null;
}

/**
 * The message to show for a failed API call.
 *
 * Backend messages are passed through as-is — they are already player-facing copy. The exception
 * is 429: Laravel's stock "Too Many Attempts." reads like a play-limit rejection, so a player who
 * hasn't played today is left thinking they've been locked out of the game. The limiter buckets
 * the auth endpoints per IP, so it fires on whoever shares the network — hence the wording about
 * the network rather than about the player.
 *
 * Returns null when there is nothing useful to say, letting the caller fall back to its own copy.
 */
export function apiErrorMessage(err: unknown, translate: TranslateService): string | null {
  if (isRateLimited(err)) {
    const seconds = retryAfterSeconds(err);
    const first = translated(translate, 'ERRORS.RATE_LIMITED_1');
    const second = seconds !== null
      ? translated(translate, 'ERRORS.RATE_LIMITED_2_SECONDS', { seconds })
      : translated(translate, 'ERRORS.RATE_LIMITED_2');

    // Both halves or neither — a half-loaded language file would put raw keys in front of the
    // player, so fall through to the backend's own wording instead.
    if (first && second) return `${first}\n${second}`;
  }

  return (err as { error?: { message?: string } })?.error?.message ?? null;
}

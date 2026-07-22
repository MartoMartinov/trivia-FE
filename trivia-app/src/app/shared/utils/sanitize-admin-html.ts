import type { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify, { type Config } from 'dompurify';

// Angular's own [innerHTML] sanitizer strips the `style` attribute unconditionally (it has
// no allowlist for it), so admin-configured inline colors never reach the DOM. DOMPurify still
// strips dangerous CSS (expression(), url(), behavior, etc.) and all scripts/handlers, so the
// result is safe to mark trusted and hand straight to Angular.
const PURIFY_CONFIG: Config = { ADD_ATTR: ['style'] };

/** Sanitizes admin-authored HTML (e.g. landingHeadline/landingBody) so `style` attributes survive. */
export function sanitizeAdminHtml(sanitizer: DomSanitizer, html: string | null): SafeHtml | null {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, PURIFY_CONFIG);
  return sanitizer.bypassSecurityTrustHtml(clean);
}

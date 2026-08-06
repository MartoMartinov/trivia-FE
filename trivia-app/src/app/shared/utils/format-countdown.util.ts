/**
 * Formats the time remaining until an ISO instant as "Xd Yh", "Xh Ym", or "Xm" —
 * whichever two units are coarsest, so a week-scope reset reads in days/hours and a
 * daily reset reads in hours/minutes. Empty once the instant has passed or is unknown.
 */
export function formatCountdown(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';

  const diffMs = target - now;
  if (diffMs <= 0) return '';

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1 min';
}

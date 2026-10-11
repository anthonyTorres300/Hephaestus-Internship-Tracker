export const AUTO_REFRESH_AFTER_HOURS = 6;

// True when the catalog has never refreshed or its last successful refresh is older than `maxHours`.
export function isStale(lastSuccessIso: string | null | undefined, maxHours = AUTO_REFRESH_AFTER_HOURS, now: Date = new Date()): boolean {
  if (!lastSuccessIso) return true;
  return now.getTime() - new Date(lastSuccessIso).getTime() > maxHours * 3600_000;
}

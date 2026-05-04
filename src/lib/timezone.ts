const FALLBACK_TZ = "Europe/Oslo";
const DEFAULT_LOCALE = "en-GB";

export function formatTime(
  date: string | Date,
  timezone: string = FALLBACK_TZ,
  locale: string = DEFAULT_LOCALE
): string {
  return new Date(date).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
}

export function formatDate(
  date: string | Date,
  timezone: string = FALLBACK_TZ,
  options?: Intl.DateTimeFormatOptions,
  locale: string = DEFAULT_LOCALE
): string {
  return new Date(date).toLocaleDateString(locale, {
    timeZone: timezone,
    ...options,
  });
}

export function formatDateTime(
  date: string | Date,
  timezone: string = FALLBACK_TZ,
  options?: Intl.DateTimeFormatOptions,
  locale: string = DEFAULT_LOCALE
): string {
  return new Date(date).toLocaleString(locale, {
    timeZone: timezone,
    ...options,
  });
}

// Returns "YYYY-MM-DD" for a given date interpreted in the given timezone.
export function toDateString(date: string | Date, timezone: string = FALLBACK_TZ): string {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: timezone });
}

// Returns a local Date whose calendar date (day/month/year) matches today in the given timezone.
// Used to seed date pickers and strips so they start on the correct studio date.
export function todayInTimezone(timezone: string = FALLBACK_TZ): Date {
  const [y, m, d] = toDateString(new Date(), timezone).split("-").map(Number);
  return new Date(y, m - 1, d);
}

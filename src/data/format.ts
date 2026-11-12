const LOCALE = "es-PE";
const LIMA = "America/Lima";

const number = new Intl.NumberFormat(LOCALE);
const longDate = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" });
const time = new Intl.DateTimeFormat(LOCALE, {
  hour: "numeric",
  minute: "2-digit",
  timeZone: LIMA,
});
const stamp = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: LIMA,
});

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export const formatNumber = (value: number) => number.format(value);
export const formatDate = (date: string) => longDate.format(utc(date));
export const formatShortDate = (date: string) => shortDate.format(utc(date));
export const formatWeekday = (date: string) => weekday.format(utc(date));
export const formatDateRange = (start: string, end: string) =>
  longDate.formatRange(utc(start), utc(end));
export const formatTimeLima = (instant: string) => time.format(new Date(instant));
export const formatStamp = (instant: string) => `${stamp.format(new Date(instant))} (hora de Lima)`;

export function formatLocalTime(instant: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: instant.slice(-6),
  }).format(new Date(instant));
}

const decimal = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });
export const formatDecimal = (value: number) => decimal.format(value);
export const formatPercent = (value: number) => percent.format(value);

const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (value: number) => compact.format(value);

export const isLimaOffset = (instant: string) => instant.slice(-6) === "-05:00";

const limaDate = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: LIMA,
});
export const formatDateLima = (instant: string) => limaDate.format(new Date(instant));

import type { BudgetClaim, Claim } from "./types.ts";

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

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export const formatNumber = (value: number) => number.format(value);
export const formatDate = (date: string) => longDate.format(utc(date));
export const formatShortDate = (date: string) => shortDate.format(utc(date));
export const formatWeekday = (date: string) => weekday.format(utc(date));
export const formatTimeLima = (instant: string) => time.format(new Date(instant));

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
const signedPercent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
export const formatDifference = (value: number) => signedPercent.format(value);
export const formatDecimal = (value: number) => decimal.format(value);
export const formatPercent = (value: number) => percent.format(value);
export const formatChance = (value: number) =>
  value > 0 && value < 0.005 ? "<1 %" : formatPercent(value);

const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (value: number) => compact.format(value);

const money = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const moneyNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
export const formatMoney = (value: number) => money.format(value);
export const formatMoneyCompact = (value: number) =>
  Math.abs(value) < 1e6 ? money.format(value) : `USD ${moneyNumber.format(value / 1e6)} M`;

export const claimLabel = (claim: Claim | BudgetClaim) => {
  const amount =
    "amount" in claim
      ? formatMoney(claim.amount)
      : `${formatMoney(claim.low)}${claim.high !== undefined ? ` – ${formatMoney(claim.high)}` : ""}`;
  const basis = "basis" in claim && claim.basis ? (claim.basis === "gross" ? "bruto" : "neto") : "";
  return basis ? `${amount} (${basis})` : amount;
};

export const isLimaOffset = (instant: string) => instant.slice(-6) === "-05:00";

const limaDate = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: LIMA,
});
export const formatDateLima = (instant: string) => limaDate.format(new Date(instant));

// Peruvian abbreviations, without the dots Intl adds, for mono labels.
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const limaDay = new Intl.DateTimeFormat("en-CA", { timeZone: LIMA });

function compactParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year!, dayMonth: `${day} ${MONTHS[month! - 1]}` };
}

/** "30 ene – 22 nov 2026", with the year on both ends when they differ. */
export function formatCompactRange(start: string, end: string): string {
  const from = compactParts(start);
  const to = compactParts(end);
  const head = from.year === to.year ? from.dayMonth : `${from.dayMonth} ${from.year}`;
  return `${head} – ${to.dayMonth} ${to.year}`;
}

export function formatCompactDateLima(instant: string): string {
  const { year, dayMonth } = compactParts(limaDay.format(new Date(instant)));
  return `${dayMonth} ${year}`;
}

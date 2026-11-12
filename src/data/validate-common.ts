export type Obj = Record<string, unknown>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
export const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);

export function isDate(v: unknown): v is string {
  return (
    typeof v === "string" && DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)
  );
}

export function isInstant(v: unknown): v is string {
  return typeof v === "string" && INSTANT.test(v) && !Number.isNaN(Date.parse(v));
}

export function isHttps(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export interface Report {
  errors: string[];
  fail: (path: string, message: string) => void;
  source: (value: unknown, path: string) => void;
}

export function createReport(): Report {
  const errors: string[] = [];
  const fail = (path: string, message: string) => {
    errors.push(`${path}: ${message}`);
  };
  const source = (value: unknown, path: string) => {
    if (!isObj(value)) return fail(path, "must be an object with outlet and url");
    if (!isText(value.outlet)) fail(`${path}.outlet`, "must be a non-empty string");
    if (!isHttps(value.url)) fail(`${path}.url`, "must be an https URL");
  };
  return { errors, fail, source };
}

export function validateBase(data: Obj, { fail }: Report) {
  for (const key of ["title", "summary", "method"] as const) {
    if (!isText(data[key])) fail(key, "must be a non-empty string");
  }
  if (!isDate(data.start)) fail("start", "must be a date, YYYY-MM-DD");
  if (!isDate(data.end)) fail("end", "must be a date, YYYY-MM-DD");
  if (isDate(data.start) && isDate(data.end) && data.start > data.end)
    fail("end", "must not be before start");
  if (!Array.isArray(data.places) || data.places.length === 0 || !data.places.every(isText)) {
    fail("places", "must be a non-empty list of strings");
  }
  if (!isInstant(data.updated))
    fail("updated", "must be a timestamp with an offset, YYYY-MM-DDTHH:MM-05:00");
}

export function insideDates(data: Obj, instant: string): boolean {
  if (!isDate(data.start) || !isDate(data.end)) return true;
  const day = instant.slice(0, 10);
  return day >= data.start && day <= data.end;
}

import type { EventData } from "./types.ts";

type Obj = Record<string, unknown>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

function isDate(v: unknown): v is string {
  return (
    typeof v === "string" && DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)
  );
}

function isInstant(v: unknown): v is string {
  return typeof v === "string" && INSTANT.test(v) && !Number.isNaN(Date.parse(v));
}

function isHttps(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateSlug(slug: string): string[] {
  return SLUG.test(slug) ? [] : [`slug "${slug}": use lowercase words joined by hyphens`];
}

export function validateEvent(data: unknown): string[] {
  const errors: string[] = [];
  const fail = (path: string, message: string) => errors.push(`${path}: ${message}`);

  function source(value: unknown, path: string) {
    if (!isObj(value)) return fail(path, "must be an object with outlet and url");
    if (!isText(value.outlet)) fail(`${path}.outlet`, "must be a non-empty string");
    if (!isHttps(value.url)) fail(`${path}.url`, "must be an https URL");
  }

  if (!isObj(data)) return ["event: must be an object"];

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

  if (!Array.isArray(data.acts) || data.acts.length === 0) {
    fail("acts", "must be a non-empty list");
  } else {
    data.acts.forEach((act: unknown, i) => {
      const path = `acts[${i}]`;
      if (!isObj(act)) return fail(path, "must be an object");
      for (const key of ["country", "city", "venue", "name"] as const) {
        if (!isText(act[key])) fail(`${path}.${key}`, "must be a non-empty string");
      }
      if (!isInstant(act.start)) {
        fail(`${path}.start`, "must be a local time with an offset, YYYY-MM-DDTHH:MM-03:00");
      } else if (isDate(data.start) && isDate(data.end)) {
        const day = act.start.slice(0, 10);
        if (day < data.start || day > data.end)
          fail(`${path}.start`, "falls outside the event dates");
      }

      if (act.status === "held") {
        const { low, central, high } = act;
        for (const key of ["low", "central", "high"] as const) {
          if (!isCount(act[key])) fail(`${path}.${key}`, "must be a non-negative integer");
        }
        if (
          isCount(low) &&
          isCount(central) &&
          isCount(high) &&
          !(low <= central && central <= high)
        ) {
          fail(path, `low <= central <= high does not hold (${low}, ${central}, ${high})`);
        }
        if (!isText(act.attribution)) fail(`${path}.attribution`, "must say who gave each figure");
        if (!Array.isArray(act.sources) || act.sources.length === 0) {
          fail(`${path}.sources`, "a held act needs at least one source");
        } else {
          act.sources.forEach((s: unknown, j) => source(s, `${path}.sources[${j}]`));
        }
        if ("expected" in act) fail(`${path}.expected`, "a held act has no expected figure");
      } else if (act.status === "planned") {
        for (const key of ["low", "central", "high", "attribution", "sources"]) {
          if (key in act) fail(`${path}.${key}`, "a planned act has no figures");
        }
        if ("expected" in act) {
          const expected = act.expected;
          if (!isObj(expected)) return fail(`${path}.expected`, "must be an object");
          if (!isCount(expected.figure) || expected.figure === 0) {
            fail(`${path}.expected.figure`, "must be a positive integer");
          }
          if (!isText(expected.attribution))
            fail(`${path}.expected.attribution`, "must say who expects it");
          source(expected.source, `${path}.expected.source`);
        }
      } else {
        fail(`${path}.status`, 'must be "planned" or "held"');
      }
    });
  }

  if ("comparison" in data) {
    if (!Array.isArray(data.comparison)) {
      fail("comparison", "must be a list");
    } else {
      data.comparison.forEach((row: unknown, i) => {
        const path = `comparison[${i}]`;
        if (!isObj(row)) return fail(path, "must be an object");
        if (!isText(row.label)) fail(`${path}.label`, "must be a non-empty string");
        if (!isCount(row.figure) || row.figure === 0)
          fail(`${path}.figure`, "must be a positive integer");
        if (!isText(row.attribution)) fail(`${path}.attribution`, "must say who gave the figure");
        source(row.source, `${path}.source`);
      });
    }
  }

  return errors;
}

export function assertEvent(slug: string, data: unknown): EventData {
  const errors = [...validateSlug(slug), ...validateEvent(data)];
  if (errors.length > 0)
    throw new Error(`data/events/${slug}.json is invalid:\n${errors.join("\n")}`);
  return data as EventData;
}

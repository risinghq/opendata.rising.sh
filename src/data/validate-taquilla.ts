import {
  isCount,
  isDate,
  isHttps,
  isObj,
  isText,
  type Obj,
  type Report,
} from "./validate-common.ts";

const FIGURES = ["opening", "usCanada", "worldwide"] as const;

function figure(
  item: Obj,
  key: string,
  path: string,
  { fail, source }: Report,
): number | undefined {
  const value = item[key];
  if (!isObj(value)) {
    fail(`${path}.${key}`, "must be an object with amount and source");
    return undefined;
  }
  if (!isCount(value.amount)) fail(`${path}.${key}.amount`, "must be a non-negative integer");
  source(value.source, `${path}.${key}.source`);
  return isCount(value.amount) ? value.amount : undefined;
}

export function validateTaquilla(data: Obj, report: Report) {
  const { fail, source } = report;

  const origin = data.source;
  if (!isObj(origin)) {
    fail("source", "must be an object");
  } else {
    source(origin, "source");
    if (!isCount(origin.revision) || origin.revision === 0)
      fail("source.revision", "must be a positive integer");
    if (!isDate(origin.revisionDate)) fail("source.revisionDate", "must be a date");
    if (!isText(origin.license)) fail("source.license", "must name the licence");
    if (
      isHttps(origin.url) &&
      isCount(origin.revision) &&
      !String(origin.url).endsWith(`oldid=${origin.revision}`)
    )
      fail("source.url", "must be the permanent link, ending in ?oldid=<revision>");
  }

  if (!Array.isArray(data.films) || data.films.length === 0) {
    return fail("films", "must be a non-empty list");
  }
  const titles = new Set<string>();
  const releases = new Map<string, string>();
  let previous = "";
  data.films.forEach((film: unknown, i) => {
    const path = `films[${i}]`;
    if (!isObj(film)) return fail(path, "must be an object");
    if (!isText(film.title)) {
      fail(`${path}.title`, "must be a non-empty string");
    } else if (titles.has(film.title)) {
      fail(`${path}.title`, `"${film.title}" is used twice`);
    } else {
      titles.add(film.title);
    }
    if (!isText(film.originalTitle)) fail(`${path}.originalTitle`, "must be a non-empty string");
    if (film.note !== undefined && !isText(film.note))
      fail(`${path}.note`, "must be a non-empty string");
    if (!isCount(film.phase) || film.phase === 0)
      fail(`${path}.phase`, "must be a positive integer");
    if (!isDate(film.release)) {
      fail(`${path}.release`, "must be a date, YYYY-MM-DD");
    } else if (previous && film.release <= previous) {
      fail(`${path}.release`, "must be in order of release");
    } else {
      previous = film.release;
    }

    const budget = film.budget;
    if (budget !== undefined) {
      if (!isObj(budget)) {
        fail(`${path}.budget`, "must be an object with low and source");
      } else {
        if (!isCount(budget.low)) fail(`${path}.budget.low`, "must be a non-negative integer");
        if (budget.high !== undefined && !isCount(budget.high))
          fail(`${path}.budget.high`, "must be a non-negative integer");
        if (isCount(budget.low) && isCount(budget.high) && budget.high < budget.low)
          fail(`${path}.budget.high`, "must not be below low");
        source(budget.source, `${path}.budget.source`);
      }
    }

    if (film.status === "released") {
      const amounts = FIGURES.map((key) => figure(film, key, path, report));
      const [opening, usCanada, worldwide] = [amounts[0], amounts[1], amounts[2]];
      if (opening !== undefined && usCanada !== undefined && opening > usCanada)
        fail(`${path}.opening.amount`, "must not exceed the US and Canada gross");
      if (usCanada !== undefined && worldwide !== undefined && worldwide < usCanada)
        fail(`${path}.worldwide.amount`, "must be at least the US and Canada gross");
    } else if (film.status === "unreleased") {
      for (const key of FIGURES) {
        if (key in film) fail(`${path}.${key}`, "an unreleased film has no grosses");
      }
    } else {
      fail(`${path}.status`, 'must be "released" or "unreleased"');
    }
    if (isText(film.title) && isDate(film.release)) releases.set(film.title, film.release);
  });

  if (data.projections === undefined) return;
  if (!Array.isArray(data.projections)) return fail("projections", "must be a list");
  data.projections.forEach((row: unknown, i) => {
    const path = `projections[${i}]`;
    if (!isObj(row)) return fail(path, "must be an object");
    const release = isText(row.film) ? releases.get(row.film) : undefined;
    if (release === undefined) fail(`${path}.film`, "must be the title of a film in the list");
    if (!isCount(row.low)) fail(`${path}.low`, "must be a non-negative integer");
    if (!isCount(row.high)) fail(`${path}.high`, "must be a non-negative integer");
    if (isCount(row.low) && isCount(row.high) && row.high < row.low)
      fail(`${path}.high`, "must not be below low");
    if (!isText(row.by)) fail(`${path}.by`, "must name who made the projection");
    if (!isDate(row.published)) {
      fail(`${path}.published`, "must be a date, YYYY-MM-DD");
    } else if (release !== undefined && row.published >= release) {
      fail(`${path}.published`, "must be before the release");
    }
    source(row.source, `${path}.source`);
  });
}

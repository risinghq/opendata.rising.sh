import {
  insideDates,
  isCount,
  isDate,
  isHttps,
  isId,
  isInstant,
  isObj,
  isText,
  type Obj,
  type Report,
} from "./validate-common.ts";

const MAX_ALTITUDE = 9000;

function ids(
  data: Obj,
  key: string,
  { fail }: Report,
  each: (item: Obj, path: string) => void,
): Set<string> {
  const seen = new Set<string>();
  const list = data[key];
  if (!Array.isArray(list) || list.length === 0) {
    fail(key, "must be a non-empty list");
    return seen;
  }
  list.forEach((item: unknown, i) => {
    const path = `${key}[${i}]`;
    if (!isObj(item)) return fail(path, "must be an object");
    if (!isId(item.id)) {
      fail(`${path}.id`, "use lowercase words joined by hyphens");
    } else if (seen.has(item.id)) {
      fail(`${path}.id`, `"${item.id}" is used twice`);
    } else {
      seen.add(item.id);
    }
    each(item, path);
  });
  return seen;
}

export function validateTemporada(data: Obj, report: Report) {
  const { fail, source } = report;

  const tournaments = ids(data, "tournaments", report, (item, path) => {
    if (!isText(item.name)) fail(`${path}.name`, "must be a non-empty string");
    const origin = item.source;
    if (!isObj(origin)) return fail(`${path}.source`, "must be an object");
    source(origin, `${path}.source`);
    if (!isCount(origin.revision) || origin.revision === 0)
      fail(`${path}.source.revision`, "must be a positive integer");
    if (!isDate(origin.revisionDate)) fail(`${path}.source.revisionDate`, "must be a date");
    if (!isText(origin.license)) fail(`${path}.source.license`, "must name the licence");
    if (
      isHttps(origin.url) &&
      isCount(origin.revision) &&
      !String(origin.url).endsWith(`oldid=${origin.revision}`)
    )
      fail(`${path}.source.url`, "must be the permanent link, ending in ?oldid=<revision>");
  });

  const teams = ids(data, "teams", report, (item, path) => {
    if (!isText(item.name)) fail(`${path}.name`, "must be a non-empty string");
  });

  const stadiums = ids(data, "stadiums", report, (item, path) => {
    for (const key of ["name", "city"] as const) {
      if (!isText(item[key])) fail(`${path}.${key}`, "must be a non-empty string");
    }
    if (!isCount(item.altitude) || item.altitude > MAX_ALTITUDE)
      fail(`${path}.altitude`, `must be an integer of metres, 0 to ${MAX_ALTITUDE}`);
    source(item.source, `${path}.source`);
  });

  if (!Array.isArray(data.matches) || data.matches.length === 0) {
    return fail("matches", "must be a non-empty list");
  }
  const playing = new Map<string, string>();
  data.matches.forEach((match: unknown, i) => {
    const path = `matches[${i}]`;
    if (!isObj(match)) return fail(path, "must be an object");

    if (typeof match.tournament !== "string" || !tournaments.has(match.tournament))
      fail(`${path}.tournament`, "must be the id of a tournament");
    if (!isCount(match.round) || match.round === 0)
      fail(`${path}.round`, "must be a positive integer");
    if (!isInstant(match.start)) {
      fail(`${path}.start`, "must be a local time with an offset, YYYY-MM-DDTHH:MM-05:00");
    } else if (!insideDates(data, match.start)) {
      fail(`${path}.start`, "falls outside the event dates");
    }
    for (const key of ["home", "away"] as const) {
      const team = match[key];
      if (typeof team !== "string" || !teams.has(team))
        fail(`${path}.${key}`, "must be the id of a team");
    }
    if (match.home === match.away) fail(`${path}.away`, "a team cannot play itself");
    if (typeof match.stadium !== "string" || !stadiums.has(match.stadium))
      fail(`${path}.stadium`, "must be the id of a stadium");
    if ("referee" in match && !isText(match.referee))
      fail(`${path}.referee`, "must be a non-empty string when present");

    if (match.status === "held") {
      for (const key of ["homeScore", "awayScore"] as const) {
        if (!isCount(match[key])) fail(`${path}.${key}`, "must be a non-negative integer");
      }
    } else if (match.status === "planned") {
      for (const key of ["homeScore", "awayScore"]) {
        if (key in match) fail(`${path}.${key}`, "a planned match has no score");
      }
    } else {
      fail(`${path}.status`, 'must be "planned" or "held"');
    }

    for (const key of ["home", "away"] as const) {
      const slot = `${match.tournament}/${match.round}/${match[key]}`;
      const earlier = playing.get(slot);
      if (earlier !== undefined) {
        fail(
          path,
          `${String(match[key])} already plays in round ${String(match.round)} of ${String(match.tournament)} (${earlier})`,
        );
      } else {
        playing.set(slot, path);
      }
    }
  });
}

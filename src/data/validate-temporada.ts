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

const MAX_MINUTE = 130;
const STAT_KEYS = ["possession", "shotsOnTarget", "shotsOffTarget", "attacks", "dangerousAttacks"];

function minuteList(list: unknown, path: string, { fail }: Report) {
  if (!Array.isArray(list)) return fail(path, "must be a list");
  list.forEach((item: unknown, i) => {
    const ipath = `${path}[${i}]`;
    if (!isObj(item)) return fail(ipath, "must be an object");
    if (!isCount(item.minute) || item.minute > MAX_MINUTE)
      fail(`${ipath}.minute`, `must be an integer of minutes, 0 to ${MAX_MINUTE}`);
    if (item.team !== "home" && item.team !== "away")
      fail(`${ipath}.team`, 'must be "home" or "away"');
    for (const key of Object.keys(item))
      if (key !== "minute" && key !== "team")
        fail(`${ipath}.${key}`, "is not a field the feed provides");
  });
}

function matchStats(stats: unknown, path: string, { fail }: Report) {
  if (!isObj(stats)) return fail(path, "must be null or an object with home and away");
  for (const side of ["home", "away"] as const) {
    const team = stats[side];
    if (!isObj(team)) {
      fail(`${path}.${side}`, "must be an object");
      continue;
    }
    for (const key of STAT_KEYS) {
      if (!isCount(team[key])) fail(`${path}.${side}.${key}`, "must be a non-negative integer");
    }
    if (isCount(team.possession) && team.possession > 100)
      fail(`${path}.${side}.possession`, "must be a percentage, 0 to 100");
    for (const key of Object.keys(team))
      if (!STAT_KEYS.includes(key))
        fail(`${path}.${side}.${key}`, "is not a field the feed provides");
  }
  if (isObj(stats.home) && isObj(stats.away)) {
    const { home, away } = stats;
    if (
      isCount(home.possession) &&
      isCount(away.possession) &&
      Math.abs(home.possession + away.possession - 100) > 1
    )
      fail(`${path}.possession`, "possession of the two teams must add up to 100, give or take 1");
  }
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
      if ("events" in match) fail(`${path}.events`, "a planned match has no events");
    } else {
      fail(`${path}.status`, 'must be "planned" or "held"');
    }

    if ("events" in match) {
      const events = match.events;
      if (!isObj(events)) {
        fail(`${path}.events`, "must be an object");
      } else {
        if (!isObj(events.halfTime)) {
          fail(`${path}.events.halfTime`, "must be an object with home and away");
        } else {
          for (const key of ["home", "away"] as const) {
            if (!isCount(events.halfTime[key]))
              fail(`${path}.events.halfTime.${key}`, "must be a non-negative integer");
          }
        }
        const side = (v: unknown) => v === "home" || v === "away";
        if (!Array.isArray(events.goals)) {
          fail(`${path}.events.goals`, "must be a list");
        } else {
          events.goals.forEach((goal: unknown, i) => {
            const gpath = `${path}.events.goals[${i}]`;
            if (!isObj(goal)) return fail(gpath, "must be an object");
            if (!isCount(goal.minute) || goal.minute > 130)
              fail(`${gpath}.minute`, "must be an integer of minutes, 0 to 130");
            if (!side(goal.team)) fail(`${gpath}.team`, 'must be "home" or "away"');
            for (const key of Object.keys(goal))
              if (key !== "minute" && key !== "team")
                fail(`${gpath}.${key}`, "is not a field the feed provides");
          });
        }
        if (!Array.isArray(events.cards)) {
          fail(`${path}.events.cards`, "must be a list");
        } else {
          events.cards.forEach((card: unknown, i) => {
            const cpath = `${path}.events.cards[${i}]`;
            if (!isObj(card)) return fail(cpath, "must be an object");
            if (!isCount(card.minute) || card.minute > 130)
              fail(`${cpath}.minute`, "must be an integer of minutes, 0 to 130");
            if (!side(card.team)) fail(`${cpath}.team`, 'must be "home" or "away"');
            if (!["yellow", "red"].includes(String(card.colour)))
              fail(`${cpath}.colour`, 'must be "yellow" or "red"');
          });
        }
        if (!isObj(events.corners)) {
          fail(`${path}.events.corners`, "must be an object with home and away");
        } else {
          for (const key of ["home", "away"] as const) {
            if (!isCount(events.corners[key]))
              fail(`${path}.events.corners.${key}`, "must be a non-negative integer");
          }
        }
        for (const key of ["cornerMinutes", "substitutions", "missedPenalties"] as const) {
          if (key in events) minuteList(events[key], `${path}.events.${key}`, report);
        }
        if (isObj(events.corners) && Array.isArray(events.cornerMinutes)) {
          for (const key of ["home", "away"] as const) {
            const listed = events.cornerMinutes.filter((c) => isObj(c) && c.team === key).length;
            if (isCount(events.corners[key]) && listed > events.corners[key])
              fail(`${path}.events.cornerMinutes`, `lists more ${key} corners than the total`);
          }
        }
        if ("stats" in events && events.stats !== null) {
          matchStats(events.stats, `${path}.events.stats`, report);
        }
        if (match.status === "held" && Array.isArray(events.goals)) {
          const home = Number(match.homeScore);
          const away = Number(match.awayScore);
          const scored = home + away;
          if (events.goals.length > scored)
            fail(`${path}.events.goals`, "lists more goals than the score allows");
          const homeGoals = events.goals.filter((g) => isObj(g) && g.team === "home").length;
          const awayGoals = events.goals.filter((g) => isObj(g) && g.team === "away").length;
          if (homeGoals > home || awayGoals > away)
            fail(`${path}.events.goals`, "per-side goal events exceed the score");
        }
      }
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

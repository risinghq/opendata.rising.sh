import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { limaDate, parseEvents, type ApiFixture } from "../../scripts/liga1/parse.ts";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "fixture.json"), "utf8"),
) as ApiFixture;

test("parseEvents maps a real fixture response to our match events schema", () => {
  const events = parseEvents(fixture)!;
  expect(events.halfTime).toEqual({ home: 1, away: 1 });
  expect(events.corners).toEqual({ home: 8, away: 3 });
  const goals = events.goals;
  expect(goals.every((g) => Object.keys(g).sort().join(",") === "minute,team")).toBe(true);
  expect(goals.filter((g) => g.team === "home").length).toBe(fixture.goals!.home);
  expect(goals.filter((g) => g.team === "away").length).toBe(fixture.goals!.away);
  expect(events.cards.every((c) => ["yellow", "red"].includes(c.colour))).toBe(true);
});

test("parseEvents returns null for an unfinished fixture", () => {
  expect(parseEvents({ ...fixture, status: "scheduled" })).toBeNull();
});

const withStats = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "fixtures", "liga1-fixture-stats.json"), "utf8"),
) as ApiFixture;

test("parseEvents keeps the per-team statistics under our own names", () => {
  const events = parseEvents(withStats)!;
  expect(events.stats).toEqual({
    home: {
      possession: 54,
      shotsOnTarget: 6,
      shotsOffTarget: 5,
      attacks: 104,
      dangerousAttacks: 61,
    },
    away: {
      possession: 46,
      shotsOnTarget: 4,
      shotsOffTarget: 7,
      attacks: 88,
      dangerousAttacks: 47,
    },
  });
});

test("parseEvents keeps substitutions, corner minutes and missed penalties in minute order", () => {
  const events = parseEvents(withStats)!;
  expect(events.missedPenalties).toEqual([{ minute: 21, team: "home" }]);
  expect(events.substitutions!.map((s) => s.minute)).toEqual([46, 62, 65, 78, 83, 83, 85, 90, 93]);
  expect(events.cornerMinutes).toHaveLength(11);
  expect(events.cornerMinutes!.filter((c) => c.team === "home")).toHaveLength(events.corners.home);
  expect(events.cornerMinutes!.filter((c) => c.team === "away")).toHaveLength(events.corners.away);
});

test("parseEvents gives stats null, never zeros, when the feed has no statistics", () => {
  const { statistics: _dropped, ...bare } = withStats;
  const incomplete = {
    ...withStats,
    statistics: { ...withStats.statistics!, possession: undefined },
  };
  expect(parseEvents(fixture)!.stats).toBeNull();
  expect(parseEvents(bare)!.stats).toBeNull();
  expect(parseEvents({ ...withStats, statistics: null })!.stats).toBeNull();
  expect(parseEvents(incomplete)!.stats).toBeNull();
  expect(parseEvents(fixture)!.goals).toHaveLength(3);
});

test("limaDate converts a UTC kickoff to the Lima day", () => {
  expect(limaDate("2026-08-16T20:00:00+00:00")).toBe("2026-08-16");
  expect(limaDate("2026-08-17T01:00:00+00:00")).toBe("2026-08-16");
});

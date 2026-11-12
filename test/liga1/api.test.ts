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

test("limaDate converts a UTC kickoff to the Lima day", () => {
  expect(limaDate("2026-08-16T20:00:00+00:00")).toBe("2026-08-16");
  expect(limaDate("2026-08-17T01:00:00+00:00")).toBe("2026-08-16");
});

import { describe, expect, test } from "bun:test";

import { existsSync, readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import { joinFixtures } from "../../scripts/liga1/join.ts";
import type { TemporadaData } from "../../src/data/types.ts";
import type { ApiFixture } from "../../scripts/liga1/parse.ts";

const event = {
  kind: "temporada",
  title: "Liga",
  summary: "s",
  start: "2026-08-01",
  end: "2026-08-20",
  places: ["Perú"],
  updated: "2026-08-20T12:00-05:00",
  method: "m",
  tournaments: [
    {
      id: "clausura",
      name: "Torneo Clausura",
      source: {
        outlet: "Wikipedia en español",
        url: "https://es.wikipedia.org/wiki/X?oldid=7",
        revision: 7,
        revisionDate: "2026-08-19",
        license: "CC BY-SA 4.0",
      },
    },
  ],
  teams: [
    { id: "sporting-cristal", name: "Sporting Cristal" },
    { id: "universitario", name: "Universitario" },
  ],
  stadiums: [
    {
      id: "est",
      name: "E",
      city: "Lima",
      altitude: 150,
      source: { outlet: "x", url: "https://example.org" },
    },
  ],
  matches: [
    {
      tournament: "clausura",
      round: 4,
      start: "2026-08-16T15:00-05:00",
      home: "sporting-cristal",
      away: "universitario",
      stadium: "est",
      status: "held",
      homeScore: 2,
      awayScore: 1,
    },
  ],
} as unknown as TemporadaData;

const fixture: ApiFixture = {
  id: 55,
  kickoff_utc: "2026-08-16T20:00:00+00:00",
  status: "finished",
  teams: {
    home: { id: 1, name: "Sporting Cristal" },
    away: { id: 2, name: "Universitario" },
  },
  goals: { home: 2, away: 1 },
  corners: { home: 7, away: 3 },
  events: [
    { type: "goal", minute: 11, team: "home", count: 1 },
    {
      type: "period_score",
      minute: null,
      team: null,
      period: "first_half",
      score: { home: 1, away: 0 },
    },
  ],
};

describe("joinFixtures", () => {
  test("attaches events to the held match with the same Lima date and teams", () => {
    const copy = structuredClone(event);
    const result = joinFixtures(copy, [fixture]);
    expect(result.joined).toBe(1);
    expect(result.unjoined).toEqual([]);
    const events = copy.matches[0]!.status === "held" ? copy.matches[0]!.events : undefined;
    expect(events?.halfTime).toEqual({ home: 1, away: 0 });
    expect(events?.goals).toEqual([{ minute: 11, team: "home" }]);
    expect(result.link).toEqual({ "2026-08-16|sporting-cristal|universitario": 55 });
  });

  test("lists a match without an API fixture as unjoined", () => {
    const copy = structuredClone(event);
    const result = joinFixtures(copy, []);
    expect(result.unjoined).toHaveLength(1);
    expect(result.unjoined[0]).toContain("clausura fecha 4");
  });

  test("reports a score mismatch between Wikipedia and the API", () => {
    const copy = structuredClone(event);
    const result = joinFixtures(copy, [{ ...fixture, goals: { home: 1, away: 1 } }]);
    expect(result.mismatches).toHaveLength(1);
  });
});

test("joinFixtures does not write .cache/liga1/join.json", () => {
  const file = joinPath(import.meta.dirname, "..", "..", ".cache", "liga1", "join.json");
  const before = existsSync(file) ? readFileSync(file, "utf8") : null;
  joinFixtures(structuredClone(event), [fixture]);
  const after = existsSync(file) ? readFileSync(file, "utf8") : null;
  expect(after).toBe(before);
});

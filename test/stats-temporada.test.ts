import { expect, test } from "bun:test";

import { altitudePoints, keyFigures, standings, trend } from "../src/data/stats-temporada.ts";
import { eventStatus } from "../src/data/stats.ts";
import type { Match, TemporadaData } from "../src/data/types.ts";

const source = { outlet: "Fuente", url: "https://example.org" };

function match(
  tournament: string,
  round: number,
  home: string,
  away: string,
  stadium: string,
  score?: [number, number],
): Match {
  const base = {
    tournament,
    round,
    start: `2026-02-${String(round).padStart(2, "0")}T15:00-05:00`,
    home,
    away,
    stadium,
  };
  return score
    ? { ...base, status: "held", homeScore: score[0], awayScore: score[1] }
    : { ...base, status: "planned" };
}

const event: TemporadaData = {
  kind: "temporada",
  title: "T",
  summary: "S.",
  start: "2026-02-01",
  end: "2026-02-28",
  places: ["Perú"],
  updated: "2026-02-10T12:00-05:00",
  method: "M.",
  tournaments: ["a", "c"].map((id) => ({
    id,
    name: id,
    source: {
      ...source,
      revision: 1,
      revisionDate: "2026-02-10",
      license: "CC BY-SA 4.0",
    },
  })),
  teams: [
    { id: "x", name: "X" },
    { id: "y", name: "Y" },
    { id: "z", name: "Z" },
  ],
  stadiums: [
    { id: "bajo", name: "Bajo", city: "Lima", altitude: 100, source },
    { id: "alto", name: "Alto", city: "Cusco", altitude: 3300, source },
  ],
  matches: [
    match("a", 1, "x", "y", "bajo", [2, 0]),
    match("a", 2, "y", "z", "alto", [1, 1]),
    match("a", 3, "z", "x", "alto", [0, 3]),
    match("c", 1, "y", "x", "bajo", [0, 1]),
    match("c", 2, "x", "z", "bajo"),
  ],
};

test("key figures count held matches only and split results by side", () => {
  expect(keyFigures(event)).toEqual({
    held: 4,
    total: 5,
    goals: 8,
    goalsPerMatch: 2,
    homeWins: 1,
    draws: 1,
    awayWins: 2,
  });
});

test("standings award 3 and 1 points and order by points, difference and goals", () => {
  const table = standings(event);
  expect(table.map((row) => [row.team, row.points, row.played, row.goalDifference])).toEqual([
    ["x", 9, 3, 6],
    ["y", 1, 3, -3],
    ["z", 1, 2, -3],
  ]);
  expect(table[0]!.pointsPerMatch).toBe(3);
});

test("a tournament table ignores the other tournament", () => {
  const table = standings(event, "c");
  expect(table.find((row) => row.team === "x")).toMatchObject({ played: 1, points: 3 });
  expect(table.find((row) => row.team === "z")).toMatchObject({ played: 0, pointsPerMatch: 0 });
});

test("altitude points drop stadiums with fewer than 5 held matches and fit a line", () => {
  expect(altitudePoints(event)).toEqual([]);
  const many: TemporadaData = {
    ...event,
    matches: [
      ...Array.from({ length: 5 }, () => match("a", 1, "x", "y", "bajo", [0, 1])),
      ...Array.from({ length: 5 }, () => match("a", 1, "x", "y", "alto", [1, 0])),
    ],
  };
  const points = altitudePoints(many);
  expect(points.map((p) => [p.stadium.id, p.pointsPerMatch])).toEqual([
    ["bajo", 0],
    ["alto", 3],
  ]);
  expect(trend(points)!.slopePerKm).toBeCloseTo((3 / 3200) * 1000, 6);
});

test("an event is en curso while a match is planned", () => {
  expect(eventStatus(event)).toBe("en curso");
  expect(eventStatus({ ...event, matches: event.matches.slice(0, 4) })).toBe("finalizado");
});

import { expect, test } from "bun:test";

import { goalTiming } from "../../src/forecast/events.ts";
import type { TemporadaData } from "../../src/data/types.ts";

const event = {
  matches: [
    {
      tournament: "clausura",
      round: 1,
      start: "2026-08-01T15:00-05:00",
      home: "a",
      away: "b",
      stadium: "e",
      status: "held",
      homeScore: 2,
      awayScore: 1,
      events: {
        halfTime: { home: 1, away: 0 },
        goals: [
          { minute: 5, team: "home" },
          { minute: 90, team: "away" },
          { minute: 46, team: "home" },
        ],
        cards: [],
        corners: { home: 4, away: 2 },
      },
    },
    {
      tournament: "clausura",
      round: 2,
      start: "2026-08-09T15:00-05:00",
      home: "b",
      away: "a",
      stadium: "e",
      status: "planned",
    },
  ],
} as unknown as TemporadaData;

test("goalTiming bins every goal event into a 15-minute period", () => {
  const periods = goalTiming(event);
  const binned = periods.reduce((sum, p) => sum + p.home + p.away, 0);
  expect(binned).toBe(3);
  expect(periods[0]).toEqual({ label: "0–15", home: 1, away: 0 });
  expect(periods[3]).toEqual({ label: "45–60", home: 1, away: 0 });
  expect(periods[5]).toEqual({ label: "75–90+", home: 0, away: 1 });
});

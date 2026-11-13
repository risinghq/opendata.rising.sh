import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TemporadaData } from "../../src/data/types.ts";

// Scores come from Wikipedia and match events from 5DollarFootballAPI. The join
// drops surplus goal events but cannot add missing ones, so this catches both.
const event = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "data", "events", "liga-1-2026.json"), "utf8"),
) as TemporadaData;

const held = event.matches.flatMap((m) =>
  m.status === "held" && "events" in m && m.events ? [{ ...m, events: m.events }] : [],
);

test("the committed Liga 1 data has API events to cross-check", () => {
  expect(held.length).toBeGreaterThan(0);
});

test("API goal events per side equal the Wikipedia score", () => {
  const wrong = held.flatMap((m) => {
    const home = m.events.goals.filter((g) => g.team === "home").length;
    const away = m.events.goals.filter((g) => g.team === "away").length;
    return home === m.homeScore && away === m.awayScore
      ? []
      : [`${m.start} ${m.home}-${m.away}: ${m.homeScore}-${m.awayScore}, events ${home}-${away}`];
  });
  expect(wrong).toEqual([]);
});

test("the API half-time score never exceeds the Wikipedia final score", () => {
  const wrong = held.flatMap((m) => {
    const ht = m.events.halfTime;
    return ht && (ht.home > m.homeScore || ht.away > m.awayScore)
      ? [
          `${m.start} ${m.home}-${m.away}: HT ${ht.home}-${ht.away}, FT ${m.homeScore}-${m.awayScore}`,
        ]
      : [];
  });
  expect(wrong).toEqual([]);
});

import { expect, test } from "bun:test";

import { eventNotice } from "../../src/data/notice.ts";
import type { TemporadaData } from "../../src/data/types.ts";

const base = {
  tournaments: [
    {
      id: "apertura",
      name: "Torneo Apertura",
      source: {
        outlet: "Wikipedia en español",
        url: "https://es.wikipedia.org/wiki/A?oldid=11",
        revision: 11,
        revisionDate: "2026-10-30",
        license: "CC BY-SA 4.0",
      },
    },
    {
      id: "clausura",
      name: "Torneo Clausura",
      source: {
        outlet: "Wikipedia en español",
        url: "https://es.wikipedia.org/wiki/C?oldid=22",
        revision: 22,
        revisionDate: "2026-11-10",
        license: "CC BY-SA 4.0",
      },
    },
  ],
  matches: [
    {
      tournament: "clausura",
      round: 1,
      start: "2026-08-01T15:00-05:00",
      home: "a",
      away: "b",
      stadium: "e",
      status: "held",
      homeScore: 1,
      awayScore: 0,
    },
  ],
} as unknown as TemporadaData;

test("eventNotice names each tournament's revision in one sentence", () => {
  expect(eventNotice(base)).toBe(
    "Datos de Wikipedia en español (CC BY-SA 4.0): Torneo Apertura, revisión del 30 de octubre de 2026; Torneo Clausura, revisión del 10 de noviembre de 2026.",
  );
});

test("eventNotice adds the 5DollarFootballAPI sentence when a match has events", () => {
  const withEvents = structuredClone(base);
  (withEvents.matches[0] as { events?: object }).events = {
    halfTime: { home: 0, away: 0 },
    goals: [],
    cards: [],
    corners: { home: 0, away: 0 },
  };
  expect(eventNotice(withEvents)).toContain(
    "Datos de partidos: Football data by 5DollarFootballAPI (5dollarfootballapi.com).",
  );
});

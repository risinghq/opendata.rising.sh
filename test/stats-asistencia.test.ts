import { expect, test } from "bun:test";

import type { AsistenciaData, HeldAct } from "../src/data/types.ts";
import { dailyTotals, expectedDifference, sumRange } from "../src/data/stats-asistencia.ts";
import { eventStatus } from "../src/data/stats.ts";

const src = { outlet: "Medio", url: "https://example.org" };

function held(day: string, low: number, central: number, high: number): HeldAct {
  return {
    status: "held",
    start: `${day}T10:00-03:00`,
    country: "Uruguay",
    city: "Florida",
    venue: "Plaza",
    name: "Misa",
    low,
    central,
    high,
    attribution: "X.",
    sources: [src],
  };
}

const event: AsistenciaData = {
  kind: "asistencia",
  title: "E",
  summary: "S.",
  start: "2026-11-07",
  end: "2026-11-10",
  places: ["Uruguay"],
  updated: "2026-11-09T12:00-05:00",
  method: "M.",
  acts: [
    held("2026-11-07", 1, 2, 3),
    held("2026-11-09", 10, 20, 40),
    held("2026-11-09", 5, 5, 5),
    {
      status: "planned",
      start: "2026-11-10T10:00-03:00",
      country: "Perú",
      city: "Lima",
      venue: "Base",
      name: "Misa",
    },
  ],
};

test("a total sums low, central and high separately", () => {
  expect(sumRange([held("2026-11-07", 1, 2, 3), held("2026-11-07", 4, 5, 6)])).toEqual({
    low: 5,
    central: 7,
    high: 9,
  });
});

test("the daily series accumulates, fills empty days and stops at the last held day", () => {
  const days = dailyTotals(event);
  expect(days.map((d) => d.date)).toEqual(["2026-11-07", "2026-11-08", "2026-11-09"]);
  expect(days.map((d) => d.held)).toEqual([true, false, true]);
  expect(days.map((d) => d.total.central)).toEqual([2, 2, 27]);
  expect(days.at(-1)?.total).toEqual({ low: 16, central: 27, high: 48 });
});

test.each([
  ["a count above the forecast", 1500, 1000, 0.5],
  ["a count below the forecast", 650, 800, -0.1875],
  ["a count equal to the forecast", 60, 60, 0],
])("the difference for %s", (_name, central, figure, difference) => {
  const act: HeldAct = {
    ...held("2026-11-07", central, central, central),
    expected: { figure, attribution: "X.", source: src },
  };
  expect(expectedDifference(act)).toBeCloseTo(difference, 10);
});

test("a held act without an expected figure has no difference", () => {
  expect(expectedDifference(held("2026-11-07", 1, 2, 3))).toBeUndefined();
});

test("an event with planned acts is en curso", () => {
  expect(eventStatus(event)).toBe("en curso");
  expect(eventStatus({ ...event, acts: event.acts.slice(0, 3) })).toBe("finalizado");
});

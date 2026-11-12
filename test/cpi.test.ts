import { expect, test } from "bun:test";

import { latestYear, toReal, type CpiData } from "../src/data/cpi.ts";

const cpi: CpiData = {
  series: "CUUR0000SA0",
  base: 2025,
  source: { outlet: "BLS", url: "https://www.bls.gov/cpi/data.htm" },
  values: { "2020": 90, "2024": 100, "2025": 103 },
};

test("toReal deflates a past figure to base-year dollars", () => {
  expect(toReal(100, 2024, cpi)).toBe(103);
});

test("toReal throws when the film year has no CPI value", () => {
  expect(() => toReal(100, 2026, cpi)).toThrow("no CPI value for year 2026");
});

test("toReal throws when the base year has no CPI value", () => {
  const broken = { ...cpi, values: { "2024": 100 } };
  expect(() => toReal(100, 2024, broken)).toThrow("no CPI value for base year");
});

test("latestYear is the most recent year in the series", () => {
  expect(latestYear(cpi)).toBe(2025);
});

test("toReal converts to an explicit base year", () => {
  expect(toReal(100, 2025, cpi, 2020)).toBe(Math.round((100 * 90) / 103));
});

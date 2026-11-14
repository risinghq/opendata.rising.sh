import { describe, expect, test } from "bun:test";

import {
  formatCompactDateLima,
  formatCompactRange,
  formatMoneyCompact,
} from "../src/data/format.ts";

describe("formatCompactRange", () => {
  test("names the year once within a year", () => {
    expect(formatCompactRange("2026-01-30", "2026-11-22")).toBe("30 ene – 22 nov 2026");
  });

  test("names both years across years", () => {
    expect(formatCompactRange("2008-05-02", "2027-12-17")).toBe("2 may 2008 – 17 dic 2027");
  });
});

test("formatCompactDateLima uses the Lima day, not the UTC one", () => {
  expect(formatCompactDateLima("2026-11-11T03:00:00Z")).toBe("10 nov 2026");
});

const nbsp = " ";

describe("formatMoneyCompact", () => {
  const cases: [number, string][] = [
    [0, "USD 0"],
    [500_000, "USD 500,000"],
    [999_999, "USD 999,999"],
    [1_000_000, "USD 1 M"],
    [760_900_000, "USD 760.9 M"],
    [2_942_177_764, "USD 2,942.2 M"],
    [35_213_400_000, "USD 35,213.4 M"],
  ];

  for (const [value, expected] of cases) {
    test(`${value} -> ${expected}`, () => {
      expect(formatMoneyCompact(value)).toBe(expected.replaceAll(" ", nbsp));
    });
  }
});

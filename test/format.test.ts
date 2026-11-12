import { describe, expect, test } from "bun:test";

import { formatMoneyCompact } from "../src/data/format.ts";

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

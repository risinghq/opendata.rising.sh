import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildSnapshot } from "../scripts/mcu/forecast.ts";
import type { TaquillaData } from "../src/data/types.ts";

const event = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "data", "events", "mcu-taquilla.json"), "utf8"),
) as TaquillaData;

test("buildSnapshot targets the unreleased Avengers film without training on it", () => {
  const snap = buildSnapshot(event, "2026-11-12");
  expect(snap?.target.title).toBe("Avengers: Doomsday");
  expect(snap?.filmsUsed.some((f) => f.title === "Avengers: Doomsday")).toBe(false);
});

test("buildSnapshot returns null once the target film is released", () => {
  const wiki = event.source;
  const films = event.films.map((f) =>
    /Doomsday/.test(f.title)
      ? {
          ...f,
          status: "released" as const,
          opening: { amount: 200_000_000, source: wiki },
          usCanada: { amount: 500_000_000, source: wiki },
          worldwide: { amount: 2_000_000_000, source: wiki },
        }
      : f,
  );
  expect(buildSnapshot({ ...event, films }, "2026-12-20")).toBeNull();
});

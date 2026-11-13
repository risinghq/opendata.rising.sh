import { describe, expect, onTestFinished, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSnapshot, run } from "../scripts/mcu/forecast.ts";
import type { TaquillaData } from "../src/data/types.ts";
import {
  backtest,
  chooseMethods,
  fitOpening,
  fitRatio,
  forecastTarget,
  naiveErrors,
  probabilityAbove,
  publish,
  ratioErrors,
  scoresOf,
  simulateWorldwide,
  type BacktestResult,
  type McuFilm,
  type Method,
} from "../src/forecast/mcu.ts";

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

const LINES = ["a", "b", "c", "d", "e", "f"];

function series(slope: number, ratio: (i: number) => number, scale = 1): McuFilm[] {
  const films: McuFilm[] = [];
  const last = new Map<string, number>();
  for (let i = 0; i < 36; i++) {
    const line = LINES[i % LINES.length]!;
    const before = last.get(line);
    const opening =
      before === undefined
        ? scale * 1e7 * (1 + (i % 5))
        : Math.exp(Math.log(scale * 3e7) + slope * (Math.log(before) - Math.log(scale * 3e7)));
    last.set(line, opening);
    films.push({
      title: `film ${i}`,
      release: `${2000 + i}-01-01`,
      line,
      opening,
      worldwide: opening * ratio(i),
    });
  }
  return films;
}

describe("the opening stage", () => {
  test("keeps the line predecessor at any dollar level", () => {
    const small = fitOpening(series(0.8, () => 5))!;
    const large = fitOpening(series(0.8, () => 5, 1000))!;
    expect(small.coefficients[2]!).toBeGreaterThan(0.6);
    expect(large.coefficients[2]!).toBeCloseTo(small.coefficients[2]!, 6);
  });

  test("needs enough films and at least one sequel", () => {
    expect(fitOpening(series(0.8, () => 5).slice(0, 4))).toBeUndefined();
    const firsts = series(0.8, () => 5).map((f, i) => ({ ...f, line: `line ${i}` }));
    expect(fitOpening(firsts)).toBeUndefined();
  });
});

describe("the ratio stage", () => {
  test("is the geometric mean of worldwide over opening", () => {
    const films = series(0.8, (i) => (i % 2 === 0 ? 4 : 9));
    expect(fitRatio(films)).toBeCloseTo(6, 6);
  });

  test("leave-one-out errors are zero when every ratio is the same", () => {
    const errors = ratioErrors(series(0.8, () => 7));
    expect(errors).toHaveLength(36);
    for (const e of errors) expect(e).toBeCloseTo(0, 9);
  });

  test("leave-one-out errors measure each film against the others", () => {
    const films = series(0.8, (i) => (i === 0 ? 14 : 7));
    const errors = ratioErrors(films);
    expect(errors[0]!).toBeGreaterThan(0.6);
    expect(errors[1]!).toBeLessThan(0);
  });
});

describe("the worldwide simulation", () => {
  const spread = { opening: [Math.log(2), -Math.log(2)], ratio: [0] };

  test("the same seed gives the same draws", () => {
    expect(simulateWorldwide(100, 8, spread, 7, 500)).toEqual(
      simulateWorldwide(100, 8, spread, 7, 500),
    );
    expect(simulateWorldwide(100, 8, spread, 8, 500)).not.toEqual(
      simulateWorldwide(100, 8, spread, 7, 500),
    );
  });

  test("probabilities follow the error distribution", () => {
    const draws = simulateWorldwide(100, 8, spread, 7, 20_000);
    expect(probabilityAbove(draws, 400)).toBeCloseTo(0.5, 1);
    expect(probabilityAbove(draws, 1600)).toBe(0);
    expect(probabilityAbove(draws, 100)).toBe(1);
    expect(probabilityAbove(draws, 399)).toBe(1);
  });

  test("both uncertainties widen the worldwide range", () => {
    const withRatio = simulateWorldwide(
      100,
      8,
      { opening: [0], ratio: [Math.log(1.5), -Math.log(1.5)] },
      7,
      5_000,
    );
    const without = simulateWorldwide(100, 8, { opening: [0], ratio: [0] }, 7, 5_000);
    expect(without[0]).toBeCloseTo(800, 6);
    expect(without.at(-1)).toBeCloseTo(800, 6);
    expect(withRatio[0]!).toBeLessThan(600);
    expect(withRatio.at(-1)!).toBeGreaterThan(1100);
  });
});

test("forecastTarget multiplies the opening forecast by the ratio and orders the thresholds", () => {
  const films = series(0.8, () => 6);
  const target: McuFilm = { title: "next", release: "2100-01-01", line: "a" };
  const result = forecastTarget(films, target, [
    { id: "low", usd: 1 },
    { id: "mid", usd: films.at(-1)!.worldwide! },
    { id: "high", usd: 1e15 },
  ]);
  expect(result.ratio.point).toBeCloseTo(6, 6);
  expect(result.ratio.low).toBeCloseTo(6, 6);
  expect(result.ratio.high).toBeCloseTo(6, 6);
  expect(result.model.predictions.worldwide.point).toBe(
    Math.round(result.model.predictions.opening.point * 6),
  );
  const [low, mid, high] = result.model.probabilities.above.map((a) => a.probability);
  expect(low).toBe(1);
  expect(high).toBe(0);
  expect(mid!).toBeGreaterThanOrEqual(0);
  expect(mid!).toBeLessThanOrEqual(1);
});

describe("the naive baseline", () => {
  const films = series(0.8, (i) => 4 + (i % 3));
  const target: McuFilm = { title: "next", release: "2100-01-01", line: "a" };

  test("repeats the previous opening and takes worldwide through the ratio stage", () => {
    const result = forecastTarget(films, target, [{ id: "x", usd: 1 }]);
    const { naive } = result;
    expect(naive.predictions.opening.point).toBe(Math.round(films.at(-1)!.opening!));
    expect(naive.predictions.worldwide.point).toBe(
      Math.round(films.at(-1)!.opening! * result.ratio.point),
    );
    expect(naive.predictions.opening.low).toBeLessThan(naive.predictions.opening.point);
    expect(naive.predictions.opening.high).toBeGreaterThan(naive.predictions.opening.point);
    expect(naive.probabilities.above[0]!.probability).toBe(1);
  });

  test("the ratio error widens the naive worldwide range", () => {
    const spread = (ratio: (i: number) => number) => {
      const { naive } = forecastTarget(series(0.8, ratio), target, [{ id: "x", usd: 1 }]);
      return naive.predictions.worldwide.high / naive.predictions.worldwide.low;
    };
    expect(spread((i) => (i % 2 ? 9 : 4))).toBeGreaterThan(spread(() => 6.5));
  });

  test("the backtest scores the naive worldwide as the previous opening times the ratio", () => {
    const films = series(0.8, (i) => 4 + (i % 3));
    const result = backtest(films);
    const row = result.rows.find((r) => r.figure === "worldwide" && r.film === "film 35")!;
    const before = films.slice(0, 35);
    expect(row.naive).toBeCloseTo(before.at(-1)!.opening! * fitRatio(before)!, 3);
  });

  test("steps between consecutive releases are the errors", () => {
    expect(naiveErrors(films.slice(0, 3), "opening")).toEqual([
      Math.log(films[1]!.opening! / films[0]!.opening!),
      Math.log(films[2]!.opening! / films[1]!.opening!),
    ]);
  });
});

describe("what is published", () => {
  const score = (
    opening: [number, number],
    worldwide: [number, number],
    previousWorldwide?: number,
  ): BacktestResult => ({
    cases: 10,
    rows: [],
    previousWorldwide,
    byFigure: {
      opening: { model: opening[0], naive: opening[1] },
      worldwide: { model: worldwide[0], naive: worldwide[1] },
    },
  });

  test.each([
    {
      name: "the model wins both figures",
      result: score([0.3, 0.5], [0.4, 0.5], 0.6),
      methods: { opening: "model", worldwide: "model" },
    },
    {
      name: "each figure takes its own winner",
      result: score([0.6, 0.5], [0.4, 0.5]),
      methods: { opening: "naive", worldwide: "model" },
    },
    {
      name: "the previous worldwide beats the model and the naive rule",
      result: score([0.3, 0.5], [0.6, 0.66], 0.53),
      methods: { opening: "model", worldwide: "previous" },
    },
    {
      name: "a tie goes to the simpler method",
      result: score([0.5, 0.5], [0.4, 0.4], 0.4),
      methods: { opening: "naive", worldwide: "previous" },
    },
    {
      name: "the previous worldwide is out of the choice when the backtest has none",
      result: score([0.3, 0.5], [0.6, 0.5]),
      methods: { opening: "model", worldwide: "naive" },
    },
  ])("$name", ({ result, methods }) => {
    expect(chooseMethods(result)).toEqual(methods);
  });

  test("a snapshot publishes, per figure, the method with the lowest median error", () => {
    const snap = buildSnapshot(event, "2026-11-12")!;
    const methods = snap.basis as Record<"opening" | "worldwide", Method>;
    for (const key of ["opening", "worldwide"] as const) {
      const scores = scoresOf(snap.backtest, key);
      for (const score of Object.values(scores)) {
        expect(scores[methods[key]]!).toBeLessThanOrEqual(score);
      }
    }
  });

  test("publish takes each figure from its method and the probabilities from the worldwide one", () => {
    const films = series(0.8, (i) => 4 + (i % 3));
    const target: McuFilm = { title: "next", release: "2100-01-01", line: "a" };
    const result = forecastTarget(films, target, [{ id: "x", usd: 1 }]);
    const last = films.at(-1)!;
    const published = publish(result, { opening: "model", worldwide: "previous" });
    expect(published.predictions.opening).toEqual(result.model.predictions.opening);
    expect(published.predictions.worldwide.point).toBe(Math.round(last.worldwide!));
    expect(published.predictions.worldwide.low).toBeLessThan(last.worldwide!);
    expect(published.predictions.worldwide.high).toBeGreaterThan(last.worldwide!);
    expect(published.probabilities).toEqual(result.previousWorldwide.probabilities);
    const naive = publish(result, { opening: "naive", worldwide: "naive" });
    expect(naive.predictions).toEqual(result.naive.predictions);
  });
});

describe("run", () => {
  test("writes the snapshot of the Lima clock day and leaves an existing one unchanged", () => {
    const root = mkdtempSync(join(tmpdir(), "mcu-forecast-"));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const dir = join(root, "mcu");
    const lateInLima = new Date("2026-11-20T04:59:00Z");
    expect(run(lateInLima, root)?.date).toBe("2026-11-19");
    expect(readdirSync(dir)).toEqual(["2026-11-19.json"]);
    const first = readFileSync(join(dir, "2026-11-19.json"), "utf8");

    expect(run(new Date("2026-11-19T15:00:00Z"), root)?.date).toBe("2026-11-19");
    expect(readdirSync(dir)).toEqual(["2026-11-19.json"]);
    expect(readFileSync(join(dir, "2026-11-19.json"), "utf8")).toBe(first);

    expect(run(new Date("2026-11-20T05:00:00Z"), root)?.date).toBe("2026-11-20");
    expect(readdirSync(dir).sort()).toEqual(["2026-11-19.json", "2026-11-20.json"]);
  });
});

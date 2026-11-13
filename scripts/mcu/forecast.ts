import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import { loadCpi } from "../../src/data/cpi.ts";
import { isReleased, realAmount } from "../../src/data/stats-taquilla.ts";
import type { TaquillaData } from "../../src/data/types.ts";
import {
  backtest,
  chooseMethods,
  forecastTarget,
  lineOf,
  methodsOf,
  publish,
  scoresOf,
  snapshotForm,
  FIGURE_KEYS,
  type McuFilm,
  type McuSnapshot,
} from "../../src/forecast/mcu.ts";
import { latestJson, snapshotExists, writeImmutable } from "../../src/forecast/snapshot.ts";

const EVENT_FILE = joinPath(import.meta.dirname, "..", "..", "data", "events", "mcu-taquilla.json");
const SERIES = "mcu";
const TARGET = /Avengers: Doomsday/;
const BENCHMARK = /Avengers: Endgame/;

export function inputs(event: TaquillaData): { films: McuFilm[]; base: number } {
  const cpi = loadCpi();
  const films = event.films.map((film): McuFilm => {
    const base = { title: film.title, release: film.release, line: lineOf(film.originalTitle) };
    if (!isReleased(film)) return base;
    return {
      ...base,
      opening: realAmount(film.opening.amount, film, cpi),
      worldwide: realAmount(film.worldwide.amount, film, cpi),
    };
  });
  return { films, base: cpi.base };
}

export function buildSnapshot(event: TaquillaData, today: string): McuSnapshot | null {
  const { films, base } = inputs(event);
  const released = films.filter((f) => f.worldwide !== undefined);
  const target = films.find((f) => TARGET.test(f.title) && f.worldwide === undefined);
  if (!target || today >= target.release) return null;

  const benchmark = event.films.find((f) => BENCHMARK.test(f.originalTitle));
  const benchmarkReal = released.find((f) => BENCHMARK.test(f.title));
  if (!benchmark || !isReleased(benchmark) || !benchmarkReal)
    throw new Error("the benchmark film is not released");
  const result = forecastTarget(released, target, [
    { id: "1000", usd: 1_000_000_000 },
    { id: "2000", usd: 2_000_000_000 },
    { id: "endgame-nominal", usd: benchmark.worldwide.amount },
    { id: "endgame-real", usd: benchmarkReal.worldwide! },
  ]);

  const results = backtest(released);
  const basis = chooseMethods(results);
  const published = publish(result, basis);
  return {
    series: SERIES,
    event: "mcu-taquilla",
    date: today,
    dollars: base,
    target: { title: target.title, release: target.release },
    filmsUsed: released.map((f) => ({
      title: f.title,
      release: f.release,
      opening: f.opening!,
      worldwide: f.worldwide!,
    })),
    model: {
      ...snapshotForm(),
      coefficients: { opening: result.fit.coefficients.map((v) => Number(v.toFixed(4))) },
      center: Number(result.fit.center.toFixed(4)),
    },
    basis,
    previous: result.previous,
    predictions: published.predictions,
    ratio: result.ratio,
    probabilities: published.probabilities,
    ...(Object.values(basis).every((method) => method === "model")
      ? {}
      : { candidate: result.model }),
    backtest: results,
  };
}

export function limaDay(now: Date): string {
  return new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function run(now = new Date(), root?: string): McuSnapshot | null {
  const event = JSON.parse(readFileSync(EVENT_FILE, "utf8")) as TaquillaData;
  const today = limaDay(now);
  const snapshot = buildSnapshot(event, today);
  if (!snapshot) {
    console.log("target released; snapshot left as is");
    return null;
  }
  if (snapshotExists(SERIES, snapshot.date, root)) {
    console.log(`snapshot for ${snapshot.date} already exists; left unchanged`);
  } else {
    console.log(`snapshot: ${writeImmutable(SERIES, snapshot.date, snapshot, root)}`);
  }
  for (const key of FIGURE_KEYS) {
    const p = snapshot.predictions[key];
    const scores = Object.entries(scoresOf(snapshot.backtest, key))
      .map(([method, ape]) => `${method} ${(ape * 100).toFixed(1)}%`)
      .join(", ");
    console.log(
      `${key}: basis ${methodsOf(snapshot)![key]}, point ${p.point} ` +
        `interval ${p.low}–${p.high}; backtest median APE ${scores}`,
    );
  }
  return snapshot;
}

export function latest(): McuSnapshot | null {
  return latestJson<McuSnapshot>(SERIES);
}

if (import.meta.main) run();

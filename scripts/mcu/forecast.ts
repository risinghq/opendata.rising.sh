import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import { loadCpi } from "../../src/data/cpi.ts";
import { isReleased, realAmount } from "../../src/data/stats-taquilla.ts";
import type { TaquillaData } from "../../src/data/types.ts";
import {
  backtest,
  fit,
  interval,
  lineOf,
  predict,
  snapshotForm,
  targetVector,
  FIGURE_KEYS,
  type McuFilm,
  type McuSnapshot,
} from "../../src/forecast/mcu.ts";
import { latestJson, snapshotExists, writeImmutable } from "../../src/forecast/snapshot.ts";

const EVENT_FILE = joinPath(import.meta.dirname, "..", "..", "data", "events", "mcu-taquilla.json");
const SERIES = "mcu";
const TARGET = /Avengers: Doomsday/;

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

  const predictions = {} as McuSnapshot["predictions"];
  const coefficients = {} as McuSnapshot["model"]["coefficients"];
  for (const key of FIGURE_KEYS) {
    const beta = fit(released, key);
    if (!beta) throw new Error(`not enough released films to fit ${key}`);
    coefficients[key] = beta.map((v) => Number(v.toFixed(4)));
    const point = Math.round(predict(beta, targetVector(released, target, key)));
    predictions[key] = { point, ...interval(released, key, point) };
  }

  const test = backtest(released);
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
    model: { ...snapshotForm(), coefficients },
    predictions,
    backtest: test,
  };
}

export function run(): McuSnapshot | null {
  const event = JSON.parse(readFileSync(EVENT_FILE, "utf8")) as TaquillaData;
  const today = new Date(new Date().getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
  const snapshot = buildSnapshot(event, today);
  if (!snapshot) {
    console.log("target released; snapshot left as is");
    return null;
  }
  if (snapshotExists(SERIES, snapshot.date)) {
    console.log(`snapshot for ${snapshot.date} already exists; left unchanged`);
  } else {
    console.log(`snapshot: ${writeImmutable(SERIES, snapshot.date, snapshot)}`);
  }
  for (const key of FIGURE_KEYS) {
    const p = snapshot.predictions[key];
    const b = snapshot.backtest.byFigure[key];
    console.log(
      `${key}: point ${p.point} interval ${p.low}–${p.high}; ` +
        `backtest model ${(b.model * 100).toFixed(1)}% vs naive ${(b.naive * 100).toFixed(1)}%`,
    );
  }
  return snapshot;
}

export function latest(): McuSnapshot | null {
  return latestJson<McuSnapshot>(SERIES);
}

if (import.meta.main) run();

import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import type { TemporadaData } from "../../src/data/types.ts";
import { isHeld } from "../../src/data/stats-temporada.ts";
import { backtest, toInput } from "../../src/forecast/backtest.ts";
import { fit, type FitOptions } from "../../src/forecast/model.ts";
import { simulate } from "../../src/forecast/simulate.ts";
import {
  snapshotExists,
  writeSnapshot,
  type ForecastSnapshot,
} from "../../src/forecast/snapshot.ts";
import { cacheRead } from "./api.ts";

const EVENT_FILE = joinPath(import.meta.dirname, "..", "..", "data", "events", "liga-1-2026.json");
const SIMS = 20_000;
const SEED = 20261112;

const OPTIONS: FitOptions = { decay: 0.004, ridge: 5, dixonColes: true };

export function run(): ForecastSnapshot {
  const event = JSON.parse(readFileSync(EVENT_FILE, "utf8")) as TemporadaData;
  const today = new Date(new Date().getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
  const teams = event.teams.map((t) => t.id);
  const held = event.matches.filter(isHeld);

  const params = fit(
    held.map((m) => toInput(m, event, today)),
    teams,
    OPTIONS,
  );
  const result = simulate(event, params, SIMS, SEED);

  const joinMap = cacheRead<Record<string, number>>("join.json");
  const oddsById = cacheRead<Record<string, [number, number, number]>>("odds.json");
  const odds = new Map<string, [number, number, number]>();
  for (const [key, id] of Object.entries(joinMap)) {
    if (oddsById[id]) odds.set(key, oddsById[id]);
  }
  const test = backtest(event, OPTIONS, odds, today);

  const snapshot: ForecastSnapshot = {
    season: "liga-1-2026",
    date: today,
    matchesUsed: held.map((m) => ({
      start: m.start,
      home: m.home,
      away: m.away,
      score: `${m.homeScore}-${m.awayScore}`,
    })),
    parameters: {
      decay: OPTIONS.decay,
      ridge: OPTIONS.ridge,
      dixonColes: OPTIONS.dixonColes,
      home: params.home,
      altitude: params.altitude,
      rho: params.rho,
      intercept: params.intercept,
    },
    simulations: SIMS,
    seed: SEED,
    matches: result.matches,
    teams: result.teams,
    backtest: test,
  };
  if (snapshotExists(snapshot.season, snapshot.date)) {
    console.log(`snapshot for ${snapshot.date} already exists; left unchanged`);
  } else {
    console.log(`snapshot: ${writeSnapshot(snapshot)}`);
  }
  console.log(
    `backtest: model ll ${test.model.logLoss.toFixed(3)} vs base ${test.baseRates.logLoss.toFixed(3)}` +
      (test.odds ? ` vs odds ${test.odds.logLoss.toFixed(3)}` : ""),
  );
  return snapshot;
}

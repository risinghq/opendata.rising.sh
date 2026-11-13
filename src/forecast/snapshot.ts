import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { BacktestResult } from "./backtest.ts";
import type { MatchForecast, TeamForecast } from "./simulate.ts";

export interface ForecastSnapshot {
  season: string;
  date: string;
  matchesUsed: { start: string; home: string; away: string; score: string }[];
  parameters: {
    decay: number;
    ridge: number;
    dixonColes: boolean;
    home: number;
    altitude: number;
    rho: number;
    intercept: number;
  };
  simulations: number;
  seed: number;
  matches: MatchForecast[];
  teams: TeamForecast[];
  backtest: BacktestResult;
}

const ROOT = join(import.meta.dirname, "..", "..", "data", "forecasts");

function forecastDir(season: string, root = ROOT): string {
  return join(root, season);
}

export function snapshotExists(season: string, date: string, root = ROOT): boolean {
  return existsSync(join(forecastDir(season, root), `${date}.json`));
}

export function writeSnapshot(snapshot: ForecastSnapshot, root = ROOT): string {
  return writeImmutable(snapshot.season, snapshot.date, snapshot, root);
}

export function writeImmutable(
  series: string,
  date: string,
  snapshot: unknown,
  root = ROOT,
): string {
  const dir = forecastDir(series, root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${date}.json`);
  if (existsSync(path)) {
    throw new Error(`forecast snapshot ${path} already exists and is never rewritten`);
  }
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
  return path;
}

export function latestJson<T>(series: string, root = ROOT): T | null {
  const dir = forecastDir(series, root);
  if (!existsSync(dir)) return null;
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .at(-1);
  if (!latest) return null;
  return JSON.parse(readFileSync(join(dir, latest), "utf8")) as T;
}

export function latestSnapshot(season: string, root = ROOT): ForecastSnapshot | null {
  return latestJson<ForecastSnapshot>(season, root);
}

export function allSnapshots<T = ForecastSnapshot>(series: string, root = ROOT): T[] {
  const dir = forecastDir(series, root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T);
}

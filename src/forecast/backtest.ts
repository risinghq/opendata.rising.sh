import type { HeldMatch, TemporadaData } from "../data/types.ts";
import { isHeld } from "../data/stats-temporada.ts";
import { altDiff } from "./simulate.ts";
import { fit, probabilities, type FitOptions } from "./model.ts";

export interface Score {
  logLoss: number;
  brier: number;
  matches: number;
}

export interface BacktestResult {
  rounds: number;
  model: Score;
  baseRates: Score;
  odds: Score | null;
}

const LIMA_OFFSET_MS = 5 * 3_600_000;
const limaDay = (instant: string) =>
  new Date(new Date(instant).getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10);

function matchKey(m: { start: string; home: string; away: string }): string {
  return `${limaDay(m.start)}|${m.home}|${m.away}`;
}

export function toInput(
  m: {
    home: string;
    away: string;
    stadium: string;
    homeScore: number;
    awayScore: number;
    start: string;
  },
  event: TemporadaData,
  today: string,
) {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(m.start)) / 86_400_000;
  return {
    home: m.home,
    away: m.away,
    homeGoals: m.homeScore,
    awayGoals: m.awayScore,
    altDiff: altDiff(event, m),
    daysAgo: Math.max(0, days),
  };
}

export const outcome = (m: { homeScore: number; awayScore: number }) =>
  m.homeScore > m.awayScore ? 0 : m.homeScore === m.awayScore ? 1 : 2;

export function outcomeRates(
  matches: { homeScore: number; awayScore: number }[],
): [number, number, number] {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const m of matches) {
    const out = outcome(m);
    if (out === 0) home++;
    else if (out === 1) draw++;
    else away++;
  }
  const n = matches.length;
  return [home / n, draw / n, away / n];
}

export function score(preds: { p: [number, number, number]; out: number }[]): Score {
  let ll = 0;
  let br = 0;
  for (const { p, out } of preds) {
    ll -= Math.log(Math.max(p[out]!, 1e-9));
    br +=
      (p[0]! - (out === 0 ? 1 : 0)) ** 2 +
      (p[1]! - (out === 1 ? 1 : 0)) ** 2 +
      (p[2]! - (out === 2 ? 1 : 0)) ** 2;
  }
  return { logLoss: ll / preds.length, brier: br / preds.length, matches: preds.length };
}

export function backtest(
  event: TemporadaData,
  options: FitOptions,
  odds: Map<string, [number, number, number]>,
): BacktestResult {
  const clausura = event.matches.filter((m) => m.tournament === "clausura");
  const rounds = [...new Set(clausura.filter(isHeld).map((m) => m.round))].sort((a, b) => a - b);
  const teams = event.teams.map((t) => t.id);
  const held = event.matches.filter((m): m is HeldMatch => isHeld(m));

  const model: { p: [number, number, number]; out: number }[] = [];
  const base: { p: [number, number, number]; out: number }[] = [];
  const market: { p: [number, number, number]; out: number }[] = [];

  for (const round of rounds) {
    const played = clausura.filter((m): m is HeldMatch => m.round === round && isHeld(m));
    const cutoff = Math.min(...played.map((m) => Date.parse(m.start)));
    const training = held.filter((m) => Date.parse(m.start) < cutoff);
    if (training.length < 30) continue;
    const cutoffDate = new Date(cutoff).toISOString().slice(0, 10);
    const params = fit(
      training.map((m) => toInput(m, event, cutoffDate)),
      teams,
      options,
    );
    const prior = outcomeRates(training);
    for (const m of played) {
      const out = outcome(m);
      const p = probabilities(params, m.home, m.away, altDiff(event, m));
      model.push({ p: [p.home, p.draw, p.away], out });
      base.push({ p: prior, out });
      const q = odds.get(matchKey(m));
      if (q) market.push({ p: q, out });
    }
  }
  return {
    rounds: rounds.filter((r) => {
      const played = clausura.filter((m) => m.round === r && isHeld(m));
      const cutoff = Math.min(...played.map((m) => Date.parse(m.start)));
      return held.filter((m) => Date.parse(m.start) < cutoff).length >= 30;
    }).length,
    model: score(model),
    baseRates: score(base),
    odds: market.length === 0 ? null : score(market),
  };
}

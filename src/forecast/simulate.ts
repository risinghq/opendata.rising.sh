import type { TemporadaData } from "../data/types.ts";
import { isHeld } from "../data/stats-temporada.ts";
import { expected, probabilities, type ModelParams } from "./model.ts";
import { mulberry32, samplePoisson } from "./poisson.ts";
import { matchResult, order, resolveSeason, table, type MatchResult } from "./rules.ts";

export interface MatchForecast {
  tournament: string;
  round: number;
  start: string;
  home: string;
  away: string;
  pHome: number;
  pDraw: number;
  pAway: number;
  xHome: number;
  xAway: number;
}

export interface TeamForecast {
  team: string;
  clausura: number;
  season: number;
  relegation: number;
}

export interface SimulationResult {
  matches: MatchForecast[];
  teams: TeamForecast[];
}

export function altDiff(
  event: TemporadaData,
  match: { home: string; away: string; stadium: string },
): number {
  const stadium = new Map(event.stadiums.map((s) => [s.id, s.altitude]));
  const homeStadium = new Map<string, Map<string, number>>();
  for (const m of event.matches) {
    const uses = homeStadium.get(m.home) ?? new Map<string, number>();
    uses.set(m.stadium, (uses.get(m.stadium) ?? 0) + 1);
    homeStadium.set(m.home, uses);
  }
  const base = (team: string) =>
    stadium.get(
      [...(homeStadium.get(team)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
    ) ?? 0;
  return ((stadium.get(match.stadium) ?? 0) - base(match.away)) / 1000;
}

export function simulate(
  event: TemporadaData,
  params: ModelParams,
  sims: number,
  seed: number,
): SimulationResult {
  const teams = event.teams.map((t) => t.id);
  const apertura = event.matches
    .filter((m) => m.tournament === "apertura")
    .flatMap((m) => {
      const r = matchResult(m);
      return r ? [r] : [];
    });
  const clausuraHeld = event.matches
    .filter((m) => m.tournament === "clausura")
    .flatMap((m) => {
      const r = matchResult(m);
      return r ? [r] : [];
    });
  const remaining = event.matches.filter((m) => m.tournament === "clausura" && !isHeld(m));

  const clausuraWins = new Map<string, number>();
  const championWins = new Map<string, number>();
  const relegations = new Map<string, number>();
  const lambdas = remaining.map((m) => {
    const diff = altDiff(event, m);
    return { expected: expected(params, m.home, m.away, diff), diff };
  });

  for (let sim = 0; sim < sims; sim++) {
    const rng = mulberry32(seed + sim);
    const simulated: MatchResult[] = remaining.map((m, i) => {
      const { home: lh, away: la } = lambdas[i]!.expected;
      return {
        home: m.home,
        away: m.away,
        homeScore: samplePoisson(lh, rng),
        awayScore: samplePoisson(la, rng),
      };
    });
    const playoff = (a: string, b: string) => {
      const { home: lh, away: la } = expected(params, a, b, 0);
      const hs = samplePoisson(lh * Math.exp(-params.home), rng);
      const as = samplePoisson(la, rng);
      return hs === as ? (rng() < 0.5 ? a : b) : hs > as ? a : b;
    };
    const outcome = resolveSeason(teams, apertura, [...clausuraHeld, ...simulated], rng, playoff);
    clausuraWins.set(outcome.clausuraWinner, (clausuraWins.get(outcome.clausuraWinner) ?? 0) + 1);
    championWins.set(outcome.champion, (championWins.get(outcome.champion) ?? 0) + 1);
    for (const t of outcome.relegated) relegations.set(t, (relegations.get(t) ?? 0) + 1);
  }

  const matches: MatchForecast[] = remaining.map((m, i) => {
    const { expected: e, diff } = lambdas[i]!;
    const { home: pHome, draw: pDraw, away: pAway } = probabilities(params, m.home, m.away, diff);
    return {
      tournament: m.tournament,
      round: m.round,
      start: m.start,
      home: m.home,
      away: m.away,
      pHome,
      pDraw,
      pAway,
      xHome: Math.round(e.home * 100) / 100,
      xAway: Math.round(e.away * 100) / 100,
    };
  });
  const teamRows: TeamForecast[] = teams
    .map((t) => ({
      team: t,
      clausura: (clausuraWins.get(t) ?? 0) / sims,
      season: (championWins.get(t) ?? 0) / sims,
      relegation: (relegations.get(t) ?? 0) / sims,
    }))
    .sort((a, b) => b.season - a.season || b.clausura - a.clausura || a.relegation - b.relegation);
  return { matches, teams: teamRows };
}

export { order, table };

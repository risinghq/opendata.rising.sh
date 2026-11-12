import { isHeld } from "../data/stats-temporada.ts";
import type { HeldMatch, TemporadaData } from "../data/types.ts";
import { outcome, outcomeRates, score, type Score } from "./backtest.ts";
import { allSnapshots, type ForecastSnapshot } from "./snapshot.ts";

export interface PublishedScore {
  date: string;
  matches: number;
  model: Score | null;
  baseRates: Score | null;
}

const key = (m: { tournament: string; home: string; away: string }) =>
  `${m.tournament}|${m.home}|${m.away}`;

function baseRates(snap: ForecastSnapshot): [number, number, number] | null {
  if (snap.matchesUsed.length === 0) return null;
  return outcomeRates(
    snap.matchesUsed.map((m) => {
      const [homeScore, awayScore] = m.score.split("-").map(Number);
      return { homeScore: homeScore!, awayScore: awayScore! };
    }),
  );
}

export function scoreSnapshots(
  event: TemporadaData,
  snapshots: ForecastSnapshot[],
): PublishedScore[] {
  const held = new Map<string, HeldMatch>();
  for (const m of event.matches) if (isHeld(m)) held.set(key(m), m);
  return snapshots.map((snap) => {
    const prior = baseRates(snap);
    const model: { p: [number, number, number]; out: number }[] = [];
    const base: { p: [number, number, number]; out: number }[] = [];
    const seen = new Set<string>();
    for (const f of snap.matches) {
      const k = key(f);
      if (seen.has(k)) continue;
      const m = held.get(k);
      if (!m) continue;
      seen.add(k);
      const out = outcome(m);
      model.push({ p: [f.pHome, f.pDraw, f.pAway], out });
      if (prior) base.push({ p: prior, out });
    }
    return {
      date: snap.date,
      matches: model.length,
      model: model.length === 0 ? null : score(model),
      baseRates: base.length === 0 ? null : score(base),
    };
  });
}

export function publishedScores(event: TemporadaData & { slug: string }): PublishedScore[] {
  return scoreSnapshots(event, allSnapshots(event.slug));
}

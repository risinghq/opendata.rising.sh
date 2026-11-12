import type { Match } from "../data/types.ts";
import { isHeld } from "../data/stats-temporada.ts";

interface Row {
  team: string;
  points: number;
  gd: number;
  gf: number;
  fairPlay: number;
  fairPlayKnown: boolean;
}

export function table(
  teams: string[],
  matches: {
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
    cards?: { yellow: number; red: number }[];
  }[],
): Row[] {
  const rows = new Map<string, Row>(
    teams.map((t) => [t, { team: t, points: 0, gd: 0, gf: 0, fairPlay: 0, fairPlayKnown: true }]),
  );
  for (const m of matches) {
    const h = rows.get(m.home)!;
    const a = rows.get(m.away)!;
    h.gf += m.homeScore;
    a.gf += m.awayScore;
    h.gd += m.homeScore - m.awayScore;
    a.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) h.points += 3;
    else if (m.homeScore === m.awayScore) {
      h.points += 1;
      a.points += 1;
    } else a.points += 3;
    if (m.cards === undefined || m.cards.length !== 2) {
      h.fairPlayKnown = false;
      a.fairPlayKnown = false;
    } else {
      h.fairPlay += m.cards[0]!.yellow + 3 * m.cards[0]!.red;
      a.fairPlay += m.cards[1]!.yellow + 3 * m.cards[1]!.red;
    }
  }
  return [...rows.values()];
}

export function order(
  rows: Row[],
  headToHead: { home: string; away: string; homeScore: number; awayScore: number }[] | null,
  rng: () => number,
): string[] {
  const draw = new Map(rows.map((r) => [r.team, rng()]));
  const tied = [...rows].sort((a, b) => compare(a, b, headToHead, draw));
  return tied.map((r) => r.team);
}

function compare(
  a: Row,
  b: Row,
  h2h: { home: string; away: string; homeScore: number; awayScore: number }[] | null,
  draw: Map<string, number>,
): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  if (a.fairPlayKnown && b.fairPlayKnown && a.fairPlay !== b.fairPlay)
    return a.fairPlay - b.fairPlay;
  if (h2h) {
    const pa = h2hPoints(a.team, h2h);
    const pb = h2hPoints(b.team, h2h);
    if (pa !== pb) return pb - pa;
  }
  return draw.get(b.team)! - draw.get(a.team)!;
}

function h2hPoints(
  team: string,
  matches: { home: string; away: string; homeScore: number; awayScore: number }[],
): number {
  let points = 0;
  for (const m of matches) {
    if (m.home === team)
      points += m.homeScore > m.awayScore ? 3 : m.homeScore === m.awayScore ? 1 : 0;
    else if (m.away === team)
      points += m.awayScore > m.homeScore ? 3 : m.awayScore === m.homeScore ? 1 : 0;
  }
  return points;
}

export interface MatchResult {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  cards?: { yellow: number; red: number }[];
}

export function matchResult(match: Match): MatchResult | null {
  if (!isHeld(match)) return null;
  const cards =
    match.events === undefined
      ? undefined
      : [
          {
            yellow: match.events.cards.filter((c) => c.team === "home" && c.colour === "yellow")
              .length,
            red: match.events.cards.filter((c) => c.team === "home" && c.colour === "red").length,
          },
          {
            yellow: match.events.cards.filter((c) => c.team === "away" && c.colour === "yellow")
              .length,
            red: match.events.cards.filter((c) => c.team === "away" && c.colour === "red").length,
          },
        ];
  return {
    home: match.home,
    away: match.away,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    cards,
  };
}

export interface SeasonOutcome {
  clausuraWinner: string;
  champion: string;
  relegated: string[];
  order: string[];
}

export function resolveSeason(
  teams: string[],
  apertura: MatchResult[],
  clausura: MatchResult[],
  rng: () => number,
  playoff: (home: string, away: string) => string,
): Omit<SeasonOutcome, "order"> & { order: string[] } {
  const aperturaOrder = order(table(teams, apertura), null, rng);
  const clausuraOrder = order(table(teams, clausura), null, rng);
  const accOrder = order(table(teams, [...apertura, ...clausura]), [...apertura, ...clausura], rng);
  const aw = aperturaOrder[0]!;
  const cw = clausuraOrder[0]!;
  const top2 = accOrder.slice(0, 2);

  let champion: string;
  if (aw === cw) {
    champion = aw;
  } else if (top2.includes(aw) && top2.includes(cw)) {
    champion = playoff(aw, cw);
  } else if (top2.includes(aw) || top2.includes(cw)) {
    const finalist = top2.includes(aw) ? aw : cw;
    const other = top2.includes(aw) ? cw : aw;
    const rival = top2.find((t) => t !== finalist)!;
    champion = playoff(finalist, playoff(other, rival));
  } else {
    champion = playoff(playoff(accOrder[0]!, cw), playoff(accOrder[1]!, aw));
  }
  return {
    clausuraWinner: cw,
    champion,
    relegated: accOrder.slice(16, 18),
    order: accOrder,
  };
}

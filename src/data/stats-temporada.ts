import type { HeldMatch, Match, PlannedMatch, Stadium, TemporadaData } from "./types.ts";

export interface Standing {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  pointsPerMatch: number;
}

export interface KeyFigures {
  held: number;
  total: number;
  goals: number;
  goalsPerMatch: number;
  homeWins: number;
  draws: number;
  awayWins: number;
}

export interface AltitudePoint {
  stadium: Stadium;
  matches: number;
  homePoints: number;
  pointsPerMatch: number;
}

export const MIN_MATCHES_PER_STADIUM = 5;

export const isHeld = (match: Match): match is HeldMatch => match.status === "held";
const isPlanned = (match: Match): match is PlannedMatch => match.status === "planned";

export function heldMatches(event: TemporadaData, tournament?: string): HeldMatch[] {
  return event.matches
    .filter(isHeld)
    .filter((match) => tournament === undefined || match.tournament === tournament);
}

export function keyFigures(event: TemporadaData): KeyFigures {
  const held = heldMatches(event);
  const goals = held.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0);
  return {
    held: held.length,
    total: event.matches.length,
    goals,
    goalsPerMatch: held.length === 0 ? 0 : goals / held.length,
    homeWins: held.filter((m) => m.homeScore > m.awayScore).length,
    draws: held.filter((m) => m.homeScore === m.awayScore).length,
    awayWins: held.filter((m) => m.homeScore < m.awayScore).length,
  };
}

export function standings(event: TemporadaData, tournament?: string): Standing[] {
  const table = new Map<string, Standing>(
    event.teams.map((team) => [
      team.id,
      {
        team: team.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        pointsPerMatch: 0,
      },
    ]),
  );
  const apply = (id: string, scored: number, conceded: number) => {
    const row = table.get(id)!;
    row.played++;
    row.goalsFor += scored;
    row.goalsAgainst += conceded;
    if (scored > conceded) row.won++;
    else if (scored === conceded) row.drawn++;
    else row.lost++;
  };
  for (const match of heldMatches(event, tournament)) {
    apply(match.home, match.homeScore, match.awayScore);
    apply(match.away, match.awayScore, match.homeScore);
  }
  const names = new Map(event.teams.map((team) => [team.id, team.name]));
  return [...table.values()]
    .map((row) => {
      const points = row.won * 3 + row.drawn;
      return {
        ...row,
        goalDifference: row.goalsFor - row.goalsAgainst,
        points,
        pointsPerMatch: row.played === 0 ? 0 : points / row.played,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        names.get(a.team)!.localeCompare(names.get(b.team)!, "es"),
    );
}

export function altitudePoints(event: TemporadaData): AltitudePoint[] {
  const stats = new Map<string, { matches: number; points: number }>();
  for (const match of heldMatches(event)) {
    const entry = stats.get(match.stadium) ?? { matches: 0, points: 0 };
    entry.matches++;
    entry.points +=
      match.homeScore > match.awayScore ? 3 : match.homeScore === match.awayScore ? 1 : 0;
    stats.set(match.stadium, entry);
  }
  return event.stadiums
    .flatMap((stadium) => {
      const entry = stats.get(stadium.id);
      if (!entry || entry.matches < MIN_MATCHES_PER_STADIUM) return [];
      return [
        {
          stadium,
          matches: entry.matches,
          homePoints: entry.points,
          pointsPerMatch: entry.points / entry.matches,
        },
      ];
    })
    .sort((a, b) => a.stadium.altitude - b.stadium.altitude);
}

export interface TeamAverage {
  team: string;
  matches: number;
  possession: number;
  shotsOnTarget: number;
  shotsOnTargetAgainst: number;
  dangerousAttacks: number;
}

export function teamAverages(event: TemporadaData): TeamAverage[] {
  const sums = new Map<string, Omit<TeamAverage, "team">>();
  for (const match of heldMatches(event)) {
    const stats = match.events?.stats;
    if (!stats) continue;
    for (const [id, own, other] of [
      [match.home, stats.home, stats.away],
      [match.away, stats.away, stats.home],
    ] as const) {
      const row = sums.get(id) ?? {
        matches: 0,
        possession: 0,
        shotsOnTarget: 0,
        shotsOnTargetAgainst: 0,
        dangerousAttacks: 0,
      };
      row.matches++;
      row.possession += own.possession;
      row.shotsOnTarget += own.shotsOnTarget;
      row.shotsOnTargetAgainst += other.shotsOnTarget;
      row.dangerousAttacks += own.dangerousAttacks;
      sums.set(id, row);
    }
  }
  const names = new Map(event.teams.map((team) => [team.id, team.name]));
  return [...sums]
    .map(([team, row]) => ({
      team,
      matches: row.matches,
      possession: row.possession / row.matches,
      shotsOnTarget: row.shotsOnTarget / row.matches,
      shotsOnTargetAgainst: row.shotsOnTargetAgainst / row.matches,
      dangerousAttacks: row.dangerousAttacks / row.matches,
    }))
    .sort(
      (a, b) =>
        b.possession - a.possession || names.get(a.team)!.localeCompare(names.get(b.team)!, "es"),
    );
}

export function rounds(event: TemporadaData, tournament: string): Map<number, Match[]> {
  const out = new Map<number, Match[]>();
  for (const match of event.matches.filter((m) => m.tournament === tournament)) {
    out.set(match.round, [...(out.get(match.round) ?? []), match]);
  }
  for (const list of out.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  return new Map([...out].sort((a, b) => a[0] - b[0]));
}

export function currentRounds(event: TemporadaData, tournament: string): Set<number> {
  const open = new Set<number>();
  const list = [...rounds(event, tournament)];
  const lastHeld = list.filter(([, ms]) => ms.some(isHeld)).at(-1);
  const firstPlanned = list.find(([, ms]) => ms.some(isPlanned));
  if (lastHeld && firstPlanned) {
    open.add(lastHeld[0]);
    open.add(firstPlanned[0]);
  }
  return open;
}

export interface Trend {
  slopePerKm: number;
  intercept: number;
}

export function trend(points: AltitudePoint[]): Trend | undefined {
  const weight = points.reduce((sum, p) => sum + p.matches, 0);
  if (points.length < 2 || weight === 0) return undefined;
  const meanX = points.reduce((s, p) => s + p.matches * p.stadium.altitude, 0) / weight;
  const meanY = points.reduce((s, p) => s + p.matches * p.pointsPerMatch, 0) / weight;
  const variance = points.reduce((s, p) => s + p.matches * (p.stadium.altitude - meanX) ** 2, 0);
  if (variance === 0) return undefined;
  const covariance = points.reduce(
    (s, p) => s + p.matches * (p.stadium.altitude - meanX) * (p.pointsPerMatch - meanY),
    0,
  );
  const slope = covariance / variance;
  return { slopePerKm: slope * 1000, intercept: meanY - slope * meanX };
}

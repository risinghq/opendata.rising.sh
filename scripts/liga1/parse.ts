import type {
  CardEvent,
  GoalEvent,
  MatchEvents,
  MatchStats,
  TeamStats,
  TimedEvent,
} from "../../src/data/types.ts";

export interface ApiEvent {
  type: string;
  minute: number | null;
  team: "home" | "away" | null;
  count?: number;
  period?: string;
  score?: { home: number; away: number };
  detail?: string;
  kind?: string;
}

export interface ApiPair {
  home: number;
  away: number;
}

export interface ApiStatistics {
  attacks?: ApiPair;
  dangerous_attacks?: ApiPair;
  shots_on_target?: ApiPair;
  shots_off_target?: ApiPair;
  possession?: ApiPair;
  first_half?: Partial<Omit<ApiStatistics, "first_half">>;
}

export interface ApiFixture {
  id: number;
  kickoff_utc: string;
  status: string;
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number; away: number; half_home?: number; half_away?: number } | null;
  corners?: { home: number; away: number } | null;
  cards?: {
    home: { yellow: number; red: number };
    away: { yellow: number; red: number };
  } | null;
  events?: ApiEvent[];
  statistics?: ApiStatistics | null;
}

const STAT_FIELDS = {
  possession: "possession",
  shotsOnTarget: "shots_on_target",
  shotsOffTarget: "shots_off_target",
  attacks: "attacks",
  dangerousAttacks: "dangerous_attacks",
} as const satisfies Record<keyof TeamStats, Exclude<keyof ApiStatistics, "first_half">>;

export function parseStats(statistics: ApiStatistics | null | undefined): MatchStats | null {
  if (!statistics) return null;
  const side = (team: "home" | "away"): TeamStats | null => {
    const stats: Partial<TeamStats> = {};
    for (const field of Object.keys(STAT_FIELDS) as (keyof TeamStats)[]) {
      const value = statistics[STAT_FIELDS[field]]?.[team];
      if (typeof value !== "number") return null;
      stats[field] = value;
    }
    return stats as TeamStats;
  };
  const home = side("home");
  const away = side("away");
  return home && away ? { home, away } : null;
}

export function parseEvents(fixture: ApiFixture): MatchEvents | null {
  if (fixture.status !== "finished") return null;
  const goals: GoalEvent[] = [];
  const cards: CardEvent[] = [];
  const cornerMinutes: TimedEvent[] = [];
  const substitutions: TimedEvent[] = [];
  const missedPenalties: TimedEvent[] = [];
  const timed: Record<string, TimedEvent[]> = {
    corner: cornerMinutes,
    substitution: substitutions,
    missed_penalty: missedPenalties,
  };
  let halfTime: { home: number; away: number } | null = null;
  let corners = fixture.corners ? { home: fixture.corners.home, away: fixture.corners.away } : null;
  for (const ev of fixture.events ?? []) {
    if (ev.type === "goal") {
      goals.push({ minute: ev.minute ?? 0, team: ev.team ?? "home" });
    } else if (ev.type === "yellow_card" || ev.type === "red_card") {
      cards.push({
        minute: ev.minute ?? 0,
        team: ev.team ?? "home",
        colour: ev.type === "yellow_card" ? "yellow" : "red",
      });
    } else if (ev.type in timed && ev.minute !== null && ev.team !== null) {
      timed[ev.type]!.push({ minute: ev.minute, team: ev.team });
    } else if (ev.type === "period_score" && ev.period === "first_half" && ev.score) {
      halfTime = { home: ev.score.home, away: ev.score.away };
    }
  }
  if (halfTime === null && fixture.goals?.half_home !== undefined) {
    halfTime = { home: fixture.goals.half_home, away: fixture.goals.half_away! };
  }
  if (halfTime === null || corners === null) return null;
  for (const list of Object.values(timed)) list.sort((a, b) => a.minute - b.minute);
  return {
    halfTime,
    goals,
    cards,
    corners,
    cornerMinutes,
    substitutions,
    missedPenalties,
    stats: parseStats(fixture.statistics),
  };
}

const LIMA_OFFSET_MS = 5 * 3_600_000;
export function limaDate(utc: string): string {
  return new Date(new Date(utc).getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

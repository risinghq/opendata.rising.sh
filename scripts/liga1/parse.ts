import type { CardEvent, GoalEvent, MatchEvents } from "../../src/data/types.ts";

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
}

export function parseEvents(fixture: ApiFixture): MatchEvents | null {
  if (fixture.status !== "finished") return null;
  const goals: GoalEvent[] = [];
  const cards: CardEvent[] = [];
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
    } else if (ev.type === "period_score" && ev.period === "first_half" && ev.score) {
      halfTime = { home: ev.score.home, away: ev.score.away };
    }
  }
  if (halfTime === null && fixture.goals?.half_home !== undefined) {
    halfTime = { home: fixture.goals.half_home, away: fixture.goals.half_away! };
  }
  if (halfTime === null || corners === null) return null;
  return { halfTime, goals, cards, corners };
}

const LIMA_OFFSET_MS = 5 * 3_600_000;
export function limaDate(utc: string): string {
  return new Date(new Date(utc).getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

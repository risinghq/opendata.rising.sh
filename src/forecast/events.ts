import type { TemporadaData } from "../data/types.ts";
import { isHeld } from "../data/stats-temporada.ts";

export interface GoalPeriod {
  label: string;
  home: number;
  away: number;
}

const LABELS = ["0–15", "15–30", "30–45", "45–60", "60–75", "75–90+"];

export function goalTiming(event: TemporadaData): GoalPeriod[] {
  const periods = LABELS.map((label) => ({ label, home: 0, away: 0 }));
  for (const match of event.matches) {
    if (!isHeld(match) || match.events === undefined) continue;
    for (const goal of match.events.goals) {
      const bucket = Math.min(Math.floor(Math.max(goal.minute - 1, 0) / 15), 5);
      periods[bucket]![goal.team]++;
    }
  }
  return periods;
}

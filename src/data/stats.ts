import type { EventData, HeldAct, PlannedAct } from "./types.ts";

export interface Range {
  low: number;
  central: number;
  high: number;
}

export interface Day {
  date: string;
  day: Range;
  total: Range;
  held: boolean;
}

export const actDate = (act: { start: string }) => act.start.slice(0, 10);

export function heldActs(event: EventData): HeldAct[] {
  return event.acts.filter((act): act is HeldAct => act.status === "held");
}

export function plannedActs(event: EventData): PlannedAct[] {
  return event.acts.filter((act): act is PlannedAct => act.status === "planned");
}

export function sumRange(acts: Range[]): Range {
  return acts.reduce(
    (sum, act) => ({
      low: sum.low + act.low,
      central: sum.central + act.central,
      high: sum.high + act.high,
    }),
    { low: 0, central: 0, high: 0 },
  );
}

export function eventStatus(event: EventData): "en curso" | "finalizado" {
  return plannedActs(event).length > 0 ? "en curso" : "finalizado";
}

export function largestAct(event: EventData): HeldAct | undefined {
  return heldActs(event).reduce<HeldAct | undefined>(
    (best, act) => (best === undefined || act.central > best.central ? act : best),
    undefined,
  );
}

function addDays(date: string, days: number): string {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

export function dailyTotals(event: EventData): Day[] {
  const held = heldActs(event);
  const last = held.map(actDate).sort().at(-1);
  const days: Day[] = [];
  let running: Range = { low: 0, central: 0, high: 0 };
  if (last === undefined) return days;
  for (let date = event.start; date <= last; date = addDays(date, 1)) {
    const today = held.filter((act) => actDate(act) === date);
    const day = sumRange(today);
    running = sumRange([running, day]);
    days.push({ date, day, total: running, held: today.length > 0 });
  }
  return days;
}

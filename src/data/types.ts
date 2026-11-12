export interface Source {
  outlet: string;
  url: string;
}

interface ActBase {
  start: string;
  country: string;
  city: string;
  venue: string;
  name: string;
}

export interface HeldAct extends ActBase {
  status: "held";
  low: number;
  central: number;
  high: number;
  attribution: string;
  sources: Source[];
}

export interface Expected {
  figure: number;
  attribution: string;
  source: Source;
}

export interface PlannedAct extends ActBase {
  status: "planned";
  expected?: Expected;
}

export type Act = HeldAct | PlannedAct;

export interface Comparison {
  label: string;
  figure: number;
  attribution: string;
  source: Source;
}

export interface EventData {
  title: string;
  summary: string;
  start: string;
  end: string;
  places: string[];
  updated: string;
  method: string;
  acts: Act[];
  comparison?: Comparison[];
}

export interface EventRecord extends EventData {
  slug: string;
}

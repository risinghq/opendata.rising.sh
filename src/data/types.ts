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

interface EventBase {
  title: string;
  summary: string;
  start: string;
  end: string;
  places: string[];
  updated: string;
  method: string;
}

export interface AsistenciaData extends EventBase {
  kind: "asistencia";
  acts: Act[];
  comparison?: Comparison[];
}

export interface WikiSource {
  outlet: string;
  url: string;
  revision: number;
  revisionDate: string;
  license: string;
}

export interface Tournament {
  id: string;
  name: string;
  source: WikiSource;
}

export interface Team {
  id: string;
  name: string;
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  altitude: number;
  source: Source;
}

interface MatchBase {
  tournament: string;
  round: number;
  start: string;
  home: string;
  away: string;
  stadium: string;
  referee?: string;
}

export interface HeldMatch extends MatchBase {
  status: "held";
  homeScore: number;
  awayScore: number;
}

export interface PlannedMatch extends MatchBase {
  status: "planned";
}

export type Match = HeldMatch | PlannedMatch;

export interface TemporadaData extends EventBase {
  kind: "temporada";
  tournaments: Tournament[];
  teams: Team[];
  stadiums: Stadium[];
  matches: Match[];
}

export type EventData = AsistenciaData | TemporadaData;

export type AsistenciaRecord = AsistenciaData & { slug: string };
export type TemporadaRecord = TemporadaData & { slug: string };
export type EventRecord = AsistenciaRecord | TemporadaRecord;

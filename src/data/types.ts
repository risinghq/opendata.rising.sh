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

export type CardColour = "yellow" | "red";

export interface GoalEvent {
  minute: number;
  team: "home" | "away";
}

export interface CardEvent {
  minute: number;
  team: "home" | "away";
  colour: CardColour;
}

export interface Score {
  home: number;
  away: number;
}

export interface MatchEvents {
  halfTime: Score;
  goals: GoalEvent[];
  cards: CardEvent[];
  corners: Score;
}

export interface HeldMatch extends MatchBase {
  status: "held";
  homeScore: number;
  awayScore: number;
  events?: MatchEvents;
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

export interface Figure {
  amount: number;
  source: Source;
}

export interface Budget {
  low: number;
  high?: number;
  source: Source;
}

interface FilmBase {
  title: string;
  originalTitle: string;
  phase: number;
  release: string;
  budget?: Budget;
}

export interface ReleasedFilm extends FilmBase {
  status: "released";
  opening: Figure;
  usCanada: Figure;
  worldwide: Figure;
}

export interface UnreleasedFilm extends FilmBase {
  status: "unreleased";
}

export type Film = ReleasedFilm | UnreleasedFilm;

export interface TaquillaData extends EventBase {
  kind: "taquilla";
  source: WikiSource;
  films: Film[];
}

export type EventData = AsistenciaData | TemporadaData | TaquillaData;

export type AsistenciaRecord = AsistenciaData & { slug: string };
export type TemporadaRecord = TemporadaData & { slug: string };
export type TaquillaRecord = TaquillaData & { slug: string };
export type EventRecord = AsistenciaRecord | TemporadaRecord | TaquillaRecord;

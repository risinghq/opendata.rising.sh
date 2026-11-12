import { tournamentNotice } from "./data/notice.ts";
import type { TemporadaRecord } from "./data/types.ts";
import { csv } from "./downloads-csv.ts";

const HEADER = [
  "torneo",
  "fecha",
  "inicio",
  "local",
  "visitante",
  "estadio",
  "ciudad",
  "altitud_m",
  "arbitro",
  "estado",
  "goles_local",
  "goles_visitante",
  "fuente",
  "aviso",
];

export function temporadaJson(event: TemporadaRecord): string {
  const { kind, ...rest } = event;
  const aviso = event.tournaments.map(tournamentNotice).join(". ");
  return `${JSON.stringify({ kind, aviso, ...rest }, null, 2)}\n`;
}

export function temporadaCsv(event: TemporadaRecord): string {
  const tournaments = new Map(event.tournaments.map((t) => [t.id, t]));
  const teams = new Map(event.teams.map((t) => [t.id, t.name]));
  const stadiums = new Map(event.stadiums.map((s) => [s.id, s]));
  const rows = event.matches.map((match) => {
    const tournament = tournaments.get(match.tournament)!;
    const stadium = stadiums.get(match.stadium)!;
    const held = match.status === "held";
    return [
      tournament.name,
      match.round,
      match.start,
      teams.get(match.home),
      teams.get(match.away),
      stadium.name,
      stadium.city,
      stadium.altitude,
      match.referee,
      held ? "realizado" : "previsto",
      held ? match.homeScore : undefined,
      held ? match.awayScore : undefined,
      tournament.source.url,
      tournamentNotice(tournament),
    ];
  });
  return csv(HEADER, rows);
}

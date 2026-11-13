import { eventNotice } from "./data/notice.ts";
import type { TemporadaRecord } from "./data/types.ts";
import type { PublishedScore } from "./forecast/scoring.ts";
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
  "posesion_local",
  "posesion_visitante",
  "tiros_arco_local",
  "tiros_arco_visitante",
  "tiros_fuera_local",
  "tiros_fuera_visitante",
  "ataques_local",
  "ataques_visitante",
  "ataques_peligrosos_local",
  "ataques_peligrosos_visitante",
  "fuente",
  "aviso",
];

export function temporadaJson(event: TemporadaRecord, scores: PublishedScore[] = []): string {
  const { kind, ...rest } = event;
  return `${JSON.stringify({ kind, aviso: eventNotice(event), ...rest, forecastScores: scores }, null, 2)}\n`;
}

export function temporadaCsv(event: TemporadaRecord): string {
  const tournaments = new Map(event.tournaments.map((t) => [t.id, t]));
  const teams = new Map(event.teams.map((t) => [t.id, t.name]));
  const stadiums = new Map(event.stadiums.map((s) => [s.id, s]));
  const rows = event.matches.map((match) => {
    const tournament = tournaments.get(match.tournament)!;
    const stadium = stadiums.get(match.stadium)!;
    const held = match.status === "held";
    const stats = held ? match.events?.stats : undefined;
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
      stats?.home.possession,
      stats?.away.possession,
      stats?.home.shotsOnTarget,
      stats?.away.shotsOnTarget,
      stats?.home.shotsOffTarget,
      stats?.away.shotsOffTarget,
      stats?.home.attacks,
      stats?.away.attacks,
      stats?.home.dangerousAttacks,
      stats?.away.dangerousAttacks,
      tournament.source.url,
      eventNotice(event),
    ];
  });
  return csv(HEADER, rows);
}

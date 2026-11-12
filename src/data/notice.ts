import { formatDate } from "./format.ts";
import type { TaquillaData, TemporadaData, Tournament } from "./types.ts";

export const MATCH_DATA_NOTICE = "Datos de partidos: Football data by 5DollarFootballAPI";
export const MATCH_DATA_URL = "https://5dollarfootballapi.com";

export function tournamentNotice(tournament: Tournament): string {
  const { license, revisionDate } = tournament.source;
  return `Datos de Wikipedia en español (${license}), revisión del ${formatDate(revisionDate)}`;
}

export function taquillaNotice(event: TaquillaData): string {
  const { license, revisionDate } = event.source;
  return `Datos de Wikipedia en inglés (${license}), revisión del ${formatDate(revisionDate)}`;
}

export function hasMatchEvents(event: TemporadaData): boolean {
  return event.matches.some((match) => "events" in match);
}

export function eventNotice(event: TemporadaData): string {
  const revisions = event.tournaments
    .map(
      (tournament) =>
        `${tournament.name}, revisión del ${formatDate(tournament.source.revisionDate)}`,
    )
    .join("; ");
  const license = event.tournaments[0]?.source.license ?? "";
  const api = hasMatchEvents(event) ? ` ${MATCH_DATA_NOTICE} (5dollarfootballapi.com).` : "";
  return `Datos de Wikipedia en español (${license}): ${revisions}.${api}`;
}

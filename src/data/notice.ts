import { formatDate } from "./format.ts";
import type { Tournament } from "./types.ts";

export function tournamentNotice(tournament: Tournament): string {
  const { license, revisionDate } = tournament.source;
  return `Datos de Wikipedia en español (${license}), revisión del ${formatDate(revisionDate)}`;
}

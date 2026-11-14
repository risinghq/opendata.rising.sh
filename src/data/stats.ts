import { plannedActs } from "./stats-asistencia.ts";
import { heldMatches } from "./stats-temporada.ts";
import { releasedFilms } from "./stats-taquilla.ts";
import type { EventData } from "./types.ts";

export function eventStatus(event: EventData): "en curso" | "finalizado" {
  if (event.kind === "asistencia") return plannedActs(event).length > 0 ? "en curso" : "finalizado";
  if (event.kind === "taquilla")
    return releasedFilms(event).length < event.films.length ? "en curso" : "finalizado";
  return heldMatches(event).length < event.matches.length ? "en curso" : "finalizado";
}

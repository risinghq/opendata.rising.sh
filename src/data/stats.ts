import { formatDecimal, formatMoneyCompact, formatNumber } from "./format.ts";
import { heldActs, plannedActs, sumRange } from "./stats-asistencia.ts";
import { heldMatches, keyFigures } from "./stats-temporada.ts";
import { keyFigures as taquillaFigures, releasedFilms } from "./stats-taquilla.ts";
import { loadCpi } from "./cpi.ts";
import type { EventData } from "./types.ts";

export function eventStatus(event: EventData): "en curso" | "finalizado" {
  if (event.kind === "asistencia") return plannedActs(event).length > 0 ? "en curso" : "finalizado";
  if (event.kind === "taquilla")
    return releasedFilms(event).length < event.films.length ? "en curso" : "finalizado";
  return heldMatches(event).length < event.matches.length ? "en curso" : "finalizado";
}

export interface EventSummary {
  kindLabel: string;
  progress: string;
  figureLabel: string;
  figure: string;
}

export function summarize(event: EventData): EventSummary {
  if (event.kind === "asistencia") {
    return {
      kindLabel: "Asistencia",
      progress: `${heldActs(event).length} de ${event.acts.length} actos`,
      figureLabel: "Asistencia total",
      figure: formatNumber(sumRange(heldActs(event)).central),
    };
  }
  if (event.kind === "taquilla") {
    const figures = taquillaFigures(event, loadCpi());
    return {
      kindLabel: "Taquilla",
      progress: `${figures.released} de ${figures.total} películas`,
      figureLabel: "Recaudación mundial",
      figure: formatMoneyCompact(figures.worldwide),
    };
  }
  const figures = keyFigures(event);
  return {
    kindLabel: "Temporada",
    progress: `${figures.held} de ${figures.total} partidos`,
    figureLabel: "Goles por partido",
    figure: formatDecimal(figures.goalsPerMatch),
  };
}

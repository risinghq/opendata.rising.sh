import type { EventRecord } from "./data/types.ts";
import type { PublishedScore } from "./forecast/scoring.ts";
import { asistenciaCsv, asistenciaJson } from "./downloads-asistencia.ts";
import { taquillaCsv, taquillaJson } from "./downloads-taquilla.ts";
import { temporadaCsv, temporadaJson } from "./downloads-temporada.ts";

export const toJson = (event: EventRecord, scores?: PublishedScore[]) =>
  event.kind === "asistencia"
    ? asistenciaJson(event)
    : event.kind === "temporada"
      ? temporadaJson(event, scores)
      : taquillaJson(event);

export const toCsv = (event: EventRecord) =>
  event.kind === "asistencia"
    ? asistenciaCsv(event)
    : event.kind === "temporada"
      ? temporadaCsv(event)
      : taquillaCsv(event);

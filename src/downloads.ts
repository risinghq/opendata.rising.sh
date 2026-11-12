import type { EventRecord } from "./data/types.ts";
import { asistenciaCsv, asistenciaJson } from "./downloads-asistencia.ts";
import { temporadaCsv, temporadaJson } from "./downloads-temporada.ts";

export const toJson = (event: EventRecord) =>
  event.kind === "asistencia" ? asistenciaJson(event) : temporadaJson(event);

export const toCsv = (event: EventRecord) =>
  event.kind === "asistencia" ? asistenciaCsv(event) : temporadaCsv(event);

import type { EventData } from "./types.ts";
import { validateAsistencia } from "./validate-asistencia.ts";
import { createReport, isObj, validateBase } from "./validate-common.ts";
import { validateTaquilla } from "./validate-taquilla.ts";
import { validateTemporada } from "./validate-temporada.ts";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSlug(slug: string): string[] {
  return SLUG.test(slug) ? [] : [`slug "${slug}": use lowercase words joined by hyphens`];
}

export function validateEvent(data: unknown): string[] {
  if (!isObj(data)) return ["event: must be an object"];
  const report = createReport();
  validateBase(data, report);
  if (data.kind === "asistencia") {
    validateAsistencia(data, report);
  } else if (data.kind === "temporada") {
    validateTemporada(data, report);
  } else if (data.kind === "taquilla") {
    validateTaquilla(data, report);
  } else {
    report.fail("kind", 'must be "asistencia", "temporada" or "taquilla"');
  }
  return report.errors;
}

export function assertEvent(slug: string, data: unknown): EventData {
  const errors = [...validateSlug(slug), ...validateEvent(data)];
  if (errors.length > 0)
    throw new Error(`data/events/${slug}.json is invalid:\n${errors.join("\n")}`);
  return data as EventData;
}

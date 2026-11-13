import type { Act, AsistenciaRecord, Source } from "./data/types.ts";
import { csv, type Cell } from "./downloads-csv.ts";

const link = (source: Source) =>
  `${source.outlet}: ${source.url}${source.archive ? ` (copia: ${source.archive})` : ""}`;

const HEADER = [
  "inicio",
  "pais",
  "ciudad",
  "lugar",
  "acto",
  "estado",
  "baja",
  "central",
  "alta",
  "atribucion",
  "fuentes",
  "esperado",
  "esperado_baja",
  "esperado_alta",
  "esperado_atribucion",
  "esperado_fuente",
] as const;

function row(act: Act): Cell[] {
  const common = [act.start, act.country, act.city, act.venue, act.name];
  const expected = act.expected;
  const forecast: Cell[] = [
    expected?.figure,
    expected?.low,
    expected?.high,
    expected?.attribution,
    expected ? link(expected.source) : undefined,
  ];
  if (act.status === "held") {
    const links = act.sources.map(link).join(" | ");
    return [
      ...common,
      "realizado",
      act.low,
      act.central,
      act.high,
      act.attribution,
      links,
      ...forecast,
    ];
  }
  return [
    ...common,
    "previsto",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    ...forecast,
  ];
}

export function asistenciaJson(event: AsistenciaRecord): string {
  return `${JSON.stringify(event, null, 2)}\n`;
}

export function asistenciaCsv(event: AsistenciaRecord): string {
  return csv(HEADER, event.acts.map(row));
}

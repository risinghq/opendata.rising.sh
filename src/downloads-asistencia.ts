import type { Act, AsistenciaRecord } from "./data/types.ts";
import { csv, type Cell } from "./downloads-csv.ts";

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
  "esperado",
  "atribucion",
  "fuentes",
] as const;

function row(act: Act): Cell[] {
  const common = [act.start, act.country, act.city, act.venue, act.name];
  if (act.status === "held") {
    const links = act.sources.map((s) => `${s.outlet}: ${s.url}`).join(" | ");
    return [
      ...common,
      "realizado",
      act.low,
      act.central,
      act.high,
      undefined,
      act.attribution,
      links,
    ];
  }
  const expected = act.expected;
  return [
    ...common,
    "previsto",
    undefined,
    undefined,
    undefined,
    expected?.figure,
    expected?.attribution,
    expected ? `${expected.source.outlet}: ${expected.source.url}` : undefined,
  ];
}

export function asistenciaJson(event: AsistenciaRecord): string {
  return `${JSON.stringify(event, null, 2)}\n`;
}

export function asistenciaCsv(event: AsistenciaRecord): string {
  return csv(HEADER, event.acts.map(row));
}

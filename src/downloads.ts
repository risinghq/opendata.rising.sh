import type { Act, EventRecord } from "./data/types.ts";

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

function cell(value: string | number | undefined): string {
  if (value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function row(act: Act): (string | number | undefined)[] {
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

export function toJson(event: EventRecord): string {
  return `${JSON.stringify(event, null, 2)}\n`;
}

export function toCsv(event: EventRecord): string {
  const lines = [HEADER.join(","), ...event.acts.map((act) => row(act).map(cell).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

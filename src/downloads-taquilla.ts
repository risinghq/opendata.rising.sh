import { claimLabel } from "./data/format.ts";
import { MOJO_LABEL, WIKIPEDIA_LABEL, taquillaNotice } from "./data/notice.ts";
import { isReleased } from "./data/stats-taquilla.ts";
import type { BudgetClaim, Claim, Film, TaquillaData } from "./data/types.ts";

const cell = (value: string | number | undefined) => {
  const text = value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const link = (url: string, archive?: string) => `${url}${archive ? ` (copia: ${archive})` : ""}`;

const figureSources = (film: Film) =>
  [
    ...new Map(
      [
        film.budget?.source,
        isReleased(film) ? film.opening.source : undefined,
        isReleased(film) ? film.usCanada.source : undefined,
        isReleased(film) ? film.worldwide.source : undefined,
      ]
        .filter((s) => s !== undefined)
        .map((s) => [s.url, link(s.url, s.archive)]),
    ).values(),
  ].join(" ");

const disputeCells = (film: Film): { disputa: string; otras: string } => {
  if (!isReleased(film)) return { disputa: "", otras: "" };
  const figures: [string, Claim[] | BudgetClaim[] | undefined][] = [
    ["eeuu_y_canada", film.usCanada.claims],
    ["mundial", film.worldwide.claims],
    ["presupuesto", film.budget?.claims],
  ];
  const names: string[] = [];
  const others: string[] = [];
  for (const [name, claims] of figures) {
    if (!claims?.length) continue;
    names.push(name);
    for (const claim of claims.slice(1)) {
      others.push(`${name}: ${claimLabel(claim)} ${link(claim.source.url, claim.source.archive)}`);
    }
  }
  return { disputa: names.join(" "), otras: others.join(" | ") };
};

export function taquillaJson(event: TaquillaData): string {
  return `${JSON.stringify({ ...event, aviso: taquillaNotice(event) }, null, 2)}\n`;
}

export function taquillaCsv(event: TaquillaData): string {
  const aviso = taquillaNotice(event);
  const header =
    "pelicula,titulo_original,fase,estreno,estado,presupuesto_min_usd,presupuesto_max_usd,estreno_fin_de_semana_usd,eeuu_y_canada_usd,mundial_usd,fuente_taquilla,taquilla_url,taquilla_copia_url,taquilla_consulta,disputa,otras_cifras,fuentes,aviso";
  const rows = event.films.map((film) => {
    const { disputa, otras } = disputeCells(film);
    return [
      film.title,
      film.originalTitle,
      film.phase,
      film.release,
      film.status,
      film.budget?.low,
      film.budget?.high,
      isReleased(film) ? film.opening.amount : undefined,
      isReleased(film) ? film.usCanada.amount : undefined,
      isReleased(film) ? film.worldwide.amount : undefined,
      isReleased(film) ? (film.boxOfficeMojo ? MOJO_LABEL : WIKIPEDIA_LABEL) : undefined,
      isReleased(film) ? film.boxOfficeMojo?.url : undefined,
      isReleased(film) ? film.boxOfficeMojo?.archive : undefined,
      isReleased(film) ? film.boxOfficeMojo?.accessed : undefined,
      disputa,
      otras,
      figureSources(film),
      aviso,
    ]
      .map(cell)
      .join(",");
  });
  return `${[header, ...rows].join("\r\n")}\r\n`;
}

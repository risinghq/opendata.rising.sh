import { taquillaNotice } from "./data/notice.ts";
import { isReleased } from "./data/stats-taquilla.ts";
import type { Film, TaquillaData } from "./data/types.ts";

const cell = (value: string | number | undefined) => {
  const text = value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const figureSources = (film: Film) =>
  [
    ...new Set(
      [
        film.budget?.source,
        isReleased(film) ? film.opening.source : undefined,
        isReleased(film) ? film.usCanada.source : undefined,
        isReleased(film) ? film.worldwide.source : undefined,
      ]
        .filter((s) => s !== undefined)
        .map((s) => s.url),
    ),
  ].join(" ");

export function taquillaJson(event: TaquillaData): string {
  return `${JSON.stringify({ ...event, aviso: taquillaNotice(event) }, null, 2)}\n`;
}

export function taquillaCsv(event: TaquillaData): string {
  const aviso = taquillaNotice(event);
  const header =
    "pelicula,titulo_original,fase,estreno,estado,presupuesto_min_usd,presupuesto_max_usd,estreno_fin_de_semana_usd,eeuu_y_canada_usd,mundial_usd,fuentes,aviso";
  const rows = event.films.map((film) =>
    [
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
      figureSources(film),
      aviso,
    ]
      .map(cell)
      .join(","),
  );
  return `${[header, ...rows].join("\r\n")}\r\n`;
}

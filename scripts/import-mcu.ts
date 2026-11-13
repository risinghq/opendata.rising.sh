import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { fetchPage, limaParts, permalink, spanishTitles, type PageRevision } from "./mediawiki.ts";
import {
  labeledSection,
  openingWeekend,
  parseBoxOfficeRows,
  parseFilmList,
  type RawFilm,
} from "./mcu-wikitext.ts";

const HOST = "en.wikipedia.org";
const LIST_PAGE = "List of Marvel Cinematic Universe films";
const PHASES = [
  "Marvel Cinematic Universe: Phase One",
  "Marvel Cinematic Universe: Phase Two",
  "Marvel Cinematic Universe: Phase Three",
  "Marvel Cinematic Universe: Phase Four",
  "Marvel Cinematic Universe: Phase Five",
  "Marvel Cinematic Universe: Phase Six",
];
const LICENSE = "CC BY-SA 4.0";
const OUTLET = "Wikipedia en inglés";
const CPI_SERIES = "CUUR0000SA0";
const BLS = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

const DEFAULT_FRAME = {
  kind: "taquilla",
  title: "Taquilla del Universo cinematográfico de Marvel",
  summary:
    "Recaudación de las películas del Universo cinematográfico de Marvel en dólares de Estados Unidos, nominales y ajustadas por inflación, con un pronóstico para Avengers: Doomsday.",
  places: ["Estados Unidos", "Canadá", "Mundial"],
  method:
    "Las cifras nominales son dólares de Estados Unidos del año de cada estreno, tomadas de la tabla de recaudación del artículo de Wikipedia en inglés enlazado como fuente. Wikipedia cita a Box Office Mojo para la recaudación de cada película, y cada fila enlaza esa página y, cuando Wikipedia la cita, su copia archivada. Box Office Mojo no se consulta directamente. Las cifras reales convierten cada monto a dólares del año base con el índice de precios al consumidor de Estados Unidos (serie CUUR0000SA0 del Bureau of Labor Statistics, promedios anuales). La película sin estrenar no tiene recaudación. El pronóstico se guarda con su fecha antes del estreno y se compara con las cifras reales después.",
};

const MONTHS: Record<string, string> = {
  january: "enero",
  february: "febrero",
  march: "marzo",
  april: "abril",
  may: "mayo",
  june: "junio",
  july: "julio",
  august: "agosto",
  september: "septiembre",
  october: "octubre",
  november: "noviembre",
  december: "diciembre",
};

function spanishNote(film: RawFilm): string | undefined {
  if (!film.note) return undefined;
  const m =
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+re-?release,\s*([^,.]+)\./i.exec(
      film.note,
    );
  if (!m) throw new Error(`${film.originalTitle}: cannot write a note for "${film.note}"`);
  return `Las cifras incluyen el reestreno de ${MONTHS[m[1]!.toLowerCase()]} de ${m[2]}, ${m[3]!.trim()}.`;
}

interface FilmRow extends RawFilm {
  title: string;
  originalTitle: string;
  phase: number;
  release: string;
  article?: PageRevision;
}

function headingSection(wikitext: string, name: string): string {
  const re = new RegExp(`^==\\s*${name}\\s*==`, "im");
  const m = re.exec(wikitext);
  if (!m) return "";
  const rest = wikitext.slice(m.index + m[0].length);
  const end = /^==[^=]/m.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

async function fetchCpi(file: string) {
  const values: Record<string, number> = {};
  for (const [start, end] of [
    [2008, 2017],
    [2018, 2027],
  ]) {
    const response = await fetch(BLS, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "opendata-rising-sh-importer/1.0",
      },
      body: JSON.stringify({
        seriesid: [CPI_SERIES],
        startyear: String(start),
        endyear: String(end),
        annualaverage: true,
      }),
    });
    if (!response.ok) throw new Error(`BLS ${response.status}`);
    const body = await response.json();
    if (body.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS: ${body.message?.join("; ")}`);
    for (const item of body.Results.series[0].data) {
      if (item.period === "M13") values[item.year] = Number(item.value);
    }
  }
  const years = Object.keys(values).map(Number);
  if (!years.length) throw new Error("BLS returned no annual averages");
  const data = {
    series: CPI_SERIES,
    name: "Índice de precios al consumidor de Estados Unidos, todos los artículos, promedio anual",
    source: {
      outlet: "U.S. Bureau of Labor Statistics",
      url: "https://www.bls.gov/cpi/data.htm",
    },
    base: Math.max(...years.filter((y) => y < new Date().getUTCFullYear())),
    values,
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`cpi: ${years.length} years, base ${data.base}`);
}

export function toFilm(
  film: FilmRow,
  title: string,
  phaseSource: { outlet: string; url: string },
  articleSource: { outlet: string; url: string },
) {
  const base = {
    title,
    originalTitle: film.originalTitle.replace(/ \([^)]*\bfilm\)$/, ""),
    phase: film.phase,
    release: film.release,
    note: spanishNote(film),
  };
  if (film.usCanada === undefined || film.worldwide === undefined) {
    return { ...base, status: "unreleased" };
  }
  const opening = film.article ? openingWeekend(film.article.wikitext) : undefined;
  if (opening === undefined) {
    throw new Error(`no opening weekend found for ${film.originalTitle}`);
  }
  return {
    ...base,
    status: "released",
    budget: film.budget ? { ...film.budget, source: phaseSource } : undefined,
    opening: { amount: opening, source: articleSource },
    usCanada: { amount: film.usCanada, source: phaseSource },
    worldwide: { amount: film.worldwide, source: phaseSource },
    boxOfficeMojo: film.boxOfficeMojo,
  };
}

async function main() {
  const root = resolve(import.meta.dirname, "..");
  const { values } = parseArgs({
    options: { file: { type: "string", default: join(root, "data/events/mcu-taquilla.json") } },
  });

  const list = await fetchPage(LIST_PAGE, HOST);
  console.log(`${list.title}: revision ${list.revid} of ${list.timestamp}`);

  const phases = await Promise.all(PHASES.map((p) => fetchPage(p, HOST)));
  const rows: FilmRow[] = [];
  for (const [i, page] of phases.entries()) {
    const boxOffice = labeledSection(page.wikitext, "BoxOffice");
    if (!boxOffice) throw new Error(`${page.title} has no BoxOffice section`);
    for (const film of parseBoxOfficeRows(boxOffice)) {
      rows.push({ ...film, title: "", phase: i + 1, article: undefined });
    }
    for (const { originalTitle, release } of parseFilmList(
      headingSection(page.wikitext, "Films"),
    )) {
      if (!rows.some((r) => r.originalTitle === originalTitle)) {
        rows.push({ title: "", originalTitle, phase: i + 1, release });
      }
    }
  }
  rows.sort((a, b) => a.release.localeCompare(b.release));

  const es = await spanishTitles(
    rows.map((r) => r.originalTitle),
    HOST,
  );
  const clean = (name: string) => name.replace(/ \([^)]*\)$/, "");

  const released = rows.filter((r) => r.usCanada !== undefined);
  console.log(`${released.length} released films; fetching opening weekends`);
  for (const film of released) {
    film.article = await fetchPage(film.originalTitle, HOST);
  }

  const source = (page: PageRevision) => ({
    outlet: OUTLET,
    url: permalink(page.title, page.revid, HOST),
  });
  const phasePage = (phase: number) => phases[phase - 1]!;

  const films = rows.map((film) =>
    toFilm(
      film,
      clean(es.get(film.originalTitle) ?? film.originalTitle),
      source(phasePage(film.phase)),
      film.article ? source(film.article) : source(phasePage(film.phase)),
    ),
  );

  const uncited = released.filter((r) => r.boxOfficeMojo === undefined);
  for (const film of uncited) {
    console.warn(`no Box Office Mojo citation for ${film.originalTitle}; the source is Wikipedia`);
  }
  console.log(
    `${released.length - uncited.length} of ${released.length} films cite Box Office Mojo`,
  );

  const existing = existsSync(values.file)
    ? (JSON.parse(readFileSync(values.file, "utf8")) as Record<string, unknown>)
    : {};
  const { date, time } = limaParts(list.timestamp);
  const event = {
    ...DEFAULT_FRAME,
    ...existing,
    kind: "taquilla",
    start: films[0]!.release,
    end: films.at(-1)!.release,
    updated: `${date}T${time}-05:00`,
    source: {
      outlet: OUTLET,
      url: permalink(list.title, list.revid, HOST),
      revision: list.revid,
      revisionDate: date,
      license: LICENSE,
    },
    films,
  };
  writeFileSync(values.file, `${JSON.stringify(event, null, 2)}\n`);
  console.log(`wrote ${films.length} films to ${values.file} (revision ${list.revid})`);

  await fetchCpi(join(root, "data", "cpi", "cuur0000sa0.json"));
}

if (import.meta.main) await main();

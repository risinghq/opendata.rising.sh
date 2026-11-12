import { expandSpans, link, parseTables, plain, type Cell } from "./wikitext.ts";

export interface RawStadium {
  title: string | undefined;
  label: string;
}

export interface RawMatch {
  round: number;
  start: string;
  home: string;
  away: string;
  stadium: RawStadium;
  referee: string | undefined;
  score: { home: number; away: number } | undefined;
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const LIMA_OFFSET = "-05:00";

function parseDate(text: string, year: number, where: string): string {
  const match = /^(\d{1,2})\s+de\s+([a-záéíóú]+)$/i.exec(text);
  const month = match ? MONTHS.indexOf(match[2]!.toLowerCase()) : -1;
  if (!match || month < 0) throw new Error(`${where}: cannot read the date "${text}"`);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(Number(match[1]))}`;
}

function parseTime(text: string, where: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) throw new Error(`${where}: cannot read the time "${text}"`);
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function parseScore(text: string): { home: number; away: number } | undefined {
  const match = /^(\d+)\s*[–—-]\s*(\d+)$/.exec(text);
  return match ? { home: Number(match[1]), away: Number(match[2]) } : undefined;
}

const COLUMNS = {
  home: "local",
  score: "resultado",
  away: "visitante",
  stadium: "estadio",
  date: "fecha",
  time: "hora",
  referee: "árbitro",
} as const;

export function parseResults(wikitext: string, year: number): RawMatch[] {
  const heading = /^==\s*Resultados\s*==\s*$/m.exec(wikitext);
  if (!heading) throw new Error('the page has no "Resultados" section');
  const rest = wikitext.slice(heading.index + heading[0].length);
  const end = /^==[^=]/m.exec(rest);
  const section = end ? rest.slice(0, end.index) : rest;
  if (!/UTC[-−–]5/.test(section)) {
    throw new Error("the results section does not say that times are UTC-5");
  }

  const matches: RawMatch[] = [];
  for (const table of parseTables(section)) {
    const rows = expandSpans(table.rows.filter((r: Cell[]) => r.length > 0));
    const title = plain(rows[0]?.[0]?.text ?? "");
    const round = /^Fecha\s+(\d+)$/i.exec(title);
    if (!round) continue;
    const header = rows[1]?.map((cell) => plain(cell.text).toLowerCase()) ?? [];
    const index = Object.fromEntries(
      Object.entries(COLUMNS).map(([key, name]) => {
        const at = header.indexOf(name);
        if (at < 0) throw new Error(`Fecha ${round[1]}: the table has no "${name}" column`);
        return [key, at];
      }),
    ) as Record<keyof typeof COLUMNS, number>;

    rows.slice(2).forEach((cells, i) => {
      const where = `Fecha ${round[1]}, row ${i + 1}`;
      const text = (key: keyof typeof COLUMNS) => {
        const cell = cells[index[key]];
        if (!cell) throw new Error(`${where}: the "${COLUMNS[key]}" cell is missing`);
        return cell.text;
      };
      const home = plain(text("home"));
      const away = plain(text("away"));
      if (!home || !away) throw new Error(`${where}: a team name is empty`);

      const stadiumText = text("stadium");
      const stadiumLink = link(stadiumText);
      const stadium: RawStadium = stadiumLink
        ? { title: stadiumLink.title, label: stadiumLink.label }
        : { title: undefined, label: plain(stadiumText) };
      if (!stadium.label) throw new Error(`${where}: ${home} v ${away} has no stadium`);

      const referee = plain(text("referee"));
      const date = parseDate(plain(text("date")), year, `${where}: ${home} v ${away}`);
      const time = parseTime(plain(text("time")), `${where}: ${home} v ${away}`);
      matches.push({
        round: Number(round[1]),
        start: `${date}T${time}${LIMA_OFFSET}`,
        home,
        away,
        stadium,
        referee: referee && !/^[–—-]$/.test(referee) ? referee : undefined,
        score: parseScore(plain(text("score"))),
      });
    });
  }
  return matches;
}

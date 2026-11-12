import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { parseResults, type RawMatch } from "./liga1-wikitext.ts";
import {
  canonicalTitles,
  fetchPage,
  limaParts,
  permalink,
  type PageRevision,
} from "./mediawiki.ts";

const HOST = "es.wikipedia.org";
const LICENSE = "CC BY-SA 4.0";
const OUTLET = "Wikipedia en español";

export const TOURNAMENTS = [
  { id: "apertura", name: "Torneo Apertura", page: "Torneo Apertura 2026 (Perú)", year: 2026 },
  { id: "clausura", name: "Torneo Clausura", page: "Torneo Clausura 2026 (Perú)", year: 2026 },
] as const;

export interface Frame {
  title: string;
  summary: string;
  places: string[];
  method: string;
  stadiums: { id: string; [key: string]: unknown }[];
  matches?: {
    tournament: string;
    round: number;
    home: string;
    away: string;
    events?: unknown;
  }[];
}

export const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const withoutQualifier = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, "");

export function unifyTeams(names: string[]): Map<string, string> {
  const distinct = [...new Set(names)];
  const longer = (a: string, b: string) => b.startsWith(`${a} `);
  const out = new Map<string, string>();
  for (const name of distinct) {
    const extensions = distinct.filter((other) => longer(name, other));
    if (extensions.length > 1) {
      throw new Error(`"${name}" could be ${extensions.map((e) => `"${e}"`).join(" or ")}`);
    }
    out.set(name, extensions[0] ?? name);
  }
  return out;
}

export function stadiumTitles(
  matches: RawMatch[],
  canonical: (title: string) => string,
): Map<RawMatch, string> {
  const byLabel = new Map<string, string>();
  for (const match of matches) {
    if (match.stadium.title) byLabel.set(match.stadium.label, canonical(match.stadium.title));
  }
  const out = new Map<RawMatch, string>();
  for (const match of matches) {
    const title = match.stadium.title
      ? canonical(match.stadium.title)
      : byLabel.get(match.stadium.label);
    if (!title) {
      throw new Error(
        `round ${match.round}, ${match.home} v ${match.away}: stadium "${match.stadium.label}" has no article link`,
      );
    }
    out.set(match, title);
  }
  return out;
}

export function assemble(
  frame: Frame,
  pages: PageRevision[],
  canonical: (title: string) => string,
) {
  const parsed = pages.map((page, i) => {
    const tournament = TOURNAMENTS[i]!;
    return { tournament, page, matches: parseResults(page.wikitext, tournament.year) };
  });

  const all = parsed.flatMap((p) => p.matches);
  const teamOf = unifyTeams(all.flatMap((m) => [m.home, m.away]));
  const stadiumOf = stadiumTitles(all, canonical);
  const stadiumId = (match: RawMatch) => slug(withoutQualifier(stadiumOf.get(match)!));

  const known = new Set(frame.stadiums.map((s) => s.id));
  const missing = [...new Set(all.map(stadiumId))].filter((id) => !known.has(id));
  if (missing.length > 0) {
    const stubs = missing.map((id) => {
      const match = all.find((m) => stadiumId(m) === id)!;
      return `${id} (${withoutQualifier(stadiumOf.get(match)!)})`;
    });
    throw new Error(
      `add these stadiums to the "stadiums" list with city, altitude and source:\n${stubs.join("\n")}`,
    );
  }

  const teamNames = [...new Set(teamOf.values())].sort((a, b) => a.localeCompare(b, "es"));
  const previous = new Map(
    (frame.matches ?? [])
      .filter((m) => m.events !== undefined)
      .map((m) => [`${m.tournament}/${m.round}/${m.home}/${m.away}`, m.events]),
  );
  const matches = parsed.flatMap(({ tournament, matches: list }) =>
    list.map((m) => {
      const home = slug(teamOf.get(m.home)!);
      const away = slug(teamOf.get(m.away)!);
      const events = previous.get(`${tournament.id}/${m.round}/${home}/${away}`);
      return {
        tournament: tournament.id,
        round: m.round,
        start: m.start,
        home,
        away,
        stadium: stadiumId(m),
        ...(m.referee ? { referee: m.referee } : {}),
        ...(m.score
          ? { status: "held", homeScore: m.score.home, awayScore: m.score.away }
          : { status: "planned" }),
        ...(m.score && events ? { events } : {}),
      };
    }),
  );
  matches.sort(
    (a, b) =>
      TOURNAMENTS.findIndex((t) => t.id === a.tournament) -
        TOURNAMENTS.findIndex((t) => t.id === b.tournament) ||
      a.round - b.round ||
      a.start.localeCompare(b.start) ||
      a.home.localeCompare(b.home),
  );

  const days = matches.map((m) => m.start.slice(0, 10)).sort();
  const latest = pages
    .map((p) => p.timestamp)
    .sort()
    .at(-1)!;
  const stamp = limaParts(latest);

  return {
    kind: "temporada",
    title: frame.title,
    summary: frame.summary,
    start: days[0]!,
    end: days.at(-1)!,
    places: frame.places,
    updated: `${stamp.date}T${stamp.time}-05:00`,
    method: frame.method,
    tournaments: parsed.map(({ tournament, page }) => ({
      id: tournament.id,
      name: tournament.name,
      source: {
        outlet: OUTLET,
        url: permalink(page.title, page.revid, HOST),
        revision: page.revid,
        revisionDate: limaParts(page.timestamp).date,
        license: LICENSE,
      },
    })),
    teams: teamNames.map((name) => ({ id: slug(name), name })),
    stadiums: frame.stadiums,
    matches,
  };
}

async function main() {
  const root = resolve(import.meta.dirname, "..");
  const { values } = parseArgs({
    options: { file: { type: "string", default: join(root, "data/events/liga-1-2026.json") } },
  });
  if (!existsSync(values.file)) throw new Error(`${values.file} must exist with its frame`);
  const frame = JSON.parse(readFileSync(values.file, "utf8")) as Frame;

  const pages: PageRevision[] = [];
  for (const tournament of TOURNAMENTS) pages.push(await fetchPage(tournament.page, HOST));

  const links = pages.flatMap((page, i) =>
    parseResults(page.wikitext, TOURNAMENTS[i]!.year).flatMap((m) =>
      m.stadium.title ? [m.stadium.title] : [],
    ),
  );
  const event = assemble(frame, pages, await canonicalTitles(links, HOST));

  writeFileSync(values.file, `${JSON.stringify(event, null, 2)}\n`);
  for (const t of event.tournaments) {
    const count = event.matches.filter((m) => m.tournament === t.id).length;
    console.log(`${t.name}: revision ${t.source.revision}, ${count} matches`);
  }
}

if (import.meta.main) await main();

import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import type { TemporadaData } from "../../src/data/types.ts";
import { Api, cacheRead, cacheWrite } from "./api.ts";
import { limaDate, type ApiFixture } from "./parse.ts";

const EVENT_FILE = joinPath(import.meta.dirname, "..", "..", "data", "events", "liga-1-2026.json");

interface League {
  id: number;
  name: string;
}

interface Paged {
  pagination: { has_more: boolean };
}

export async function run(): Promise<void> {
  const api = new Api();
  const event = JSON.parse(readFileSync(EVENT_FILE, "utf8")) as TemporadaData;

  const leagues = (await api.get("/leagues?country=PE")) as League[] | { leagues?: League[] };
  const list = Array.isArray(leagues) ? leagues : (leagues.leagues ?? []);
  const league = list.find((l) => /liga\s*1/i.test(l.name));
  if (!league)
    throw new Error(`no Liga 1 in /leagues?country=PE: ${list.map((l) => l.name).join(", ")}`);
  console.log(`league: ${league.name} (${league.id})`);

  const fixtures: ApiFixture[] = [];
  for (let page = 1; ; page++) {
    const data = (await api.get(
      `/leagues/${league.id}/fixtures?season=2026&include=events,stats&per_page=50&page=${page}`,
    )) as ApiFixture[] | (Paged & { fixtures?: ApiFixture[] });
    const rows = Array.isArray(data) ? data : (data.fixtures ?? []);
    fixtures.push(...rows);
    const hasMore = Array.isArray(data) ? rows.length === 50 : (data as Paged).pagination.has_more;
    if (!hasMore || rows.length === 0) break;
    league.id = api.canonicalId(league.id);
  }
  cacheWrite("fixtures.json", fixtures);
  console.log(`fixtures: ${fixtures.length}`);

  const clausuraStart = event.matches
    .filter((m) => m.tournament === "clausura")
    .map((m) => m.start.slice(0, 10))
    .sort()[0]!;
  const odds = await fetchOdds(
    (path) => api.get(path),
    fixtures,
    clausuraStart,
    cacheRead<Record<string, [number, number, number]>>("odds.json") ?? {},
  );
  cacheWrite("odds.json", odds);
  console.log(`odds: ${Object.keys(odds).length} fixtures, ${api.requests} API requests total`);
}

export async function fetchOdds(
  get: (path: string) => Promise<unknown>,
  fixtures: ApiFixture[],
  clausuraStart: string,
  cached: Record<string, [number, number, number]>,
): Promise<Record<string, [number, number, number]>> {
  const odds = { ...cached };
  for (const f of fixtures) {
    if (f.status !== "finished" || limaDate(f.kickoff_utc) < clausuraStart || odds[f.id]) continue;
    const data = (await get(`/fixtures/${f.id}/odds`)) as {
      bookmakers?: {
        slug: string;
        odds?: { "1x2"?: { closing?: { home: number; draw: number; away: number } | null } };
      }[];
    };
    const closing = data.bookmakers?.find((b) => b.slug === "bet365")?.odds?.["1x2"]?.closing;
    if (!closing) continue;
    const sum = 1 / closing.home + 1 / closing.draw + 1 / closing.away;
    odds[f.id] = [1 / closing.home / sum, 1 / closing.draw / sum, 1 / closing.away / sum];
  }
  return odds;
}

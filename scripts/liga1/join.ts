import { readFileSync, writeFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import type { HeldMatch, TemporadaData } from "../../src/data/types.ts";
import { teamId } from "./aliases.ts";
import { cacheRead, cacheWrite } from "./api.ts";
import { limaDate, parseEvents, type ApiFixture } from "./parse.ts";

const EVENT_FILE = joinPath(import.meta.dirname, "..", "..", "data", "events", "liga-1-2026.json");

export interface JoinResult {
  joined: number;
  unjoined: string[];
  mismatches: string[];
  moved: string[];
  noEvents: string[];
  link: Record<string, number>;
}

export function joinFixtures(event: TemporadaData, fixtures: ApiFixture[]): JoinResult {
  const byKey = new Map<string, ApiFixture>();
  const byPairing = new Map<string, ApiFixture[]>();
  for (const f of fixtures) {
    const home = teamId(f.teams.home.name);
    const away = teamId(f.teams.away.name);
    if (!home || !away) continue;
    byKey.set(`${limaDate(f.kickoff_utc)}|${home}|${away}`, f);
    const pair = `${home}|${away}`;
    byPairing.set(pair, [...(byPairing.get(pair) ?? []), f]);
  }

  const unjoined: string[] = [];
  const mismatches: string[] = [];
  const moved: string[] = [];
  const noEvents: string[] = [];
  let joined = 0;
  const link: Record<string, number> = {};

  for (const match of event.matches) {
    const key = `${match.start.slice(0, 10)}|${match.home}|${match.away}`;
    let fixture = byKey.get(key);
    if (!fixture) {
      const candidates = (byPairing.get(`${match.home}|${match.away}`) ?? []).filter(
        (f) => Math.abs(Date.parse(f.kickoff_utc) - Date.parse(match.start)) < 21 * 86_400_000,
      );
      if (match.status === "planned" && candidates.length === 1) {
        fixture = candidates[0];
        moved.push(`${key} is ${limaDate(fixture!.kickoff_utc)} in the API`);
      }
    }
    if (!fixture) {
      unjoined.push(`${key} (${match.tournament} fecha ${match.round})`);
      continue;
    }
    link[key] = fixture.id;
    if (match.status === "held") {
      const events = fixture.status === "finished" ? parseEvents(fixture) : null;
      if (!events) noEvents.push(`${key} (${match.tournament} fecha ${match.round})`);
      else {
        const keep = { home: 0, away: 0 };
        const goals = events.goals.filter((g) => {
          if (keep[g.team] >= match[`${g.team}Score`]) return false;
          keep[g.team]++;
          return true;
        });
        if (goals.length < events.goals.length) {
          mismatches.push(
            `${key}: API lists ${events.goals.length} goal events for a ${match.homeScore}-${match.awayScore} match; kept ${goals.length}`,
          );
          events.goals = goals;
        }
        (match as HeldMatch).events = events;
      }
      if (
        fixture.status === "finished" &&
        fixture.goals &&
        (fixture.goals.home !== match.homeScore || fixture.goals.away !== match.awayScore)
      ) {
        mismatches.push(
          `${key}: Wikipedia ${match.homeScore}-${match.awayScore}, API ${fixture.goals.home}-${fixture.goals.away}`,
        );
      }
      joined++;
    }
  }
  return { joined, unjoined, mismatches, moved, noEvents, link };
}

export function run(): JoinResult {
  const event = JSON.parse(readFileSync(EVENT_FILE, "utf8")) as TemporadaData;
  const fixtures = cacheRead<ApiFixture[]>("fixtures.json");
  const result = joinFixtures(event, fixtures);
  writeFileSync(EVENT_FILE, `${JSON.stringify(event, null, 2)}\n`);
  if (result.unjoined.length > 0) {
    throw new Error(`matches without an API fixture:\n${result.unjoined.join("\n")}`);
  }
  if (result.noEvents.length > 0) {
    throw new Error(`held matches without API events:\n${result.noEvents.join("\n")}`);
  }
  cacheWrite("join.json", result.link);
  for (const line of result.mismatches) console.warn(`score mismatch: ${line}`);
  for (const line of result.moved) console.warn(`date moved: ${line}`);
  console.log(`joined events onto ${result.joined} held matches`);
  return result;
}

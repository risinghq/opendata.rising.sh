import { expect, test } from "bun:test";

import { fetchOdds } from "../../scripts/liga1/fetch.ts";
import type { ApiFixture } from "../../scripts/liga1/parse.ts";

const finished = (id: number, kickoff = "2026-08-16T20:00:00+00:00"): ApiFixture =>
  ({ id, kickoff_utc: kickoff, status: "finished", teams: {} }) as unknown as ApiFixture;

const oddsBody = {
  bookmakers: [{ slug: "bet365", odds: { "1x2": { closing: { home: 2, draw: 3, away: 4 } } } }],
};

test("fetchOdds only requests finished Clausura fixtures missing from the cache", async () => {
  const calls: string[] = [];
  const get = async (path: string) => {
    calls.push(path);
    return oddsBody;
  };
  const fixtures = [finished(1), finished(2), finished(3, "2026-05-01T20:00:00+00:00")];
  const odds = await fetchOdds(get, fixtures, "2026-07-01", { 2: [0.5, 0.3, 0.2] });
  expect(calls).toEqual(["/fixtures/1/odds"]);
  expect(Object.keys(odds).sort()).toEqual(["1", "2"]);
});

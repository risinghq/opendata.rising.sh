import { expect, test } from "bun:test";

import { expected, fit, probabilities } from "../../src/forecast/model.ts";
import { mulberry32, samplePoisson } from "../../src/forecast/poisson.ts";
import { order, resolveSeason, table } from "../../src/forecast/rules.ts";
import { writeSnapshot } from "../../src/forecast/snapshot.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("fit recovers known attack and defence strengths in a synthetic league", () => {
  const teams = ["a", "b", "c", "d"];
  const trueAtt: Record<string, number> = { a: 0.4, b: 0.1, c: -0.2, d: -0.3 };
  const trueDef: Record<string, number> = { a: -0.3, b: -0.1, c: 0.15, d: 0.25 };
  const rng = mulberry32(7);
  const matches = [];
  for (let season = 0; season < 40; season++) {
    for (const home of teams) {
      for (const away of teams) {
        if (home === away) continue;
        const lh = Math.exp(0.1 + trueAtt[home] - trueDef[away] + 0.3);
        const la = Math.exp(0.1 + trueAtt[away] - trueDef[home]);
        matches.push({
          home,
          away,
          homeGoals: samplePoisson(lh, rng),
          awayGoals: samplePoisson(la, rng),
          altDiff: 0,
          daysAgo: season,
        });
      }
    }
  }
  const params = fit(matches, teams, { decay: 0.001, ridge: 0.1, dixonColes: false });
  for (const t of teams) {
    expect(params.attack[t]!).toBeCloseTo(trueAtt[t]!, 0);
  }
  const p = probabilities(params, "a", "d", 0);
  expect(p.home).toBeGreaterThan(0.4);
  expect(p.home + p.draw + p.away).toBeCloseTo(1, 5);
  const e = expected(params, "a", "d", 0);
  expect(e.home).toBeGreaterThan(e.away);
});

test("table orders by points, goal difference and goals for", () => {
  const rows = table(
    ["a", "b", "c"],
    [
      { home: "a", away: "b", homeScore: 3, awayScore: 0 },
      { home: "c", away: "a", homeScore: 1, awayScore: 0 },
      { home: "b", away: "c", homeScore: 2, awayScore: 0 },
      { home: "c", away: "b", homeScore: 2, awayScore: 0 },
      { home: "a", away: "c", homeScore: 0, awayScore: 0 },
      { home: "b", away: "a", homeScore: 1, awayScore: 1 },
    ],
  );
  const sorted = order(rows, null, () => 0.99);
  expect(sorted[0]).toBe("c");
  expect(sorted[1]).toBe("a");
  expect(rows.find((r) => r.team === "c")!.points).toBe(7);
});

test("resolveSeason crowns the apertura winner when it also wins the clausura", () => {
  const teams = ["a", "b", "c", "d"];
  const wins = (w: string) =>
    teams.filter((t) => t !== w).map((l) => ({ home: w, away: l, homeScore: 2, awayScore: 0 }));
  const apertura = wins("a");
  const clausura = wins("a");
  const out = resolveSeason(
    teams,
    apertura,
    clausura,
    () => 0.5,
    () => "x",
  );
  expect(out.champion).toBe("a");
  expect(out.clausuraWinner).toBe("a");
});

test("resolveSeason runs a final when both winners are top two of the aggregate", () => {
  const teams = ["a", "b", "c", "d"];
  const apertura = [
    { home: "a", away: "b", homeScore: 3, awayScore: 0 },
    { home: "a", away: "c", homeScore: 3, awayScore: 0 },
    { home: "a", away: "d", homeScore: 3, awayScore: 0 },
    { home: "b", away: "c", homeScore: 3, awayScore: 0 },
    { home: "b", away: "d", homeScore: 3, awayScore: 0 },
    { home: "c", away: "d", homeScore: 3, awayScore: 0 },
  ];
  const clausura = [
    { home: "b", away: "a", homeScore: 3, awayScore: 0 },
    { home: "b", away: "c", homeScore: 3, awayScore: 0 },
    { home: "b", away: "d", homeScore: 3, awayScore: 0 },
    { home: "a", away: "c", homeScore: 3, awayScore: 0 },
    { home: "a", away: "d", homeScore: 3, awayScore: 0 },
    { home: "c", away: "d", homeScore: 3, awayScore: 0 },
  ];
  const out = resolveSeason(
    teams,
    apertura,
    clausura,
    () => 0.5,
    (h) => h,
  );
  expect(out.champion).toBe("a");
});

test("writeSnapshot refuses to rewrite a dated snapshot", () => {
  const root = mkdtempSync(join(tmpdir(), "snap-"));
  const snap = {
    season: "liga-1-2026",
    date: "2026-11-12",
    matchesUsed: [],
    parameters: {
      decay: 0,
      ridge: 0,
      dixonColes: false,
      home: 0,
      altitude: 0,
      rho: 0,
      intercept: 0,
    },
    simulations: 1,
    seed: 1,
    matches: [],
    teams: [],
    backtest: {
      rounds: 0,
      model: { logLoss: 0, brier: 0, matches: 0 },
      baseRates: { logLoss: 0, brier: 0, matches: 0 },
      odds: null,
    },
  };
  writeSnapshot(snap, root);
  expect(() => writeSnapshot(snap, root)).toThrow(/never rewritten/);
});

test("order breaks level points on fair play then head-to-head", () => {
  const mk = (team: string, fp: number, known = true) => ({
    team,
    points: 9,
    gd: 4,
    gf: 8,
    fairPlay: fp,
    fairPlayKnown: known,
  });
  const rng = mulberry32(1);
  expect(order([mk("a", 10), mk("b", 4), mk("c", 7)], null, rng)).toEqual(["b", "c", "a"]);
  const h2h = [
    { home: "a", away: "b", homeScore: 2, awayScore: 0 },
    { home: "b", away: "a", homeScore: 0, awayScore: 1 },
    { home: "c", away: "a", homeScore: 1, awayScore: 0 },
    { home: "b", away: "c", homeScore: 0, awayScore: 0 },
  ];
  const rows = [mk("a", 0, false), mk("b", 0, false), mk("c", 0, false)];
  expect(order(rows, h2h, mulberry32(1))).toEqual(["a", "c", "b"]);
  const again = order(rows, h2h, mulberry32(1));
  expect(again).toEqual(order(rows, h2h, mulberry32(1)));
});

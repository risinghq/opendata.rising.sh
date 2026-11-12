import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TemporadaData, TemporadaRecord } from "../../src/data/types.ts";
import { scoreSnapshots, type PublishedScore } from "../../src/forecast/scoring.ts";
import type { ForecastSnapshot } from "../../src/forecast/snapshot.ts";

const match = (
  round: number,
  start: string,
  home: string,
  away: string,
  homeScore?: number,
  awayScore?: number,
) => ({
  tournament: "clausura",
  round,
  start,
  home,
  away,
  stadium: "e",
  status: homeScore === undefined ? "planned" : "held",
  ...(homeScore === undefined ? {} : { homeScore, awayScore }),
});

const event = {
  matches: [
    match(1, "2026-11-01T15:00-05:00", "a", "b", 2, 1),
    match(2, "2026-11-05T15:00-05:00", "c", "d", 1, 1),
    match(3, "2026-11-20T15:00-05:00", "e", "f", 1, 0),
    match(4, "2026-11-15T15:00-05:00", "g", "h", 0, 2),
    match(5, "2026-11-25T15:00-05:00", "i", "j"),
  ],
} as unknown as TemporadaData;

const forecast = (
  tournament: string,
  round: number,
  start: string,
  home: string,
  away: string,
  p: [number, number, number],
) => ({
  tournament,
  round,
  start,
  home,
  away,
  pHome: p[0],
  pDraw: p[1],
  pAway: p[2],
  xHome: 1,
  xAway: 1,
});

const snapshot = (
  date: string,
  used: string[],
  matches: ForecastSnapshot["matches"],
): ForecastSnapshot => ({
  season: "liga-1-2026",
  date,
  matchesUsed: used.map((score, i) => ({
    start: `2026-10-0${i + 1}T15:00-05:00`,
    home: "x",
    away: "y",
    score,
  })),
  parameters: {
    decay: 0,
    ridge: 0,
    dixonColes: false,
    home: 0,
    altitude: 0,
    rho: 0,
    intercept: 0,
  },
  simulations: 0,
  seed: 0,
  matches,
  teams: [],
  backtest: {
    rounds: 0,
    model: { logLoss: 0, brier: 0, matches: 0 },
    baseRates: { logLoss: 0, brier: 0, matches: 0 },
    odds: null,
  },
});

const a = snapshot(
  "2026-11-03",
  ["2-1", "1-0", "0-0", "1-2"],
  [
    forecast("clausura", 2, "2026-11-05T15:00-05:00", "c", "d", [0.5, 0.3, 0.2]),
    forecast("clausura", 3, "2026-11-08T15:00-05:00", "e", "f", [0.6, 0.2, 0.2]),
    forecast("clausura", 4, "2026-11-15T15:00-05:00", "g", "h", [0.1, 0.2, 0.7]),
    forecast("clausura", 5, "2026-11-25T15:00-05:00", "i", "j", [0.4, 0.3, 0.3]),
  ],
);

const b = snapshot(
  "2026-11-10",
  ["1-1", "2-0"],
  [
    forecast("clausura", 3, "2026-11-19T15:00-05:00", "e", "f", [0.4, 0.4, 0.2]),
    forecast("clausura", 4, "2026-11-15T15:00-05:00", "g", "h", [0.2, 0.3, 0.5]),
    forecast("clausura", 5, "2026-11-25T15:00-05:00", "i", "j", [0.4, 0.3, 0.3]),
  ],
);

test("each snapshot is scored on the matches it forecast that were held afterwards", () => {
  const [sa, sb] = scoreSnapshots(event, [a, b]);

  expect(sa!.matches).toBe(3);
  expect(sa!.model!.logLoss).toBeCloseTo(-(Math.log(0.3) + Math.log(0.6) + Math.log(0.7)) / 3);
  expect(sa!.model!.brier).toBeCloseTo((0.78 + 0.24 + 0.14) / 3);

  expect(sb!.matches).toBe(2);
  expect(sb!.model!.logLoss).toBeCloseTo(-(Math.log(0.4) + Math.log(0.5)) / 2);
  expect(sb!.model!.brier).toBeCloseTo((0.56 + 0.38) / 2);
});

test("the base rates come from the snapshot's own matches used", () => {
  const [sa, sb] = scoreSnapshots(event, [a, b]);

  expect(sa!.baseRates!.logLoss).toBeCloseTo(
    -(Math.log(0.25) + Math.log(0.5) + Math.log(0.25)) / 3,
  );
  expect(sa!.baseRates!.brier).toBeCloseTo(
    ((0.5 - 0) ** 2 +
      (0.25 - 1) ** 2 +
      0.25 ** 2 +
      (0.5 - 1) ** 2 +
      0.25 ** 2 +
      0.25 ** 2 +
      0.5 ** 2 +
      0.25 ** 2 +
      (0.25 - 1) ** 2) /
      3,
  );
  expect(sb!.baseRates!.logLoss).toBeCloseTo(-(Math.log(0.5) + Math.log(1e-9)) / 2);
});

test("a snapshot score carries only the date, the count and the two scores", () => {
  for (const s of scoreSnapshots(event, [a, b])) {
    expect(Object.keys(s).sort()).toEqual(["baseRates", "date", "matches", "model"]);
  }
});

const record = {
  kind: "temporada",
  title: "Liga de prueba",
  summary: "Liga de prueba.",
  start: "2026-10-01",
  end: "2026-12-31",
  places: ["Perú"],
  updated: "2026-11-10T12:00-05:00",
  method: "Método de prueba.",
  tournaments: [
    {
      id: "clausura",
      name: "Clausura",
      source: {
        outlet: "Wikipedia",
        url: "https://es.wikipedia.org/wiki/Liga?oldid=1",
        revision: 1,
        revisionDate: "2026-11-01",
        license: "CC BY-SA 4.0",
      },
    },
  ],
  teams: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) => ({
    id,
    name: id.toUpperCase(),
  })),
  stadiums: [
    {
      id: "e",
      name: "Estadio de prueba",
      city: "Lima",
      altitude: 0,
      source: { outlet: "Wikipedia", url: "https://es.wikipedia.org/wiki/Estadio" },
    },
  ],
  matches: event.matches,
  slug: "liga-de-prueba",
} as unknown as TemporadaRecord;

const renderPage = (scores: PublishedScore[]) => {
  const payload = join(mkdtempSync(join(tmpdir(), "scoring-render-")), "payload.json");
  writeFileSync(payload, JSON.stringify({ event: record, scores }));
  const proc = Bun.spawnSync(["bun", "test/render-temporada.ts"], {
    stdin: Bun.file(payload),
    cwd: join(import.meta.dirname, "..", ".."),
  });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
  return proc.stdout.toString();
};

const section = (html: string) =>
  html.split('aria-labelledby="publicados"')[1]?.split("</section>")[0] ?? "";

test("the season page scores each snapshot in a table and has no closing-odds column", () => {
  const sec = section(renderPage(scoreSnapshots(event, [a, b])));
  expect(sec).toContain("<table");
  expect(sec).not.toContain("Cuotas de Bet365");
});

test("a snapshot with no held match yet gets a paragraph, not a table", () => {
  const sec = section(
    renderPage([{ date: "2026-11-12", matches: 0, model: null, baseRates: null }]),
  );
  expect(sec).not.toContain("<table");
  expect(sec).toMatch(/<p[^>]*>[^<]*Todavía no se jugó ningún partido de este pronóstico\./);
});

import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { teamAverages } from "../src/data/stats-temporada.ts";
import type { MatchStats, TemporadaRecord } from "../src/data/types.ts";
import { temporadaCsv } from "../src/downloads-temporada.ts";

type Side = [number, number, number, number, number];

const stats = (home: Side, away: Side): MatchStats => {
  const side = ([possession, shotsOnTarget, shotsOffTarget, attacks, dangerousAttacks]: Side) => ({
    possession,
    shotsOnTarget,
    shotsOffTarget,
    attacks,
    dangerousAttacks,
  });
  return { home: side(home), away: side(away) };
};

const events = (matchStats?: MatchStats | null) => ({
  halfTime: { home: 0, away: 0 },
  goals: [],
  cards: [],
  corners: { home: 0, away: 0 },
  ...(matchStats === undefined ? {} : { stats: matchStats }),
});

const pairs = [
  ["a", "b"],
  ["b", "a"],
  ["a", "c"],
] as const;

function season(...matchEvents: ReturnType<typeof events>[]): TemporadaRecord {
  return {
    kind: "temporada",
    slug: "prueba",
    title: "Prueba",
    summary: "Prueba.",
    start: "2026-02-01",
    end: "2026-02-28",
    places: ["Perú"],
    updated: "2026-02-10T12:00-05:00",
    method: "Método.",
    tournaments: [
      {
        id: "t",
        name: "Torneo",
        source: {
          outlet: "Wikipedia",
          url: "https://es.wikipedia.org/wiki/T?oldid=1",
          revision: 1,
          revisionDate: "2026-02-10",
          license: "CC BY-SA 4.0",
        },
      },
    ],
    teams: ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase() })),
    stadiums: [
      {
        id: "e",
        name: "Estadio",
        city: "Lima",
        altitude: 150,
        source: { outlet: "x", url: "https://example.org" },
      },
    ],
    matches: matchEvents.map((ev, i) => ({
      tournament: "t",
      round: i + 1,
      start: "2026-02-01T15:00-05:00",
      home: pairs[i]![0],
      away: pairs[i]![1],
      stadium: "e",
      status: "held",
      homeScore: 0,
      awayScore: 0,
      events: ev,
    })),
  } as unknown as TemporadaRecord;
}

const withStats = season(
  events(stats([60, 6, 4, 100, 50], [40, 2, 8, 80, 20])),
  events(stats([55, 4, 5, 90, 40], [45, 8, 3, 70, 30])),
  events(null),
);

test("team averages split each match by side and skip matches without statistics", () => {
  const rows = teamAverages(withStats);
  expect(rows.map((r) => r.team)).toEqual(["a", "b"]);
  expect(rows[0]).toEqual({
    team: "a",
    matches: 2,
    possession: 52.5,
    shotsOnTarget: 7,
    shotsOnTargetAgainst: 3,
    dangerousAttacks: 40,
  });
  expect(rows[1]).toMatchObject({ matches: 2, possession: 47.5, shotsOnTarget: 3 });
});

test("a season where no match has statistics has no team averages", () => {
  expect(teamAverages(season(events(), events(null)))).toEqual([]);
});

test("the CSV carries the per-match statistics and leaves them empty without any", () => {
  const [header, first, , third] = temporadaCsv(withStats).split("\r\n");
  const columns = header!.split(",");
  const cell = (row: string, name: string) => row.split(",")[columns.indexOf(name)];
  expect(cell(first!, "posesion_local")).toBe("60");
  expect(cell(first!, "posesion_visitante")).toBe("40");
  expect(cell(first!, "tiros_arco_local")).toBe("6");
  expect(cell(first!, "tiros_fuera_visitante")).toBe("8");
  expect(cell(first!, "ataques_local")).toBe("100");
  expect(cell(first!, "ataques_peligrosos_visitante")).toBe("20");
  expect(cell(third!, "posesion_local")).toBe("");
  expect(cell(third!, "ataques_peligrosos_visitante")).toBe("");
});

function render(event: TemporadaRecord): string {
  const payload = join(mkdtempSync(join(tmpdir(), "team-stats-")), "payload.json");
  writeFileSync(payload, JSON.stringify({ event, scores: [] }));
  const proc = Bun.spawnSync(["bun", "test/render-temporada.ts"], {
    stdin: Bun.file(payload),
    cwd: join(import.meta.dirname, ".."),
  });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
  return proc.stdout.toString();
}

test("the season page shows the team table only when a match has statistics", () => {
  const section =
    render(withStats).split('aria-labelledby="estadisticas"')[1]?.split("</section>")[0] ?? "";
  expect(section).toContain('<table class="team-stats-table">');
  expect(section).toContain("52.50");
  expect(render(season(events(null), events()))).not.toContain("estadisticas");
});

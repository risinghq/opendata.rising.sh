import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { slug, unifyTeams } from "../scripts/import-liga1.ts";
import { parseResults } from "../scripts/liga1-wikitext.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "fixtures", `resultados-${name}.wiki`), "utf8");

describe("parseResults", () => {
  test("a played round reads dates from rowspans, bold winners and linked scores", () => {
    const matches = parseResults(fixture("jugados"), 2026);
    expect(matches).toHaveLength(9);
    expect(matches.map((m) => m.start.slice(0, 10))).toEqual([
      "2026-01-30",
      "2026-01-30",
      "2026-01-31",
      "2026-01-31",
      "2026-01-31",
      "2026-02-01",
      "2026-02-01",
      "2026-02-01",
      "2026-02-02",
    ]);
    expect(matches[0]).toEqual({
      round: 1,
      start: "2026-01-30T12:00-05:00",
      home: "Sport Huancayo",
      away: "Alianza Lima",
      stadium: { title: "Estadio Huancayo", label: "Huancayo" },
      referee: "Joel Alarcón",
      score: { home: 1, away: 2 },
    });
    const melgar = matches.find((m) => m.home === "FBC Melgar")!;
    expect(melgar.score).toEqual({ home: 2, away: 0 });
    expect(matches.find((m) => m.home === "Sport Boys")!.score).toEqual({ home: 1, away: 1 });
  });

  test("a round not yet played has no scores, no referees and takes times from spans", () => {
    const matches = parseResults(fixture("por-jugar"), 2026);
    expect(matches).toHaveLength(9);
    expect(matches.every((m) => m.score === undefined && m.referee === undefined)).toBe(true);
    const sharedTime = matches.filter((m) => m.start === "2026-11-16T15:15-05:00");
    expect(sharedTime.map((m) => m.home)).toEqual(["Deportivo Moquegua", "Cusco FC"]);
  });

  test("a postponed match stays in the list without a score", () => {
    const matches = parseResults(fixture("pospuesto"), 2026);
    expect(matches).toHaveLength(2);
    expect(matches[0]!.score).toEqual({ home: 2, away: 1 });
    expect(matches[1]).toMatchObject({ home: "Cusco FC", away: "Los Chankas", score: undefined });
    expect(matches[1]!.start).toBe("2026-02-14T15:15-05:00");
  });

  test("a page without the UTC-5 note is refused", () => {
    const text = fixture("jugados").replace("UTC-5", "UTC-3");
    expect(() => parseResults(text, 2026)).toThrow("UTC-5");
  });
});

describe("team and id naming", () => {
  test("a short name that a longer one extends is the same team", () => {
    const names = ["Juan Pablo II", "Juan Pablo II College", "Cusco FC", "UTC"];
    const unified = unifyTeams(names);
    expect(unified.get("Juan Pablo II")).toBe("Juan Pablo II College");
    expect(unified.get("UTC")).toBe("UTC");
  });

  test("a name that two longer ones extend is refused", () => {
    expect(() => unifyTeams(["Sport", "Sport Boys", "Sport Huancayo"])).toThrow("could be");
  });

  test.each([
    ["Estadio Héroes de San Ramón", "estadio-heroes-de-san-ramon"],
    ["Estadio 25 de Noviembre", "estadio-25-de-noviembre"],
  ])("%s becomes %s", (name, id) => {
    expect(slug(name)).toBe(id);
  });
});

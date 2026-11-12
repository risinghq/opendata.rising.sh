import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { EVENTS_DIR } from "../src/data/load.ts";
import { validateEvent, validateSlug } from "../src/data/validate.ts";

const source = { outlet: "Medio", url: "https://example.org/nota" };

const heldAct = {
  status: "held",
  start: "2026-11-07T10:00-03:00",
  country: "Uruguay",
  city: "Paysandú",
  venue: "Parque",
  name: "Misa",
  low: 10,
  central: 20,
  high: 30,
  attribution: "El Vaticano informó de 20.",
  sources: [source],
};

const plannedAct = {
  status: "planned",
  start: "2026-11-08T10:00-03:00",
  country: "Uruguay",
  city: "Florida",
  venue: "Plaza",
  name: "Misa",
};

const event = {
  kind: "asistencia",
  title: "Evento",
  summary: "Resumen.",
  start: "2026-11-07",
  end: "2026-11-08",
  places: ["Uruguay"],
  updated: "2026-11-08T12:00-05:00",
  method: "Método.",
  acts: [heldAct, plannedAct],
};

function withAct(act: object) {
  return { ...event, acts: [act] };
}

describe("validateEvent", () => {
  test("accepts a held act, a planned act and a planned act with an expected figure", () => {
    const expected = { figure: 50, attribution: "Organizadores.", source };
    expect(validateEvent(event)).toEqual([]);
    expect(validateEvent(withAct({ ...plannedAct, expected }))).toEqual([]);
  });

  const failures: [string, unknown, string][] = [
    ["low above central", withAct({ ...heldAct, low: 25 }), "low <= central <= high"],
    ["central above high", withAct({ ...heldAct, central: 40 }), "low <= central <= high"],
    ["held act without sources", withAct({ ...heldAct, sources: [] }), "needs at least one source"],
    [
      "http source",
      withAct({ ...heldAct, sources: [{ outlet: "Medio", url: "http://example.org" }] }),
      "https URL",
    ],
    [
      "http expected source",
      withAct({
        ...plannedAct,
        expected: {
          figure: 5,
          attribution: "X.",
          source: { outlet: "M", url: "http://example.org" },
        },
      }),
      "https URL",
    ],
    [
      "http comparison source",
      {
        ...event,
        comparison: [
          {
            label: "Otro",
            figure: 5,
            attribution: "X.",
            source: { outlet: "M", url: "http://example.org" },
          },
        ],
      },
      "https URL",
    ],
    [
      "planned act with figures",
      withAct({ ...plannedAct, low: 1, central: 2, high: 3 }),
      "no figures",
    ],
    ["planned act with sources", withAct({ ...plannedAct, sources: [source] }), "no figures"],
    [
      "act outside the event dates",
      withAct({ ...heldAct, start: "2026-12-01T10:00-03:00" }),
      "outside",
    ],
    ["unknown status", withAct({ ...heldAct, status: "done" }), "planned"],
  ];

  test.each(failures)("rejects %s", (_name, data, message) => {
    const errors = validateEvent(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain(message);
  });
});

describe("validateEvent, temporada", () => {
  const wiki = {
    outlet: "Wikipedia en español",
    url: "https://es.wikipedia.org/wiki/Torneo?oldid=10",
    revision: 10,
    revisionDate: "2026-02-10",
    license: "CC BY-SA 4.0",
  };
  const held = {
    tournament: "apertura",
    round: 1,
    start: "2026-02-01T15:00-05:00",
    home: "x",
    away: "y",
    stadium: "est",
    status: "held",
    homeScore: 1,
    awayScore: 0,
  };
  const season = {
    kind: "temporada",
    title: "Liga",
    summary: "Resumen.",
    start: "2026-02-01",
    end: "2026-02-28",
    places: ["Perú"],
    updated: "2026-02-10T12:00-05:00",
    method: "Método.",
    tournaments: [{ id: "apertura", name: "Apertura", source: wiki }],
    teams: [
      { id: "x", name: "X" },
      { id: "y", name: "Y" },
      { id: "z", name: "Z" },
    ],
    stadiums: [{ id: "est", name: "Estadio", city: "Lima", altitude: 150, source }],
    matches: [held],
  };
  const withMatches = (...matches: object[]) => ({ ...season, matches });

  test("accepts a held match and a planned one", () => {
    const planned = { ...held, round: 2, status: "planned" } as Record<string, unknown>;
    delete planned.homeScore;
    delete planned.awayScore;
    expect(validateEvent(season)).toEqual([]);
    expect(validateEvent(withMatches(held, planned))).toEqual([]);
  });

  const failures: [string, unknown, string][] = [
    ["a missing kind", { ...season, kind: undefined }, "kind"],
    ["an unknown team", withMatches({ ...held, away: "w" }), "id of a team"],
    ["an unknown stadium", withMatches({ ...held, stadium: "otro" }), "id of a stadium"],
    ["an unknown tournament", withMatches({ ...held, tournament: "otro" }), "tournament"],
    ["a held match without scores", withMatches({ ...held, homeScore: undefined }), "homeScore"],
    ["a negative score", withMatches({ ...held, awayScore: -1 }), "awayScore"],
    ["a fractional score", withMatches({ ...held, homeScore: 1.5 }), "homeScore"],
    ["a planned match with a score", withMatches({ ...held, status: "planned" }), "no score"],
    [
      "a team that plays twice in a round",
      withMatches(held, { ...held, home: "z", away: "x" }),
      "already plays in round 1",
    ],
    [
      "a match outside the event dates",
      withMatches({ ...held, start: "2026-03-01T15:00-05:00" }),
      "outside the event dates",
    ],
    [
      "a stadium without an altitude",
      { ...season, stadiums: [{ ...season.stadiums[0], altitude: undefined }] },
      "altitude",
    ],
    [
      "a tournament link that is not permanent",
      {
        ...season,
        tournaments: [
          {
            id: "apertura",
            name: "A",
            source: { ...wiki, url: "https://es.wikipedia.org/wiki/T" },
          },
        ],
      },
      "oldid",
    ],
  ];

  test.each(failures)("rejects %s", (_name, data, message) => {
    const errors = validateEvent(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain(message);
  });
});

describe("validateSlug", () => {
  test.each([
    ["visita-leon-xiv-2026", true],
    ["Visita", false],
    ["con espacio", false],
    ["-inicio", false],
  ])("%s", (slug, ok) => {
    expect(validateSlug(slug).length === 0).toBe(ok);
  });
});

describe("data/events", () => {
  const files = readdirSync(EVENTS_DIR).filter((file) => file.endsWith(".json"));

  test("holds at least one event", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)("%s is valid", (file) => {
    const data = JSON.parse(readFileSync(join(EVENTS_DIR, file), "utf8"));
    expect(validateSlug(file.replace(/\.json$/, ""))).toEqual([]);
    expect(validateEvent(data)).toEqual([]);
  });
});

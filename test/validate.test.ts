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
  test("accepts a held act and a planned act, each with and without an expected figure", () => {
    const expected = { figure: 50, attribution: "Organizadores.", source };
    const range = { ...expected, low: 40, high: 60 };
    expect(validateEvent(event)).toEqual([]);
    for (const act of [heldAct, plannedAct]) {
      expect(validateEvent(withAct({ ...act, expected }))).toEqual([]);
      expect(validateEvent(withAct({ ...act, expected: range }))).toEqual([]);
    }
  });

  const expected = { figure: 50, attribution: "Organizadores.", source };
  const failures: [string, unknown, string][] = [
    [
      "an expected range with only a low",
      withAct({ ...heldAct, expected: { ...expected, low: 40 } }),
      "low and high go together",
    ],
    [
      "an expected figure outside its range",
      withAct({ ...heldAct, expected: { ...expected, low: 60, high: 70 } }),
      "low <= figure <= high",
    ],
    [
      "an expected figure of zero on a held act",
      withAct({ ...heldAct, expected: { ...expected, figure: 0 } }),
      "expected.figure",
    ],
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

describe("validateEvent, taquilla", () => {
  const wiki = {
    outlet: "Wikipedia en inglés",
    url: "https://en.wikipedia.org/wiki/List?oldid=10",
    revision: 10,
    revisionDate: "2026-02-10",
    license: "CC BY-SA 4.0",
  };
  const figure = (amount: number) => ({ amount, source: wiki });
  const released = {
    title: "Película",
    originalTitle: "Film",
    phase: 1,
    release: "2020-05-01",
    status: "released",
    opening: figure(100),
    usCanada: figure(300),
    worldwide: figure(600),
  };
  const planned = {
    title: "Otra",
    originalTitle: "Other",
    phase: 2,
    release: "2027-01-01",
    status: "unreleased",
  };
  const series = {
    kind: "taquilla",
    title: "Saga",
    summary: "Resumen.",
    start: "2020-05-01",
    end: "2027-01-01",
    places: ["Estados Unidos", "Mundial"],
    updated: "2026-02-10T12:00-05:00",
    method: "Método.",
    source: wiki,
    films: [released, planned],
  };
  const withFilms = (...films: object[]) => ({ ...series, films });
  const projection = {
    film: "Otra",
    low: 200,
    high: 300,
    by: "Analista",
    published: "2026-10-01",
    source: { outlet: "Prensa", url: "https://example.com/nota" },
  };
  const withProjection = (change: object) => ({
    ...series,
    projections: [{ ...projection, ...change }],
  });

  test("accepts a released film and an unreleased one", () => {
    expect(validateEvent(series)).toEqual([]);
  });

  test("accepts a projection for an unreleased film", () => {
    expect(validateEvent(withProjection({}))).toEqual([]);
  });

  test("accepts a projection for a film that has since been released", () => {
    const data = {
      ...series,
      films: [
        released,
        {
          ...planned,
          status: "released",
          opening: figure(100),
          usCanada: figure(300),
          worldwide: figure(600),
        },
      ],
      projections: [projection],
    };
    expect(validateEvent(data)).toEqual([]);
  });

  const failures: [string, unknown, string][] = [
    [
      "worldwide below domestic",
      withFilms({ ...released, worldwide: figure(200) }),
      "at least the US and Canada gross",
    ],
    [
      "opening above domestic",
      withFilms({ ...released, opening: figure(400) }),
      "must not exceed the US and Canada gross",
    ],
    [
      "a released film missing a figure",
      withFilms({ ...released, opening: undefined }),
      "amount and source",
    ],
    [
      "an unreleased film with a figure",
      withFilms({ ...planned, worldwide: figure(1) }),
      "no grosses",
    ],
    ["a figure without a source", withFilms({ ...released, opening: { amount: 5 } }), "source"],
    ["a negative figure", withFilms({ ...released, opening: figure(-1) }), "non-negative"],
    [
      "two films on one date",
      withFilms(released, { ...planned, release: released.release }),
      "in order of release",
    ],
    [
      "a source link that is not permanent",
      { ...series, source: { ...wiki, url: "https://en.wikipedia.org/wiki/X" } },
      "oldid",
    ],
    [
      "a film out of release order",
      withFilms(released, { ...planned, release: "2019-01-01", title: "Vieja" }),
      "in order of release",
    ],
    ["a projection with low above high", withProjection({ low: 300, high: 200 }), "below low"],
    [
      "a projection published on the release date",
      withProjection({ published: "2027-01-01" }),
      "before the release",
    ],
    [
      "a projection published after a film's release",
      withProjection({ film: "Película" }),
      "before the release",
    ],
    [
      "a projection for a title not in the list",
      withProjection({ film: "Inexistente" }),
      "film in the list",
    ],
    ["a projection without a source", withProjection({ source: undefined }), "outlet and url"],
    ["a projection without an author", withProjection({ by: " " }), "who made"],
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

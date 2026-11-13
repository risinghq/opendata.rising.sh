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
    const archived = {
      ...source,
      archive: `https://web.archive.org/web/20261113120000/${source.url}`,
    };
    expect(validateEvent(withAct({ ...heldAct, sources: [archived] }))).toEqual([]);
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
      "an archive copy off web.archive.org",
      withAct({
        ...heldAct,
        sources: [
          {
            ...source,
            archive: "https://example.com/web/20261113120000/https://example.org/nota",
          },
        ],
      }),
      "web.archive.org",
    ],
    [
      "an archive copy of another page",
      withAct({
        ...heldAct,
        sources: [
          {
            ...source,
            archive: "https://web.archive.org/web/20261113120000/https://example.org/otra",
          },
        ],
      }),
      "archive",
    ],
    [
      "an archive copy without a 14-digit timestamp",
      withAct({
        ...heldAct,
        sources: [
          { ...source, archive: "https://web.archive.org/web/2026/https://example.org/nota" },
        ],
      }),
      "archive",
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

  const teamStats = (possession: number) => ({
    possession,
    shotsOnTarget: 4,
    shotsOffTarget: 5,
    attacks: 80,
    dangerousAttacks: 30,
  });
  const events = {
    halfTime: { home: 0, away: 0 },
    goals: [{ minute: 10, team: "home" }],
    cards: [],
    corners: { home: 2, away: 1 },
    cornerMinutes: [
      { minute: 12, team: "home" },
      { minute: 40, team: "away" },
    ],
    substitutions: [{ minute: 60, team: "away" }],
    missedPenalties: [{ minute: 30, team: "home" }],
    stats: { home: teamStats(55), away: teamStats(45) },
  };
  const withEvents = (change: object) => withMatches({ ...held, events: { ...events, ...change } });

  test("accepts events with the match statistics, with stats null, and without the new fields", () => {
    expect(validateEvent(withEvents({}))).toEqual([]);
    expect(validateEvent(withEvents({ stats: null }))).toEqual([]);
    expect(
      validateEvent(withEvents({ stats: { home: teamStats(54), away: teamStats(47) } })),
    ).toEqual([]);
    const { cornerMinutes: _c, substitutions: _s, missedPenalties: _m, stats: _t, ...old } = events;
    expect(validateEvent(withMatches({ ...held, events: old }))).toEqual([]);
  });

  const failures: [string, unknown, string][] = [
    [
      "possession that does not add up to 100",
      withEvents({ stats: { home: teamStats(60), away: teamStats(45) } }),
      "add up to 100",
    ],
    [
      "possession above 100",
      withEvents({ stats: { home: teamStats(101), away: teamStats(0) } }),
      "stats.home.possession",
    ],
    [
      "a fractional shot count",
      withEvents({
        stats: { home: { ...teamStats(55), shotsOnTarget: 1.5 }, away: teamStats(45) },
      }),
      "stats.home.shotsOnTarget",
    ],
    [
      "a negative attack count",
      withEvents({ stats: { home: teamStats(55), away: { ...teamStats(45), attacks: -1 } } }),
      "stats.away.attacks",
    ],
    [
      "a statistic the feed does not name",
      withEvents({ stats: { home: { ...teamStats(55), fouls: 3 }, away: teamStats(45) } }),
      "stats.home.fouls",
    ],
    ["stats missing a side", withEvents({ stats: { home: teamStats(55) } }), "stats.away"],
    [
      "a substitution after minute 130",
      withEvents({ substitutions: [{ minute: 131, team: "home" }] }),
      "substitutions[0].minute",
    ],
    [
      "a missed penalty with no team",
      withEvents({ missedPenalties: [{ minute: 20 }] }),
      "missedPenalties[0].team",
    ],
    ["a corner minute that is not a list", withEvents({ cornerMinutes: {} }), "cornerMinutes"],
    [
      "more corner minutes than corners",
      withEvents({ corners: { home: 0, away: 1 } }),
      "more home corners",
    ],
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

  const mojo = {
    url: "https://www.boxofficemojo.com/title/tt1234567/",
    accessed: "2022-04-09",
    archive:
      "https://web.archive.org/web/20220402064159/https://www.boxofficemojo.com/title/tt1234567/",
  };

  test("accepts a Box Office Mojo citation with and without an archive copy", () => {
    expect(validateEvent(withFilms({ ...released, boxOfficeMojo: mojo }, planned))).toEqual([]);
    expect(
      validateEvent(
        withFilms({ ...released, boxOfficeMojo: { ...mojo, archive: undefined } }, planned),
      ),
    ).toEqual([]);
  });

  test("accepts a projection for an unreleased film", () => {
    expect(validateEvent(withProjection({}))).toEqual([]);
  });

  test("accepts a disputed figure and a disputed budget", () => {
    const claim = (amount: number, text: string, quote: string) => ({
      amount,
      text,
      quote,
      source: wiki,
    });
    const disputed = {
      ...released,
      worldwide: {
        amount: 1374959729,
        source: wiki,
        claims: [
          claim(1374959729, "$1,374,959,729", "$1,374,959,729"),
          claim(1350000000, "$1.35 billion", "It grossed $1.35 billion worldwide."),
        ],
      },
      budget: {
        low: 140000000,
        source: wiki,
        claims: [
          { low: 140000000, text: "$140 million", quote: "$140 million", source: wiki },
          {
            low: 150000000,
            text: "$150 million",
            quote: "budget = $150 million",
            source: wiki,
          },
        ],
      },
    };
    expect(validateEvent(withFilms(disputed, planned))).toEqual([]);
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
    [
      "a Box Office Mojo link on another site",
      withFilms({ ...released, boxOfficeMojo: { ...mojo, url: "https://example.com/film" } }),
      "boxofficemojo.com",
    ],
    [
      "a Box Office Mojo link on a look-alike host",
      withFilms({
        ...released,
        boxOfficeMojo: { ...mojo, url: "https://evilboxofficemojo.com/x" },
      }),
      "boxofficemojo.com",
    ],
    [
      "a Box Office Mojo access date that is not a date",
      withFilms({ ...released, boxOfficeMojo: { ...mojo, accessed: "April 9, 2022" } }),
      "boxOfficeMojo.accessed",
    ],
    [
      "an archive copy that is not on web.archive.org",
      withFilms({ ...released, boxOfficeMojo: { ...mojo, archive: "https://example.com/copy" } }),
      "web.archive.org",
    ],
    [
      "a Box Office Mojo citation on an unreleased film",
      withFilms({ ...planned, boxOfficeMojo: mojo }),
      "no grosses",
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
    [
      "claims without the value shown first",
      withFilms(
        {
          ...released,
          worldwide: {
            amount: 600,
            source: wiki,
            claims: [
              { amount: 500, text: "$500 million", quote: "$500 million", source: wiki },
              { amount: 600, text: "$600 million", quote: "$600 million", source: wiki },
            ],
          },
        },
        planned,
      ),
      "the claim of the value shown",
    ],
    [
      "a claim whose quote lacks the written value",
      withFilms(
        {
          ...released,
          worldwide: {
            amount: 600,
            source: wiki,
            claims: [
              { amount: 600, text: "$600 million", quote: "$600 million", source: wiki },
              { amount: 500, text: "$500 million", quote: "It made a lot.", source: wiki },
            ],
          },
        },
        planned,
      ),
      "must contain the value as written",
    ],
    [
      "a claim whose text writes another value",
      withFilms(
        {
          ...released,
          worldwide: {
            amount: 600,
            source: wiki,
            claims: [
              { amount: 600, text: "$600 million", quote: "$600 million", source: wiki },
              { amount: 500, text: "$700 million", quote: "It made $700 million.", source: wiki },
            ],
          },
        },
        planned,
      ),
      "must write the claimed value",
    ],
    [
      "an other claim equal to the value shown",
      withFilms(
        {
          ...released,
          worldwide: {
            amount: 600,
            source: wiki,
            claims: [
              { amount: 600, text: "$600 million", quote: "$600 million", source: wiki },
              { amount: 600, text: "$600 million", quote: "It made $600 million.", source: wiki },
            ],
          },
        },
        planned,
      ),
      "must differ from the value shown",
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

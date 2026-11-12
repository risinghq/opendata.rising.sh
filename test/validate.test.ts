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

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { agrees, articleClaims, budgetAgrees } from "../scripts/mcu-claims.ts";
import { toFilm } from "../scripts/import-mcu.ts";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

const article = (name: string) => ({
  title: "X",
  revid: 1,
  timestamp: "2026-01-01T00:00:00Z",
  wikitext: fixture(name),
});

describe("articleClaims", () => {
  test("reads the infobox and the box office lead", () => {
    const claims = articleClaims(fixture("mcu-article.wiki"), ["first film"]);
    expect(claims.worldwide.map((c) => c.value)).toEqual([585_800_000]);
    expect(claims.usCanada.map((c) => c.value)).toEqual([319_000_000]);
    expect(claims.budget.map((c) => c.low)).toEqual([140_000_000]);
    for (const list of [claims.worldwide, claims.usCanada, claims.budget]) {
      for (const claim of list) expect(claim.quote).toContain(claim.text);
    }
  });

  test("skips milestones, other films and opening figures", () => {
    const claims = articleClaims(fixture("mcu-article-dispute.wiki"), ["second film"]);
    expect(claims.worldwide.map((c) => c.value)).toEqual([1_350_000_000]);
    expect(claims.usCanada.map((c) => c.value)).toEqual([700_400_000]);
    expect(claims.budget.map((c) => c.low)).toEqual([150_000_000]);
  });

  test("reads each Plainlist budget item with its own quote and basis", () => {
    const claims = articleClaims(fixture("mcu-article-plainlist.wiki"), ["second film"]);
    expect(claims.budget.map((c) => [c.low, c.high, c.basis, c.quote])).toEqual([
      [444_000_000, 495_200_000, "gross", "$444–495.2 million (gross)"],
      [350_600_000, undefined, "net", "$350.6 million (net)"],
    ]);
  });
});

describe("agrees", () => {
  test("a rounded figure agrees at its written precision", () => {
    const claim = { value: 585_800_000, precision: 1e5, lowerBound: false, text: "", quote: "" };
    expect(agrees(claim, 585_796_247)).toBe(true);
    expect(agrees(claim, 585_700_000)).toBe(false);
  });

  test("a real difference does not agree", () => {
    const claim = {
      value: 1_350_000_000,
      precision: 1e7,
      lowerBound: false,
      text: "",
      quote: "",
    };
    expect(agrees(claim, 1_374_959_729)).toBe(false);
  });

  test.each([
    ["The Avengers worldwide", 1_520_000_000, 1e6, 1_520_538_536],
    ["Iron Man 3 worldwide", 1_215_000_000, 1e6, 1_215_577_205],
    ["Guardians of the Galaxy worldwide", 773_300_000, 1e5, 773_350_147],
  ])("a truncated figure agrees: %s", (_name, value, precision, table) => {
    expect(agrees({ value, precision, lowerBound: false }, table)).toBe(true);
  });

  test("a coarser table figure agrees at the table's precision", () => {
    const claim = {
      low: 288_500_000,
      precision: 1e5,
      text: "$288.5 million",
      quote: "",
    };
    expect(budgetAgrees(claim, { low: 289_000_000, precision: 1e6 })).toBe(true);
  });

  test("budget claims compare points and ranges", () => {
    const point = { low: 150_000_000, precision: 1e6, text: "", quote: "" };
    const table = (low: number, high?: number) => ({ low, high, precision: 1e6 });
    expect(budgetAgrees(point, table(140_000_000))).toBe(false);
    expect(budgetAgrees(point, table(140_000_000, 186_000_000))).toBe(true);
    expect(budgetAgrees({ ...point, high: 186_000_000 }, table(150_000_000))).toBe(true);
    expect(budgetAgrees({ ...point, high: 200_000_000 }, table(140_000_000))).toBe(false);
  });
});

describe("toFilm with claims", () => {
  const src = { outlet: "Wikipedia en inglés", url: "https://en.wikipedia.org/wiki/X?oldid=1" };
  const base = {
    title: "",
    originalTitle: "Second Film",
    phase: 3,
    release: "2018-02-16",
    usCanada: 700_392_123,
    worldwide: 1_374_959_729,
    budget: { low: 140_000_000 },
    cells: {
      usCanada: "$700,392,123",
      worldwide: "$1,374,959,729",
      budget: "$140&nbsp;million",
    },
  };

  test("records a dispute with the table claim first", () => {
    const film = toFilm({ ...base, article: article("mcu-article-dispute.wiki") }, "X", src, src);
    expect(film.status).toBe("released");
    if (!("worldwide" in film)) return;
    expect("claims" in film.worldwide).toBe(true);
    if (!("claims" in film.worldwide)) return;
    const claims = film.worldwide.claims!;
    expect(claims).toHaveLength(2);
    expect(claims[0]).toMatchObject({ amount: 1_374_959_729, text: "$1,374,959,729" });
    expect(claims[1]).toMatchObject({ amount: 1_350_000_000, text: "$1.35 billion" });
    if (!film.budget || !("claims" in film.budget)) throw new Error("budget claims missing");
    expect(film.budget.claims![1]).toMatchObject({ low: 150_000_000, text: "$150 million" });
    expect("claims" in film.usCanada).toBe(false);
    expect("claims" in film.opening).toBe(false);
  });

  test("leaves an agreeing figure without claims", () => {
    const film = toFilm(
      {
        ...base,
        usCanada: 319_034_126,
        worldwide: 585_796_247,
        cells: { usCanada: "$319,034,126", worldwide: "$585,796,247", budget: "$140&nbsp;million" },
        article: article("mcu-article.wiki"),
      },
      "X",
      src,
      src,
    );
    expect(film.status).toBe("released");
    if (!("worldwide" in film)) return;
    expect("claims" in film.worldwide).toBe(false);
    expect("claims" in film.usCanada).toBe(false);
    expect(film.budget && "claims" in film.budget).toBe(false);
  });
});

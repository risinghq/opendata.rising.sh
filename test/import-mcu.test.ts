import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { toFilm } from "../scripts/import-mcu.ts";
import {
  labeledSection,
  openingWeekend,
  parseBoxOfficeRows,
  parseFilmList,
} from "../scripts/mcu-wikitext.ts";

const wikitext = readFileSync(join(import.meta.dirname, "fixtures/mcu-boxoffice.wiki"), "utf8");
const section = labeledSection(wikitext, "BoxOffice")!;

describe("box office table", () => {
  test("parses every released film row", () => {
    const rows = parseBoxOfficeRows(section);
    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect(first).toMatchObject({
      originalTitle: "First Film (film)",
      release: "2020-05-01",
      usCanada: 274_286_610,
      worldwide: 521_858_728,
      budget: { low: 200_000_000 },
    });
    expect(second).toMatchObject({
      originalTitle: "Second Film",
      release: "2021-07-09",
      usCanada: 183_651_655,
      worldwide: 379_751_655,
      budget: { low: 160_000_000, high: 200_000_000 },
    });
  });

  test("reads cells written on one line", () => {
    const table = `{| class="wikitable"
! scope="col" | Film
|-
! scope="row" | ''[[Third Film]]''
| {{#invoke:dts|main|2022|1|1}} || $100,000,000 || $50,000,000 || $150,000,000 || 1 || 2 || $50&nbsp;million || <ref />
|}`;
    const rows = parseBoxOfficeRows(table);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ usCanada: 100_000_000, worldwide: 150_000_000 });
  });

  test("skips the total row", () => {
    const rows = parseBoxOfficeRows(section);
    expect(rows.some((f) => /total/i.test(f.originalTitle))).toBe(false);
  });
});

describe("films list", () => {
  test("parses released and unreleased films with dates", () => {
    const films = parseFilmList(wikitext.slice(wikitext.indexOf("== Films ==")));
    expect(films).toEqual([
      { originalTitle: "First Film (film)", release: "2020-05-01" },
      { originalTitle: "Second Film", release: "2021-07-09" },
      { originalTitle: "Future Film", release: "2027-12-17" },
    ]);
  });
});

describe("opening weekend", () => {
  test("picks the domestic opening figure, not projections or later weekends", () => {
    const article = `
== Box office ==
=== United States and Canada ===
Early tracking suggested a $200&nbsp;million debut was possible. ''Film'' earned
$357.1&nbsp;million in its opening weekend, breaking the record by $100&nbsp;million.
It earned $17.2&nbsp;million the following weekend (a total of $22.3&nbsp;million over
the four-day Memorial Day weekend), crossing the $800&nbsp;million mark domestically.
=== Other territories ===
It earned $1.2&nbsp;billion worldwide in its opening weekend.`;
    expect(openingWeekend(article)).toBe(357_100_000);
  });

  test("reads the figure when the article has no United States subsection", () => {
    const article = `== Box office ==
''Film'' grossed $98.6&nbsp;million in 4,105 theaters in the United States and Canada
in its opening weekend, ranking first at the box office. It grossed $35.2&nbsp;million
on its first day.`;
    expect(openingWeekend(article)).toBe(98_600_000);
  });

  test("skips the opening-day figure for the first weekend total", () => {
    const article = `== Box office ==
=== United States and Canada ===
''Avengers: Age of Ultron'' earned $84.46 million on its opening day.
The film totaled $191.3 million in its opening weekend.
=== Other territories ===
''Avengers: Age of Ultron'' earned $27.3 million during the weekend in the
United Kingdom.`;
    expect(openingWeekend(article)).toBe(191_300_000);
  });

  test("skips projections between the daily figures and the weekend total", () => {
    const article = `== Box office ==
=== United States and Canada ===
''Captain America: Civil War'' earned $75.5 million on its opening day.
The film went on to earn $61.2 million on Saturday and $42.4 million on Sunday,
for a total opening weekend gross of $179.1 million.
Initial projections had it earning between $175–200 million on its opening weekend.`;
    expect(openingWeekend(article)).toBe(179_100_000);
  });

  test("skips the global debut when no domestic subsection exists", () => {
    const article = `== Box office ==
The film's opening weekend earned $303.3 million globally.
Its opening weekend earned $144.2 million, the largest debut of the franchise.`;
    expect(openingWeekend(article)).toBe(144_200_000);
  });
});

describe("toFilm", () => {
  const src = { outlet: "Wikipedia en inglés", url: "https://en.wikipedia.org/wiki/X?oldid=1" };
  const released = {
    title: "",
    originalTitle: "Mystery Film",
    phase: 1,
    release: "2020-05-01",
    usCanada: 100,
    worldwide: 300,
    article: {
      title: "Mystery Film",
      revid: 1,
      timestamp: "2026-01-01T00:00:00Z",
      wikitext: "== Box office ==\nIt was released without weekend figures.",
    },
  };

  test("throws naming the film when no opening weekend is parsed", () => {
    expect(() => toFilm(released, "Mystery Film", src, src)).toThrow(/Mystery Film/);
  });

  test("strips the film disambiguator from the original title", () => {
    const row = { ...released, originalTitle: "Iron Man (2008 film)" };
    const article = {
      ...row.article!,
      wikitext: "''Iron Man'' grossed $98.6 million in its opening weekend.",
    };
    expect(toFilm({ ...row, article }, "Iron Man", src, src).originalTitle).toBe("Iron Man");
  });

  test("keeps an unreleased film without asking for an opening", () => {
    const film = { ...released, usCanada: undefined, worldwide: undefined };
    expect(toFilm(film, "Mystery Film", src, src)).toMatchObject({ status: "unreleased" });
  });
});

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

  test("reads each row's Box Office Mojo citation, from the template or from a cite web url", () => {
    const [first, second] = parseBoxOfficeRows(section);
    expect(first!.boxOfficeMojo).toEqual({
      url: "https://www.boxofficemojo.com/title/tt1234567/",
      accessed: "2020-11-27",
      archive:
        "https://web.archive.org/web/20201127165355/https://www.boxofficemojo.com/title/tt1234567/",
    });
    expect(second!.boxOfficeMojo).toEqual({
      url: "https://www.boxofficemojo.com/release/rl3111421441/",
      accessed: "2025-01-11",
      archive:
        "https://web.archive.org/web/20241213143253/https://www.boxofficemojo.com/release/rl3111421441/",
    });
  });

  const rowWith = (ref: string) => `{| class="wikitable"
! scope="col" | Film
|-
! scope="row" | ''[[Third Film]]''
| {{#invoke:dts|main|2022|1|1}} || $100,000,000 || $50,000,000 || $150,000,000 || 1 || 2 || $50&nbsp;million || ${ref}
|}`;

  test.each([
    {
      name: "no archive copy",
      ref: '<ref name="B">{{Cite Box Office Mojo |id=3498820 |title=Third Film |access-date=April 9, 2022 }}</ref>',
      expected: { url: "https://www.boxofficemojo.com/title/tt3498820/", accessed: "2022-04-09" },
    },
    {
      name: "an id that already starts with tt",
      ref: "<ref>{{cite Box Office Mojo |id=tt6320628|title=Third Film |access-date=November 19, 2019}}</ref>",
      expected: { url: "https://www.boxofficemojo.com/title/tt6320628/", accessed: "2019-11-19" },
    },
    {
      name: "a citation that follows a ref of another outlet",
      ref: '<ref name="N">{{Cite NUM |id=Third |title=Third |access-date=April 10, 2022}}</ref><ref name="B">{{Cite Box Office Mojo |title=Third Film |id=1 |access-date=June 12, 2022 }}</ref>',
      expected: { url: "https://www.boxofficemojo.com/title/tt1/", accessed: "2022-06-12" },
    },
    {
      name: "no citation",
      ref: '<ref name="N">{{Cite NUM |id=Third |title=Third |access-date=April 10, 2022}}</ref>',
      expected: undefined,
    },
    {
      name: "a reused name with no body",
      ref: '<ref name="Elsewhere" />',
      expected: undefined,
    },
    {
      name: "a citation without an access date",
      ref: "<ref>{{Cite Box Office Mojo |id=1 |title=Third Film}}</ref>",
      expected: undefined,
    },
  ])("citation with $name", ({ ref, expected }) => {
    expect(parseBoxOfficeRows(rowWith(ref))[0]!.boxOfficeMojo).toEqual(expected);
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

  test("keeps the efn of the title cell as a note", () => {
    const table = `{| class="wikitable"
! scope="col" | Film
|-
! scope="row" | ''[[Third Film]]''{{efn|The row adds its September 2026 re-release, ''[[Third Film: Encore]]''.<ref />}}
| {{#invoke:dts|main|2022|1|1}} || $100,000,000 || $50,000,000 || $150,000,000 || 1 || 2 || $50&nbsp;million || <ref />
|}`;
    const rows = parseBoxOfficeRows(table);
    expect(rows[0]!.note).toBe("The row adds its September 2026 re-release, Third Film: Encore.");
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

  test("stores the Box Office Mojo citation on the film", () => {
    const boxOfficeMojo = {
      url: "https://www.boxofficemojo.com/title/tt1/",
      accessed: "2022-06-12",
    };
    const article = {
      ...released.article,
      wikitext: "''Mystery Film'' grossed $50 million in its opening weekend.",
    };
    expect(toFilm({ ...released, article, boxOfficeMojo }, "Mystery Film", src, src)).toMatchObject(
      { boxOfficeMojo },
    );
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

  test("writes the re-release efn as a Spanish note", () => {
    const film = {
      ...released,
      usCanada: undefined,
      worldwide: undefined,
      note: "The row adds its September 2026 re-release, Third Film: Encore.",
    };
    expect(toFilm(film, "Mystery Film", src, src).note).toBe(
      "Las cifras incluyen el reestreno de septiembre de 2026, Third Film: Encore.",
    );
  });

  test("throws naming the film when the efn cannot be written as a note", () => {
    const film = { ...released, usCanada: undefined, worldwide: undefined, note: "Unrelated." };
    expect(() => toFilm(film, "Mystery Film", src, src)).toThrow(/Mystery Film/);
  });
});

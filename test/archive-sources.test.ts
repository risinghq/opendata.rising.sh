import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  archiveUrl,
  collectSources,
  fillArchives,
  knownCopies,
  skipReason,
  type Copy,
  type Deps,
} from "../scripts/archive-sources.ts";
import { archiveCopyUrl, isArchiveCopy } from "../src/data/wayback.ts";

const fixture = readFileSync(join(import.meta.dirname, "fixtures/archive-event.json"), "utf8");

describe("collectSources", () => {
  test("walks every source an event file can hold", () => {
    const event = {
      acts: [
        {
          sources: [{ outlet: "A", url: "https://a.example/1" }],
          expected: { source: { outlet: "B", url: "https://b.example/2" } },
        },
      ],
      comparison: [{ source: { outlet: "C", url: "https://c.example/3" } }],
      films: [
        {
          worldwide: {
            source: { outlet: "D", url: "https://d.example/4" },
            claims: [{ source: { outlet: "E", url: "https://e.example/5" } }],
          },
        },
      ],
      stadiums: [{ source: { outlet: "F", url: "https://f.example/6", archive: "x" } }],
      tournaments: [
        {
          source: {
            outlet: "G",
            url: "https://g.example/7",
            revision: 1,
            revisionDate: "2026-01-01",
            license: "CC",
          },
        },
      ],
      boxOfficeMojo: { url: "https://mojo.example/8", accessed: "2020-01-01" },
    };
    const refs = collectSources(event);
    expect(refs.map((ref) => ref.path).toSorted()).toEqual([
      "acts[0].expected.source",
      "acts[0].sources[0]",
      "comparison[0].source",
      "films[0].worldwide.claims[0].source",
      "films[0].worldwide.source",
      "stadiums[0].source",
      "tournaments[0].source",
    ]);
    expect(refs.find((ref) => ref.source.url === "https://f.example/6")?.source.archive).toBe("x");
    expect(refs.some((ref) => ref.source.url === "https://mojo.example/8")).toBe(false);
  });
});

describe("skipReason", () => {
  test.each([
    ["https://es.wikipedia.org/wiki/Torneo?oldid=176066240", "revision"],
    ["https://anywhere.example/page?oldid=1", "revision"],
    ["https://api.open-meteo.com/v1/elevation?latitude=-12&longitude=-77", "API"],
    [
      "https://web.archive.org/web/20200101000000/https://example.org/nota",
      "already an archived copy",
    ],
    ["not a url", "not a URL"],
  ])("skips %s", (url, reason) => {
    expect(skipReason(url)).toContain(reason);
  });

  test.each([
    "https://www.elnuevodia.com/noticias/mundo/notas/nota/",
    "https://andina.pe/agencia/noticia-papa-1",
  ])("does not skip %s", (url) => {
    expect(skipReason(url)).toBeUndefined();
  });
});

describe("the archive copy form", () => {
  const url = "https://example.org/nota";
  test("archiveCopyUrl builds a copy isArchiveCopy accepts", () => {
    const copy = archiveCopyUrl("20261113120000", url);
    expect(copy).toBe(`https://web.archive.org/web/20261113120000/${url}`);
    expect(isArchiveCopy(copy, url)).toBe(true);
  });

  test.each([
    "https://web.archive.org/web/2026/https://example.org/nota",
    "https://web.archive.org/web/20261113120000/https://example.org/otra",
    "https://example.com/web/20261113120000/https://example.org/nota",
    "http://web.archive.org/web/20261113120000/https://example.org/nota",
  ])("isArchiveCopy rejects %s", (archive) => {
    expect(isArchiveCopy(archive, url)).toBe(false);
  });
});

describe("fillArchives", () => {
  const url = "https://example.org/nota";
  const copy = archiveCopyUrl("20261113120000", url);
  const counting = (answer: Copy | null) => {
    const asked: string[] = [];
    const lookup = async (u: string) => {
      asked.push(u);
      return answer;
    };
    return { asked, lookup };
  };

  test("writes the copy into each source with the url and touches nothing else", async () => {
    const data = JSON.parse(fixture);
    const refs = collectSources(data);
    const { asked, lookup } = counting({ archive: copy, how: "found" });
    const copies = knownCopies(refs);
    await fillArchives(
      refs.filter((ref) => ref.source.url === url),
      copies,
      lookup,
    );
    expect(asked).toEqual([url]);
    expect(data.acts[0].sources[0].archive).toBe(copy);
    expect(data.acts[0].expected.source.archive).toBe(copy);
    expect(data.comparison[0].source.archive).toBe(copy);
    expect(data.acts[0].sources[1].archive).toBeUndefined();
    expect(data.meta).toEqual({ url: "https://mojo.example/title/tt1/", accessed: "2020-11-27" });
    const text = `${JSON.stringify(data, null, 2)}\n`;
    expect(text.replace(/,\n\s*"archive": "[^"]*"/g, "")).toBe(fixture);
  });

  test("reuses a copy an earlier source of the same url carries", async () => {
    const data = {
      acts: [
        { sources: [{ outlet: "A", url, archive: copy }] },
        { sources: [{ outlet: "A", url }] },
      ],
    };
    const refs = collectSources(data);
    const { asked, lookup } = counting(null);
    expect(await fillArchives(refs, knownCopies(refs), lookup)).toBe(1);
    expect(asked).toEqual([]);
    expect(data.acts[1]!.sources[0]).toEqual({ outlet: "A", url, archive: copy });
  });

  test("reuses a copy a later source carries and never duplicates the key", async () => {
    const data = {
      acts: [
        { sources: [{ outlet: "A", url }] },
        { sources: [{ outlet: "A", url, archive: copy }] },
      ],
    };
    const refs = collectSources(data);
    const { asked, lookup } = counting(null);
    await fillArchives(refs, knownCopies(refs), lookup);
    expect(asked).toEqual([]);
    const text = JSON.stringify(data, null, 2);
    expect(text.match(/"archive"/g)).toHaveLength(2);
    expect(Object.keys(data.acts[0]!.sources[0]!)).toEqual(["outlet", "url", "archive"]);
  });

  test("asks once for a url without a copy and skips pinned sources", async () => {
    const data = {
      acts: [
        { sources: [{ outlet: "A", url }] },
        { sources: [{ outlet: "A", url }] },
        { sources: [{ outlet: "W", url: "https://es.wikipedia.org/wiki/X?oldid=1" }] },
      ],
    };
    const refs = collectSources(data);
    const { asked, lookup } = counting(null);
    expect(await fillArchives(refs, knownCopies(refs), lookup)).toBe(0);
    expect(asked).toEqual([url]);
    expect(JSON.stringify(data)).not.toContain("archive");
  });
});

describe("archiveUrl", () => {
  const url = "https://example.org/nota";
  const copy = archiveCopyUrl("20261113120000", url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const available = json({
    archived_snapshots: {
      closest: { available: true, timestamp: "20261113120000" },
    },
  });
  const empty = json({ archived_snapshots: {} });

  function depsFor(responses: Record<string, Response>) {
    const calls: string[] = [];
    const deps: Deps = {
      fetch: async (u) => {
        calls.push(u);
        return (responses[u] ?? empty).clone();
      },
      sleep: () => Promise.resolve(),
    };
    return { deps, calls };
  }

  const avail = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const save = `https://web.archive.org/save/${url}`;

  test("uses the newest snapshot and never asks Save Page Now", async () => {
    const { deps, calls } = depsFor({ [avail]: available });
    expect(await archiveUrl(url, deps)).toEqual({ archive: copy, how: "found" });
    expect(calls).toEqual([avail]);
  });

  test("asks Save Page Now when no snapshot exists", async () => {
    const saved = new Response("saved", { status: 200 });
    let answers = 0;
    const calls: string[] = [];
    const deps: Deps = {
      fetch: async (u) => {
        calls.push(u);
        if (u === avail) return ++answers >= 2 ? available.clone() : empty.clone();
        if (u === save) return saved.clone();
        return empty.clone();
      },
      sleep: () => Promise.resolve(),
    };
    expect(await archiveUrl(url, deps)).toEqual({ archive: copy, how: "saved" });
    expect(calls).toEqual([avail, save, avail]);
  });

  test("confirms the copy when the Save Page Now request fails", async () => {
    let answers = 0;
    const calls: string[] = [];
    const deps: Deps = {
      fetch: async (u) => {
        calls.push(u);
        if (u === avail) return ++answers >= 3 ? available.clone() : empty.clone();
        if (u === save) return new Response("nope", { status: 500 });
        return empty.clone();
      },
      sleep: () => Promise.resolve(),
    };
    expect(await archiveUrl(url, deps)).toEqual({ archive: copy, how: "saved" });
    expect(calls).toEqual([avail, save, avail, avail]);
  });

  test("confirms the copy when the Save Page Now request times out", async () => {
    let answers = 0;
    const deps: Deps = {
      fetch: async (u) => {
        if (u === avail) return ++answers >= 2 ? available.clone() : empty.clone();
        if (u === save) throw new Error("The operation timed out.");
        return empty.clone();
      },
      sleep: () => Promise.resolve(),
    };
    expect(await archiveUrl(url, deps)).toEqual({ archive: copy, how: "saved" });
  });

  test("gives up when no copy ever appears", async () => {
    const { deps } = depsFor({ [save]: new Response("ok", { status: 200 }) });
    expect(await archiveUrl(url, deps)).toBeNull();
  });
});

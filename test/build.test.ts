import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadEvents } from "../src/data/load.ts";
import { tournamentNotice } from "../src/data/notice.ts";
import { heldActs } from "../src/data/stats-asistencia.ts";

const root = join(import.meta.dirname, "..");
const out = mkdtempSync(join(tmpdir(), "opendata-build-"));
const read = (path: string) => readFileSync(join(out, path), "utf8");

beforeAll(() => {
  const result = Bun.spawnSync(["bun", "scripts/build.ts", "--out", out], { cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
});

test("every event page holds its metadata, tables and downloads without JavaScript", () => {
  for (const event of loadEvents()) {
    const html = read(`eventos/${event.slug}.html`);
    expect(html).toContain(`<title>${event.title}`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="description"');
    expect(html).not.toContain("<script");
    const json = JSON.parse(read(`eventos/${event.slug}.json`));
    const csv = read(`eventos/${event.slug}.csv`).split("\r\n");

    if (event.kind === "asistencia") {
      expect(html).toContain('<table class="acts-table">');
      for (const act of event.acts) expect(html).toContain(act.name);
      for (const source of heldActs(event).flatMap((act) => act.sources)) {
        expect(html).toContain(`href="${source.url.replaceAll("&", "&amp;")}"`);
      }
      expect(json.acts).toHaveLength(event.acts.length);
      expect(csv).toHaveLength(event.acts.length + 2);
    } else {
      for (const name of ["standings-table", "altitude-table", "matches-table"]) {
        expect(html).toContain(`<table class="${name}">`);
      }
      for (const tournament of event.tournaments) {
        const notice = tournamentNotice(tournament);
        expect(html).toContain(notice);
        expect(json.aviso).toContain(notice);
        expect(csv[1]).toContain(notice.split(",")[0]);
        expect(html).toContain(`href="${tournament.source.url}"`);
      }
      expect(json.matches).toHaveLength(event.matches.length);
      expect(csv).toHaveLength(event.matches.length + 2);
    }
  }
});

test("the home page lists each event and the 404 page exists", () => {
  for (const event of loadEvents()) expect(read("index.html")).toContain(`/eventos/${event.slug}`);
  expect(read("404.html")).toContain("<title>");
});

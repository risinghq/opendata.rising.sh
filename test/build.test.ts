import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadEvents } from "../src/data/load.ts";
import { heldActs } from "../src/data/stats.ts";

const root = join(import.meta.dirname, "..");
const out = mkdtempSync(join(tmpdir(), "opendata-build-"));
const read = (path: string) => readFileSync(join(out, path), "utf8");

beforeAll(() => {
  const result = Bun.spawnSync(["bun", "scripts/build.ts", "--out", out], { cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
});

test("every event page holds its act table, metadata and downloads without JavaScript", () => {
  for (const event of loadEvents()) {
    const html = read(`eventos/${event.slug}.html`);
    expect(html).toContain(`<title>${event.title}`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="description"');
    expect(html).toContain('<table class="acts-table">');
    expect(html).not.toContain("<script");
    for (const act of event.acts) expect(html).toContain(act.name);
    for (const source of heldActs(event).flatMap((act) => act.sources)) {
      expect(html).toContain(`href="${source.url.replaceAll("&", "&amp;")}"`);
    }

    const json = JSON.parse(read(`eventos/${event.slug}.json`));
    expect(json.acts).toHaveLength(event.acts.length);
    const csv = read(`eventos/${event.slug}.csv`).split("\r\n");
    expect(csv).toHaveLength(event.acts.length + 2);
  }
});

test("the home page lists each event and the 404 page exists", () => {
  for (const event of loadEvents()) expect(read("index.html")).toContain(`/eventos/${event.slug}`);
  expect(read("404.html")).toContain("<title>");
});

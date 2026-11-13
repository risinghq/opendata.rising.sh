import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadEvents } from "../src/data/load.ts";
import { latestYear, loadCpi } from "../src/data/cpi.ts";
import { formatMoney } from "../src/data/format.ts";
import { MOJO_LABEL, taquillaNotice, tournamentNotice } from "../src/data/notice.ts";
import { heldActs } from "../src/data/stats-asistencia.ts";
import { isReleased, realAmount } from "../src/data/stats-taquilla.ts";
import type { McuSnapshot } from "../src/forecast/mcu.ts";

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
        if (source.archive) {
          expect(html).toMatch(
            new RegExp(`href="${RegExp.escape(source.archive)}"[^>]*class="archive-copy"`),
          );
        }
      }
      expect(json.acts).toHaveLength(event.acts.length);
      expect(csv).toHaveLength(event.acts.length + 2);
    } else if (event.kind === "temporada") {
      for (const name of ["standings-table", "altitude-table", "matches-table"]) {
        expect(html).toContain(`<table class="${name}">`);
      }
      for (const tournament of event.tournaments) {
        expect(html).toContain(tournamentNotice(tournament));
        expect(json.aviso).toContain(
          `${tournament.name}, revisión del ${tournamentNotice(tournament).split("revisión del ")[1]}`,
        );
        expect(csv[1]).toContain("Datos de Wikipedia en español (CC BY-SA 4.0)");
        expect(html).toContain(`href="${tournament.source.url}"`);
      }
      expect(json.matches).toHaveLength(event.matches.length);
      expect(csv).toHaveLength(event.matches.length + 2);
    } else {
      expect(html).toContain('<table class="films-table">');
      expect(html).toContain('<table class="gross-table">');
      expect(html).toContain(taquillaNotice(event));
      expect(json.aviso).toBe(taquillaNotice(event));
      expect(csv[1]).toContain("Datos de Wikipedia en inglés (CC BY-SA 4.0)");
      expect(html).toContain(`href="${event.source.url}"`);
      for (const film of event.films) {
        expect(html).toContain(film.title.replaceAll("&", "&amp;"));
      }
      for (const film of event.films.filter(isReleased)) {
        expect(html).toContain(`href="${film.worldwide.source.url}"`);
      }
      const cited = event.films.filter(isReleased).filter((film) => film.boxOfficeMojo);
      expect(cited.length).toBeGreaterThan(0);
      expect(html.split(MOJO_LABEL).length - 1).toBe(cited.length);
      for (const film of cited) {
        const { url, archive, accessed } = film.boxOfficeMojo!;
        expect(html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
        if (archive) expect(html).toContain(`href="${archive.replaceAll("&", "&amp;")}"`);
        expect(
          csv.some((line) => line.includes(`"${MOJO_LABEL}",${url},${archive ?? ""},${accessed},`)),
        ).toBe(true);
      }
      expect(json.films).toHaveLength(event.films.length);
      expect(csv).toHaveLength(event.films.length + 2);
    }
  }
});

test("the home page lists each event and the 404 page exists", () => {
  for (const event of loadEvents()) expect(read("index.html")).toContain(`/eventos/${event.slug}`);
  expect(read("404.html")).toContain("<title>");
});

test("the forecast shows the actual figures once the target film is released", () => {
  const event = loadEvents().find((e) => e.kind === "taquilla");
  if (!event) throw new Error("no taquilla event");
  const cpi = loadCpi();
  const released = event.films.find(isReleased)!;
  const snap = {
    series: "mcu",
    event: event.slug,
    date: "2026-11-12",
    dollars: cpi.base,
    target: { title: released.title, release: released.release },
    filmsUsed: [],
    model: {
      form: "",
      covariates: [],
      ridge: 1,
      interval: 0.8,
      coefficients: { opening: [0], worldwide: [0] },
    },
    predictions: {
      opening: { point: 1, low: 1, high: 2 },
      worldwide: { point: 1, low: 1, high: 2 },
    },
    backtest: {
      cases: 0,
      byFigure: {
        opening: { model: 0, naive: 0 },
        worldwide: { model: 0, naive: 0 },
      },
      rows: [],
    },
  } satisfies McuSnapshot;
  const page = (s: McuSnapshot) => {
    const payload = join(out, "render-payload.json");
    writeFileSync(payload, JSON.stringify({ event, forecast: s }));
    const proc = Bun.spawnSync(["bun", "test/render-taquilla.ts"], {
      stdin: Bun.file(payload),
      cwd: root,
    });
    if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
    return proc.stdout.toString();
  };

  const releasedHtml = page(snap);
  expect(releasedHtml).toContain("Dentro del intervalo");
  expect(releasedHtml).toContain(formatMoney(realAmount(released.worldwide.amount, released, cpi)));
  const old = page({ ...snap, dollars: 2020 });
  expect(old).toContain("Real (dólares de 2020)");
  expect(old).toContain(formatMoney(realAmount(released.worldwide.amount, released, cpi, 2020)));

  const unreleased = event.films.find((f) => f.status === "unreleased")!;
  const noActuals = page({
    ...snap,
    target: { title: unreleased.title, release: unreleased.release },
  });
  expect(noActuals).not.toContain("Dentro del intervalo");

  for (const film of event.films) expect(film.originalTitle).not.toMatch(/\(.*film\)$/);
});

test("the CPI series covers every film year or is clamped to its latest year", () => {
  const cpi = loadCpi();
  const event = loadEvents().find((e) => e.kind === "taquilla");
  if (!event) throw new Error("no taquilla event");
  for (const film of event.films.filter(isReleased)) {
    const year = Number(film.release.slice(0, 4));
    if (year > latestYear(cpi)) continue;
    expect(cpi.values[String(year)]).toBeDefined();
  }
});

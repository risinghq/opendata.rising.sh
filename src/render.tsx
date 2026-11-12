import { renderToString, type JSX } from "@solidjs/web";

import { Document, type Meta } from "./components/Document.tsx";
import { toCsv, toJson } from "./downloads.ts";
import { formatDecimal, formatNumber } from "./data/format.ts";
import { heldActs, sumRange } from "./data/stats-asistencia.ts";
import { keyFigures } from "./data/stats-temporada.ts";
import { keyFigures as taquillaFigures } from "./data/stats-taquilla.ts";
import { loadCpi } from "./data/cpi.ts";
import type { EventRecord } from "./data/types.ts";
import { latestBefore, latestJson, latestSnapshot } from "./forecast/snapshot.ts";
import { publishedScores } from "./forecast/scoring.ts";
import type { McuSnapshot } from "./forecast/mcu.ts";
import { AsistenciaPage } from "./pages/AsistenciaPage.tsx";
import { Home } from "./pages/Home.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { TaquillaPage } from "./pages/TaquillaPage.tsx";
import { TemporadaPage } from "./pages/TemporadaPage.tsx";
import { SITE_DESCRIPTION, SITE_TITLE } from "./site.ts";

function html(meta: Meta, stylesheet: string, view: () => JSX.Element): string {
  return `<!doctype html>${renderToString(() => (
    <Document meta={meta} stylesheet={stylesheet}>
      {view()}
    </Document>
  ))}`;
}

function mcuForecast(): McuSnapshot | null {
  const snap = latestJson<McuSnapshot>("mcu");
  return snap ? latestBefore<McuSnapshot>("mcu", snap.target.release) : null;
}

function eventMeta(event: EventRecord): Meta {
  const path = `/eventos/${event.slug}`;
  const title = `${event.title} | Datos abiertos`;
  if (event.kind === "temporada") {
    const figures = keyFigures(event);
    return {
      path,
      title,
      description: `${event.summary} ${figures.held} de ${figures.total} partidos jugados. Goles por partido: ${formatDecimal(figures.goalsPerMatch)}.`,
      kind: "article",
      index: true,
    };
  }
  if (event.kind === "taquilla") {
    const figures = taquillaFigures(event, loadCpi());
    return {
      path,
      title,
      description: `${event.summary} ${figures.released} de ${figures.total} películas estrenadas.`,
      kind: "article",
      index: true,
    };
  }
  const held = heldActs(event);
  const total = sumRange(held).central;
  return {
    path,
    title,
    description: `${event.summary} ${held.length} de ${event.acts.length} actos realizados. Asistencia total: ${formatNumber(total)}.`,
    kind: "article",
    index: true,
  };
}

export function renderSite(events: EventRecord[], stylesheet: string): Record<string, string> {
  const files: Record<string, string> = {
    "index.html": html(
      { path: "/", title: SITE_TITLE, description: SITE_DESCRIPTION, kind: "website", index: true },
      stylesheet,
      () => <Home events={events} />,
    ),
    "404.html": html(
      {
        path: "/404",
        title: "Página no encontrada | Datos abiertos",
        description: "La dirección no existe o cambió.",
        kind: "website",
        index: false,
      },
      stylesheet,
      () => <NotFound />,
    ),
  };
  for (const event of events) {
    const scores = event.kind === "temporada" ? publishedScores(event) : undefined;
    files[`eventos/${event.slug}.html`] = html(eventMeta(event), stylesheet, () =>
      event.kind === "temporada" ? (
        <TemporadaPage event={event} forecast={latestSnapshot(event.slug)} scores={scores} />
      ) : event.kind === "taquilla" ? (
        <TaquillaPage event={event} forecast={mcuForecast()} />
      ) : (
        <AsistenciaPage event={event} />
      ),
    );
    files[`eventos/${event.slug}.json`] = toJson(event, scores);
    files[`eventos/${event.slug}.csv`] = toCsv(event);
  }
  return files;
}

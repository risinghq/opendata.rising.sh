import { renderToString, type JSX } from "@solidjs/web";

import { Document, type Meta } from "./components/Document.tsx";
import { toCsv, toJson } from "./downloads.ts";
import { formatNumber } from "./data/format.ts";
import { heldActs, sumRange } from "./data/stats.ts";
import type { EventRecord } from "./data/types.ts";
import { EventPage } from "./pages/EventPage.tsx";
import { Home } from "./pages/Home.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { SITE_DESCRIPTION, SITE_TITLE } from "./site.ts";

function html(meta: Meta, stylesheet: string, view: () => JSX.Element): string {
  return `<!doctype html>${renderToString(() => (
    <Document meta={meta} stylesheet={stylesheet}>
      {view()}
    </Document>
  ))}`;
}

function eventMeta(event: EventRecord): Meta {
  const held = heldActs(event);
  const total = sumRange(held).central;
  return {
    path: `/eventos/${event.slug}`,
    title: `${event.title} | Datos abiertos`,
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
    files[`eventos/${event.slug}.html`] = html(eventMeta(event), stylesheet, () => (
      <EventPage event={event} />
    ));
    files[`eventos/${event.slug}.json`] = toJson(event);
    files[`eventos/${event.slug}.csv`] = toCsv(event);
  }
  return files;
}

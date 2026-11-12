# Architecture

The site is static. `bun run build` reads the event files, renders every page
to HTML with Solid's server renderer and writes the result to `dist/`. The
Worker serves `dist/` as assets. No JavaScript reaches the browser.

```
data/events/<slug>.json
  -> src/data/load.ts      read and validate (src/data/validate.ts)
  -> src/render.tsx        one HTML string per route, plus JSON and CSV
  -> scripts/build.ts      write dist/
```

## Data

`src/data/types.ts` holds the types. An event is a union keyed by `kind`:
`AsistenciaData` (acts and comparison rows) and `TemporadaData` (tournaments,
teams, stadiums and matches). Both extend the shared fields: title, summary,
dates, places, `updated` and `method`. The schema is described in
[data.md](data.md).

`src/data/load.ts` reads every `data/events/*.json`, takes the slug from the
file name, validates it and sorts events by start date, newest first.

Each kind has its own statistics, in `src/data/stats-asistencia.ts` and
`src/data/stats-temporada.ts`. Pages never add figures themselves.
`src/data/stats.ts` holds what the home list needs from both kinds: the status
and the summary columns. `src/data/format.ts` formats numbers, dates and times
in `es-PE`. `src/data/notice.ts` writes the source and licence notice of a
tournament.

## Validation

`src/data/validate.ts` reads `kind` and runs the validator of that kind:
`src/data/validate-asistencia.ts` or `src/data/validate-temporada.ts`.
`src/data/validate-common.ts` holds the shared field checks. A validator returns
a list of errors, each with the path of the field. `assertEvent` throws when
the list is not empty, so the build stops on bad data. `test/validate.test.ts`
runs it over every event file.

## Pages

`src/pages/Home.tsx` is the table of events. `src/pages/AsistenciaPage.tsx` and
`src/pages/TemporadaPage.tsx` are the event pages of each kind, with their
sections in order. `src/pages/NotFound.tsx` is the 404 page.
`src/components/Document.tsx` is the HTML document: title, description,
canonical link, Open Graph tags, header and footer.

The components of `asistencia` are `src/components/ActsTable.tsx`, the table of
acts with sources as links in each row, and the charts below. The components of
`temporada` are `src/components/StandingsTable.tsx`,
`src/components/RoundsList.tsx` (one table per round) and
`src/components/AltitudeChart.tsx`.

## Charts

`src/components/ActsChart.tsx` draws the bars of the acts held, with a line from
the low to the high figure. `src/components/DailyChart.tsx` draws the
accumulated attendance by day and the table behind it.
`src/components/AltitudeChart.tsx` draws one point per stadium, home points per
match against altitude, with a least-squares line and the table behind it.
`src/components/chart-scale.ts` picks the axis maximum and ticks. The charts
are SVG written by hand. Each has a caption that links to its table.

## Importer

`scripts/import-liga1.ts` is the only code that uses the network. It fetches
the wikitext and revision of the Apertura and Clausura pages through the
MediaWiki API, resolves each stadium link to its article, and rewrites the
matches, teams and tournaments of `data/events/liga-1-2026.json`.
`scripts/liga1-wikitext.ts` parses the results tables: rowspans and colspans,
bold winners, linked scores and stadiums. `test/fixtures/` holds saved
wikitext for its tests.

## Styles

`src/tokens.css` holds the custom properties: colours, type sizes, spacing and
the dark theme. `src/site.css` holds the rules and loads the fonts from the
`@fontsource-variable` packages. Vite builds `src/site.css` into a hashed file.

## Build-time HTML and downloads

`src/render.tsx` turns events into a map from file path to content: `index.html`,
`404.html`, and `eventos/<slug>.html`, `.json` and `.csv` for each event. It
picks the page by `kind`. `src/downloads.ts` picks the JSON and the CSV writer
by `kind`: `src/downloads-asistencia.ts` or `src/downloads-temporada.ts`.

`scripts/build.ts` builds the stylesheet with Vite, loads `src/render.tsx`
through Vite's server so the JSX compiles for the server, and writes the map.
`scripts/dev.ts` serves the same map on request.

`wrangler.jsonc` sends unknown paths to `404.html` with status 404, and serves
`eventos/<slug>.html` at `/eventos/<slug>`.

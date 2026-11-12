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
`AsistenciaData` (acts and comparison rows), `TemporadaData` (tournaments,
teams, stadiums and matches) and `TaquillaData` (the source and the films of a
box office series). Each extends the shared fields: title, summary, dates,
places, `updated` and `method`. The schema is described in
[data.md](data.md).

`src/data/load.ts` reads every `data/events/*.json`, takes the slug from the
file name, validates it and sorts events by start date, newest first.

Each kind has its own statistics, in `src/data/stats-asistencia.ts`,
`src/data/stats-temporada.ts` and `src/data/stats-taquilla.ts`. Pages never
add figures themselves. `src/data/stats.ts` holds what the home list needs
from every kind: the status and the summary columns. `src/data/format.ts`
formats numbers, dates and times in `es-PE`. `src/data/notice.ts` writes the
source and licence notice of each event. `src/data/cpi.ts` loads the CPI
series stored under `data/cpi/` and converts nominal dollars to the base
year's dollars.

## Validation

`src/data/validate.ts` reads `kind` and runs the validator of that kind:
`src/data/validate-asistencia.ts`, `src/data/validate-temporada.ts` or
`src/data/validate-taquilla.ts`.
`src/data/validate-common.ts` holds the shared field checks. A validator returns
a list of errors, each with the path of the field. `assertEvent` throws when
the list is not empty, so the build stops on bad data. `test/validate.test.ts`
runs it over every event file.

## Pages

`src/pages/Home.tsx` is the table of events. `src/pages/AsistenciaPage.tsx`,
`src/pages/TemporadaPage.tsx` and `src/pages/TaquillaPage.tsx` are the event
pages of each kind, with their sections in order. `src/pages/NotFound.tsx` is
the 404 page.
`src/components/Document.tsx` is the HTML document: title, description,
canonical link, Open Graph tags, header and footer.

The components of `asistencia` are `src/components/ActsTable.tsx`, the table of
acts with sources as links in each row, and the charts below. The components of
`temporada` are `src/components/StandingsTable.tsx`,
`src/components/RoundsList.tsx` (one table per round) and
`src/components/AltitudeChart.tsx`. The components of `taquilla` are
`src/components/FilmsTable.tsx` (each figure nominal and real, sources as
links) and `src/components/GrossChart.tsx`.

## Charts

`src/components/ActsChart.tsx` draws the bars of the acts held, with a line from
the low to the high figure. `src/components/DailyChart.tsx` draws the
accumulated attendance by day and the table behind it.
`src/components/AltitudeChart.tsx` draws one point per stadium, home points per
match against altitude, with a least-squares line and the table behind it.
`src/components/chart-scale.ts` picks the axis maximum and ticks. The charts
are SVG written by hand. Each has a caption that links to its table.
`src/components/GrossChart.tsx` draws one bar per release, worldwide gross in
real terms, with Avengers films marked.

## Importer

`scripts/import-liga1.ts` fetches the wikitext and revision of the Apertura
and Clausura pages through the MediaWiki API, resolves each stadium link to
its article, and rewrites the matches, teams and tournaments of
`data/events/liga-1-2026.json`, keeping `events` already on a match.
`scripts/liga1-wikitext.ts` parses the results tables: rowspans and colspans,
bold winners, linked scores and stadiums. `test/fixtures/` holds saved
wikitext for its tests.

`bun run refresh:liga1` runs `scripts/liga1/refresh.ts`, which chains the
import, the API fetch, the join and the forecast. `scripts/liga1/api.ts` is
the other network client: it reads the key from `FOOTBALL_API_KEY` or
`~/.config/5dollarfootballapi/key`, paces requests under the per-minute
ceiling, follows a `league_moved` redirect and stops on 429.
`scripts/liga1/parse.ts` maps a fixture to the `events` schema,
`scripts/liga1/aliases.ts` maps API team names to team ids, and
`scripts/liga1/join.ts` matches fixtures to matches by Lima date and both
teams; it fails on any unjoined match. Raw responses stay under
`.cache/liga1/`, which is gitignored. `scripts/liga1/forecast.ts` fits the
model, simulates the remaining matches, backtests against past Clausura
rounds and the Bet365 closing odds cached at fetch time, and writes a dated
snapshot under `data/forecasts/`. The season page reads the latest snapshot.

`bun run refresh:mcu` runs `scripts/mcu/refresh.ts`, which chains the import
and the forecast. `scripts/import-mcu.ts` fetches the wikitext of the six MCU
phase pages through the MediaWiki API, the wikitext of each film's article for
the opening weekend, each article's `es` langlink for the Spanish title and
the CPI annual averages from the BLS, then rewrites
`data/events/mcu-taquilla.json`. `scripts/mcu-wikitext.ts` parses the box
office table, the films list and the opening-weekend sentence.
`scripts/mediawiki.ts` and `scripts/wikitext.ts` hold the API calls and
wikitext helpers both importers share. `scripts/mcu/forecast.ts` fits the
model, backtests it against the naive baseline and writes a dated snapshot
under `data/forecasts/mcu/`. The box office page reads the latest snapshot.

The model lives in `src/forecast/`: `model.ts` fits the Poisson parameters,
`simulate.ts` plays the remaining matches, `rules.ts` applies the league's
points, tiebreaks, playoff and relegation rules, `backtest.ts` scores past
rounds against the base rates and the closing odds, and `snapshot.ts` writes
and reads the immutable dated snapshots.

## Styles

`src/tokens.css` holds the custom properties: colours, type sizes, spacing and
the dark theme. `src/site.css` holds the rules and loads the fonts from the
`@fontsource-variable` packages. Vite builds `src/site.css` into a hashed file.

## Build-time HTML and downloads

`src/render.tsx` turns events into a map from file path to content: `index.html`,
`404.html`, and `eventos/<slug>.html`, `.json` and `.csv` for each event. It
picks the page by `kind`. `src/downloads.ts` picks the JSON and the CSV writer
by `kind`: `src/downloads-asistencia.ts`, `src/downloads-temporada.ts` or
`src/downloads-taquilla.ts`.

`scripts/build.ts` builds the stylesheet with Vite, loads `src/render.tsx`
through Vite's server so the JSX compiles for the server, and writes the map.
`scripts/dev.ts` serves the same map on request.

`wrangler.jsonc` sends unknown paths to `404.html` with status 404, and serves
`eventos/<slug>.html` at `/eventos/<slug>`.

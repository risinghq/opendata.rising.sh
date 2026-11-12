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

`src/data/types.ts` holds the types of an event, an act, a source and a
comparison row. The schema is described in [data.md](data.md).

`src/data/load.ts` reads every `data/events/*.json`, takes the slug from the
file name, validates it and sorts events by start date, newest first.

`src/data/stats.ts` derives numbers from an event: held and planned acts, the
sum of low, central and high figures, the largest act, the status and the
accumulated total per day. Pages never add figures themselves.

`src/data/format.ts` formats numbers, dates and times in `es-PE`.

## Validation

`src/data/validate.ts` checks an event and returns a list of errors, each with
the path of the field. `assertEvent` throws when the list is not empty, so the
build stops on bad data. `test/validate.test.ts` runs it over every event file.

## Pages

`src/pages/Home.tsx` is the table of events. `src/pages/EventPage.tsx` is the
event page, with its sections in order. `src/pages/NotFound.tsx` is the 404
page. `src/components/ActsTable.tsx` is the table of acts, with sources as links
in each row. `src/components/Document.tsx` is the HTML document: title,
description, canonical link, Open Graph tags, header and footer.

## Charts

`src/components/ActsChart.tsx` draws the bars of the acts held, with a line from
the low to the high figure. `src/components/DailyChart.tsx` draws the
accumulated attendance by day and the table behind it.
`src/components/chart-scale.ts` picks the axis maximum and ticks. The charts
are SVG written by hand. Each has a caption that links to its table.

## Styles

`src/tokens.css` holds the custom properties: colours, type sizes, spacing and
the dark theme. `src/site.css` holds the rules and loads the fonts from the
`@fontsource-variable` packages. Vite builds `src/site.css` into a hashed file.

## Build-time HTML and downloads

`src/render.tsx` turns events into a map from file path to content: `index.html`,
`404.html`, and `eventos/<slug>.html`, `.json` and `.csv` for each event.
`src/downloads.ts` writes the JSON and the CSV from the event record.

`scripts/build.ts` builds the stylesheet with Vite, loads `src/render.tsx`
through Vite's server so the JSX compiles for the server, and writes the map.
`scripts/dev.ts` serves the same map on request.

`wrangler.jsonc` sends unknown paths to `404.html` with status 404, and serves
`eventos/<slug>.html` at `/eventos/<slug>`.

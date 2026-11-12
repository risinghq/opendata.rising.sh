# Event data

Each event is one file, `data/events/<slug>.json`. The slug is lowercase words
joined by hyphens. It becomes the address `/eventos/<slug>` and the names of
the downloads `/eventos/<slug>.json` and `/eventos/<slug>.csv`.

`bun run test` validates every file. The build fails on an invalid file.

All text is Spanish (Peru), without em dashes. Write numbers as plain integers.

## Kinds

Every file has a required `kind`. Each kind has its own fields, validator, page,
statistics and downloads.

| `kind`       | What it holds                                   | Example                     |
| ------------ | ----------------------------------------------- | --------------------------- |
| `asistencia` | Dated acts, each with an attendance figure.     | `visita-leon-xiv-2026.json` |
| `temporada`  | A season of matches in one or more tournaments. | `liga-1-2026.json`          |

## Shared fields

| Field     | Type            | Meaning                                             |
| --------- | --------------- | --------------------------------------------------- |
| `kind`    | string          | `asistencia` or `temporada`.                        |
| `title`   | string          | Name of the event.                                  |
| `summary` | string          | One or two sentences. It is the page description.   |
| `start`   | `YYYY-MM-DD`    | First day.                                          |
| `end`     | `YYYY-MM-DD`    | Last day. Not before `start`.                       |
| `places`  | list of strings | Countries or cities.                                |
| `updated` | timestamp       | Last edit of the figures, with the Lima offset.     |
| `method`  | string          | How the figures were chosen, in prose. Shown as is. |

`updated` looks like `2026-11-12T12:00-05:00`. The page shows it in Lima time.

A source is `{ "outlet": "Nombre del medio", "url": "https://example.org/nota" }`.
`url` must start with `https://`. Open the URL before you add it. It must carry
what you cite.

The status of the event is derived. It is `en curso` while any act or match is
planned and `finalizado` when all are held.

## Asistencia

Extra fields of the event:

| Field        | Type           | Meaning                                 |
| ------------ | -------------- | --------------------------------------- |
| `acts`       | list of acts   | At least one.                           |
| `comparison` | list, optional | Other events with their figures. Below. |

### Act

| Field     | Type      | Meaning                                                                                            |
| --------- | --------- | -------------------------------------------------------------------------------------------------- |
| `start`   | timestamp | Local start time with the offset of the place. It must fall between the event's `start` and `end`. |
| `country` | string    | Country.                                                                                           |
| `city`    | string    | City.                                                                                              |
| `venue`   | string    | Venue.                                                                                             |
| `name`    | string    | What happens, such as `Misa`.                                                                      |
| `status`  | string    | `held` or `planned`.                                                                               |

The `start` offset is the local one, such as `-03:00` in Buenos Aires and
`-05:00` in Lima. The table shows the local time and, when the offset is not
Lima's, the Lima time too.

A held act adds these fields. All are required.

| Field         | Type            | Meaning                                       |
| ------------- | --------------- | --------------------------------------------- |
| `low`         | integer         | Lowest figure.                                |
| `central`     | integer         | Central figure.                               |
| `high`        | integer         | Highest figure.                               |
| `attribution` | string          | A sentence saying who gave each figure.       |
| `sources`     | list of sources | At least one report that carries the figures. |

`low <= central <= high` must hold. When only one figure exists, the three are
equal.

A planned act has no `low`, `central`, `high`, `attribution` or `sources`. It
may have an expected figure.

```json
"expected": {
  "figure": 1000000,
  "attribution": "Quién la espera y cómo la calculó.",
  "source": { "outlet": "Nombre del medio", "url": "https://example.org/nota" }
}
```

An expected figure never enters a total or a chart. When the act happens, set
`status` to `held`, remove `expected`, add the held fields and update
`updated`.

Put the agency in the outlet name when the outlet republishes it, as in
`Swissinfo (EFE)`.

### Comparison

Each row compares another event.

| Field         | Type    | Meaning                                |
| ------------- | ------- | -------------------------------------- |
| `label`       | string  | The act compared, with place and year. |
| `figure`      | integer | Attendance.                            |
| `attribution` | string  | Who gave the figure.                   |
| `source`      | source  | The report.                            |

The page sorts the rows by figure, largest first.

### Method

Write the method in `method`, in prose, for the reader of the page. A new event
of this kind follows the method of the first one.

- Central is the Vatican Press Office figure, which cites local authorities or
  organisers, when one exists. Otherwise it is the local authority's official
  figure.
- Low and high are the lowest and highest figures that a different official
  source attributes to the same act. When no other official source gives a
  different figure, the three are equal.
- A press figure with no official source stays out of the range.
- A total sums the central, low and high figures of the acts held. It counts
  attendances, not distinct people.
- An expected figure of a planned act stays out of every total.

An event that follows another method says so in `method`.

### Downloads

- `/eventos/<slug>.json` holds the event with its `slug`.
- `/eventos/<slug>.csv` holds one row per act, with the columns `inicio`,
  `pais`, `ciudad`, `lugar`, `acto`, `estado`, `baja`, `central`, `alta`,
  `esperado`, `atribucion` and `fuentes`. Sources are joined as
  `outlet: url | outlet: url`.

## Temporada

Extra fields of the event:

| Field         | Type                | Meaning                     |
| ------------- | ------------------- | --------------------------- |
| `tournaments` | list of tournaments | At least one.               |
| `teams`       | list of teams       | Every team that plays.      |
| `stadiums`    | list of stadiums    | Every stadium a match uses. |
| `matches`     | list of matches     | At least one.               |

Every `id` is lowercase words joined by hyphens and is unique in its list.

### Tournament

| Field    | Type   | Meaning                                 |
| -------- | ------ | --------------------------------------- |
| `id`     | string | Referenced by `matches[].tournament`.   |
| `name`   | string | Name shown on the page.                 |
| `source` | object | Where the matches come from. See below. |

The tournament source has `outlet`, `url`, `revision`, `revisionDate` and
`license`. `url` is the permanent link of the revision and ends in
`?oldid=<revision>`. `revisionDate` is the day of that revision.

### Team and stadium

A team has `id` and `name`. A stadium has these fields:

| Field      | Type    | Meaning                            |
| ---------- | ------- | ---------------------------------- |
| `id`       | string  | Referenced by `matches[].stadium`. |
| `name`     | string  | Name of the stadium.               |
| `city`     | string  | City.                              |
| `altitude` | integer | Metres above sea level, 0 to 9000. |
| `source`   | source  | Where the altitude comes from.     |

Take the altitude from the stadium's Wikipedia article when it states one. Else
take it from a citable elevation source for the stadium's coordinates, and name
that source in `source.outlet`.

### Match

| Field        | Type      | Meaning                                                 |
| ------------ | --------- | ------------------------------------------------------- |
| `tournament` | string    | Id of a tournament.                                     |
| `round`      | integer   | Round (`fecha`), from 1.                                |
| `start`      | timestamp | Local start time with offset. Inside `start` and `end`. |
| `home`       | string    | Id of a team.                                           |
| `away`       | string    | Id of another team.                                     |
| `stadium`    | string    | Id of a stadium.                                        |
| `referee`    | string    | Optional. Absent until the referee is named.            |
| `status`     | string    | `held` or `planned`.                                    |

A held match adds `homeScore` and `awayScore`, non-negative integers. A planned
match has neither. A postponed or suspended match with no result is planned. A
team plays at most once per round of a tournament.

A held match can also carry `events`, the record of what happened in it. It
comes from 5DollarFootballAPI, joined onto the Wikipedia match by Lima date
and both teams. Only the fields below are kept; the raw feed is never stored.

| Field      | Value                                                                |
| ---------- | -------------------------------------------------------------------- |
| `halfTime` | `{home, away}` half-time score, non-negative integers.               |
| `goals`    | list of `{minute, team}`. `team` is the side credited with the goal. |
| `cards`    | list of `{minute, team, colour}`. `colour` is `yellow` or `red`.     |
| `corners`  | `{home, away}` corner counts.                                        |

`team` is `home` or `away`. `minute` counts from kickoff; stoppage time keeps
its own count past 45 or 90.

### Method

The standings come from the held matches only: 3 points for a win, 1 for a
draw. They order by points, goal difference and goals for. The page says that
the official table can differ because of administrative sanctions. Home
advantage by altitude uses stadiums with at least 5 held matches.

### Forecast snapshots

`data/forecasts/liga-1-2026/YYYY-MM-DD.json` is a dated snapshot of the
forecast. A refresh writes a new one; a snapshot is never rewritten. It holds
the date, the number of matches used, the fitted parameters, the seed and the
simulation count, each remaining match with home, draw and away probabilities
and expected goals, each team's probability of winning the Clausura, winning
the season and being relegated, and the backtest scores.

The model is a Poisson goals model fit by maximum likelihood in
`src/forecast/model.ts`: per team an attack and a defence strength, a home
effect that grows with the altitude difference between the match stadium and
the visitor's home stadium, time decay on older matches and a ridge prior. A
seeded simulator in `src/forecast/simulate.ts` plays the remaining matches
20,000 times and applies the competition rules: points and tiebreaks (goal
difference, goals for, fair play points from cards, head-to-head in the
accumulated table), the playoff that decides the champion when no team wins
both tournaments, and the relegation of the 17th and 18th of the accumulated
table. The rules come from the "Sistema" section of
[Liga1 2026 (Perú)](<https://es.wikipedia.org/wiki/Liga1_2026_(Per%C3%BA)>) on
Spanish Wikipedia. Playoff matches are simulated as single neutral-site games;
a draw is decided by coin flip.

`src/forecast/scoring.ts` scores every published snapshot at build time. For
each snapshot it takes the matches it gave probabilities for that are held in
the event, matched by tournament and both teams, and scores them by log loss
and Brier score with the same functions the backtest uses. The baseline is the
home, draw and away frequencies of that snapshot's `matchesUsed`. A postponed
match counts in every snapshot that forecast it. The page shows one row per
snapshot under "Pronósticos publicados".

### Source and licence

The matches come from Spanish Wikipedia, under CC BY-SA 4.0. The JSON and each
CSV row state it as `Datos de Wikipedia en español (CC BY-SA 4.0):
<tournament>, revisión del <día> de <mes> de <año>; …`. When a match carries
`events`, the notice adds `Datos de partidos: Football data by
5DollarFootballAPI (5dollarfootballapi.com).`, the attribution the Community
Access plan requires.

### Importer

`bun scripts/import-liga1.ts` rewrites `tournaments`, `teams`, `matches`,
`start`, `end` and `updated` from the live pages. It keeps the other fields,
including `stadiums`. It stops and lists any stadium missing from `stadiums`.

### Downloads

- `/eventos/<slug>.json` holds the event with its `slug`, an `aviso` with the
  notice of each tournament and `forecastScores`, one entry per published
  snapshot with `date`, `matches`, `model` and `baseRates` as the
  "Pronósticos publicados" section shows them.
- `/eventos/<slug>.csv` holds one row per match, with the columns `torneo`,
  `fecha`, `inicio`, `local`, `visitante`, `estadio`, `ciudad`, `altitud_m`,
  `arbitro`, `estado`, `goles_local`, `goles_visitante`, `fuente` and `aviso`.

## Taquilla

`taquilla` is the box office of a film series. `mcu-taquilla` is the Marvel
Cinematic Universe.

### Film

Each entry in `films` holds `title` (the Spanish title from Wikipedia en
español, else the original), `originalTitle`, `phase`, `release` (the U.S.
date, `YYYY-MM-DD`) and `status`. A released film adds `budget` (optional;
`low` and `high` when the source gives a range), `opening` (opening weekend
gross in the United States and Canada), `usCanada` and `worldwide`, each a
figure of `amount` in integer nominal U.S. dollars and its `source`. An
unreleased film has none of those.

`note` is optional: a caveat in Spanish, shown under the title, for a figure
that needs one. `Avengers: Endgame` carries one because its worldwide gross
includes the September 2026 re-release.

### Source and licence

The figures come from the box office table of "List of Marvel Cinematic
Universe films" on English Wikipedia, under CC BY-SA 4.0. The page and the
downloads state it as `Datos de Wikipedia en inglés (CC BY-SA 4.0), revisión
del <día> de <mes> de <año>`. `source` holds the revision id and its
permanent `?oldid=` link; each figure links the phase-page revision it came
from, and each opening-weekend figure links the film-article revision.

### Real terms

`data/cpi/cuur0000sa0.json` holds the annual averages of the U.S. consumer
price index (BLS series CUUR0000SA0) with their source, and `base`, the year
of the dollar the page uses. Every figure shown in real terms converts with
`amount × CPI(base) ÷ CPI(release year)`.

### Forecast snapshots

`data/forecasts/mcu/YYYY-MM-DD.json` is a dated snapshot of the Avengers:
Doomsday forecast, made before the release and never rewritten. It holds the
date, the dollar base year, the films used, the model form and coefficients,
the point and interval per figure (opening weekend and worldwide) and the
backtest.

The model in `src/forecast/mcu.ts` is a ridge-regularized least-squares fit
on the log of each figure in real dollars: the previous release's figure, the
previous figure in the same line (the previous Avengers film for Doomsday)
and the years since the first release. The interval comes from the
leave-one-out errors. The backtest predicts each Avengers film and each of
the last ten releases using only the films before it, and reports the median
absolute percentage error against the naive baseline of the previous film's
figure.

### Importer

`bun scripts/import-mcu.ts` rewrites `films`, `start`, `end`, `updated` and
`source` from the live pages and refreshes `data/cpi/cuur0000sa0.json` from
the BLS API. It keeps the other fields. The box office table is transcluded
from the six phase pages; the opening weekend comes from each film's
article; the Spanish titles come from each article's `es` langlink.

A row can carry two sets of figures in `<noinclude>` and `<includeonly>`
cells. The importer reads the `<includeonly>` ones, the cells the List page
transcludes, so the figures match what the source link shows. `Avengers:
Endgame` is the case: its `<includeonly>` row adds the September 2026
_Avengers Endgame: Encore_ re-release to the 2019 gross. An `{{efn}}` note
on the film's title cell is kept as `note`, written in Spanish; an efn the
importer cannot turn into a note stops the run.

### Downloads

- `/eventos/<slug>.json` holds the event with its `slug` and an `aviso` with
  the notice.
- `/eventos/<slug>.csv` holds one row per film, with the columns `pelicula`,
  `titulo_original`, `fase`, `estreno`, `estado`, `presupuesto_min_usd`,
  `presupuesto_max_usd`, `estreno_fin_de_semana_usd`, `eeuu_y_canada_usd`,
  `mundial_usd`, `fuentes` and `aviso`.

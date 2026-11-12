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

### Method

The standings come from the held matches only: 3 points for a win, 1 for a
draw. They order by points, goal difference and goals for. The page says that
the official table can differ because of administrative sanctions. Home
advantage by altitude uses stadiums with at least 5 held matches.

### Source and licence

The matches come from Spanish Wikipedia, under CC BY-SA 4.0. The page, the JSON
and each CSV row state it as `Datos de Wikipedia en español (CC BY-SA 4.0),
revisión del <día> de <mes> de <año>`.

### Importer

`bun scripts/import-liga1.ts` rewrites `tournaments`, `teams`, `matches`,
`start`, `end` and `updated` from the live pages. It keeps the other fields,
including `stadiums`. It stops and lists any stadium missing from `stadiums`.

### Downloads

- `/eventos/<slug>.json` holds the event with its `slug` and an `aviso` with the
  notice of each tournament.
- `/eventos/<slug>.csv` holds one row per match, with the columns `torneo`,
  `fecha`, `inicio`, `local`, `visitante`, `estadio`, `ciudad`, `altitud_m`,
  `arbitro`, `estado`, `goles_local`, `goles_visitante`, `fuente` and `aviso`.

# Event data

Each event is one file, `data/events/<slug>.json`. The slug is lowercase words
joined by hyphens. It becomes the address `/eventos/<slug>` and the names of
the downloads `/eventos/<slug>.json` and `/eventos/<slug>.csv`.

`bun run test` validates every file. The build fails on an invalid file.

All text is Spanish (Peru), without em dashes. Write numbers as plain integers.

## Event

| Field        | Type            | Meaning                                             |
| ------------ | --------------- | --------------------------------------------------- |
| `title`      | string          | Name of the event.                                  |
| `summary`    | string          | One or two sentences. It is the page description.   |
| `start`      | `YYYY-MM-DD`    | First day.                                          |
| `end`        | `YYYY-MM-DD`    | Last day. Not before `start`.                       |
| `places`     | list of strings | Countries or cities, in visit order.                |
| `updated`    | timestamp       | Last edit of the figures, with the Lima offset.     |
| `method`     | string          | How the figures were chosen, in prose. Shown as is. |
| `acts`       | list of acts    | At least one.                                       |
| `comparison` | list, optional  | Other events with their figures. See below.         |

`updated` looks like `2026-11-12T12:00-05:00`. The page shows it in Lima time.

The status of the event is derived. It is `en curso` while any act is planned
and `finalizado` when all acts are held.

## Act

Every act has these fields.

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

### Held act

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

### Planned act

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

## Source

```json
{ "outlet": "Nombre del medio", "url": "https://example.org/nota" }
```

`url` must start with `https://`. Put the agency in the outlet name when the
outlet republishes it, as in `Swissinfo (EFE)`. Open the URL before you add it.
It must report the figure and the attribution you wrote.

## Comparison

Each row compares another event.

| Field         | Type    | Meaning                                |
| ------------- | ------- | -------------------------------------- |
| `label`       | string  | The act compared, with place and year. |
| `figure`      | integer | Attendance.                            |
| `attribution` | string  | Who gave the figure.                   |
| `source`      | source  | The report.                            |

The page sorts the rows by figure, largest first.

## Method

Write the method in `method`, in prose, for the reader of the page. This is the
method of the first event, and a new event of the same kind follows it.

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

## Downloads

The build writes both files from the event file.

- `/eventos/<slug>.json` holds the event with its `slug`.
- `/eventos/<slug>.csv` holds one row per act, with the columns `inicio`,
  `pais`, `ciudad`, `lugar`, `acto`, `estado`, `baja`, `central`, `alta`,
  `esperado`, `atribucion` and `fuentes`. Sources are joined as
  `outlet: url | outlet: url`.

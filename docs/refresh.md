# Refresh

## Liga 1 season

```sh
bun run refresh:liga1
bun run test
```

The command rewrites `data/events/liga-1-2026.json` from the Apertura and
Clausura pages of Spanish Wikipedia and the match events and odds of
5DollarFootballAPI, then writes a dated forecast snapshot under
`data/forecasts/liga-1-2026/`. It reads the API key from `FOOTBALL_API_KEY` or
`~/.config/5dollarfootballapi/key`. Raw API responses stay in `.cache/liga1/`,
which is gitignored. Every fetch is also kept in the
[raw archive](raw-archive.md), and `OPENDATA_REPLAY=1` replays it offline.

## MCU box office

```sh
bun run refresh:mcu
bun run test
```

The command rewrites `data/events/mcu-taquilla.json` from English Wikipedia
and the U.S. CPI annual averages of the BLS, then writes a dated forecast
snapshot under `data/forecasts/mcu/`. It needs no key.

A snapshot is never rewritten. A second run on the same date updates the event
file and leaves that date's snapshot unchanged.

[Architecture](architecture.md#importer) describes each importer's steps.
[Event data](data.md) names each source and its licence.

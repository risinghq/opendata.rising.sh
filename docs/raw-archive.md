# Raw archive

Every fetch the importers and `bun run refresh:liga1` make goes through
`scripts/raw.ts`, which keeps a copy of each response outside the repository.
A parser fix or a new field can then be developed against what the source
said, without a new API run. The API terms forbid publishing the raw feed,
not keeping it, so nothing under the archive is committed.

## Layout

The archive lives at `$XDG_DATA_HOME/opendata/raw/`, or
`~/.local/share/opendata/raw/` when `XDG_DATA_HOME` is unset.

- Each response body is one file named by the SHA-256 of the body. A body
  already stored is not written twice.
- `index.jsonl` holds one JSON line per fetch:
  `{"url": "…", "fetchedAt": "…", "status": 200, "sha256": "…"}`. `fetchedAt`
  is the fetch time and `sha256` the body file. In `url`, each secret the
  caller passed is replaced by `***`; request headers are never recorded, so
  the index never holds the API key.

## Replay

`OPENDATA_REPLAY=1` makes the same calls read the archive instead of the
network:

```sh
OPENDATA_REPLAY=1 bun run refresh:liga1
OPENDATA_REPLAY=1 bun scripts/import-liga1.ts
OPENDATA_REPLAY=1 bun scripts/import-mcu.ts
```

The archive keys a response on its URL alone, so every archived request is a
GET whose URL holds all its parameters. The CPI fetch uses the BLS
single-series GET for that reason. For each URL, the newest index entry whose status is 2xx or 3xx gives the
response; a stored redirect is an answer the caller still follows, as the
Liga 1 client does with `league_moved`. A URL with no stored 2xx or 3xx body
fails with `OPENDATA_REPLAY=1: no stored response for <url>`. No request
leaves the machine, no response waits on the API pace limit and the Liga 1
API key is not needed.

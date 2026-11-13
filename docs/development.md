# Development

```sh
bun install
bun run dev      # dev server that renders each page on request
bun run test     # validates every event file and checks the build
bun run check    # lint, format, dead code and types
bun run fix      # format
bun run build    # write the site to dist/
bun run preview  # serve dist/ in the Worker, after bun run build
```

[mise](https://mise.jdx.dev) pins Bun and Node in `mise.toml`.

`bun run check` runs oxlint, oxfmt, [fallow](https://github.com/fallow-rs/fallow)
and tsc. fallow fails on an unused file, export, type or dependency;
`.fallowrc.json` names the scripts it treats as entry points and the
dependencies and files it ignores.

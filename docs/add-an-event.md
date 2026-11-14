# Add an event

1. Create `data/events/<slug>.json` with a `kind`. The slug becomes the address
   `/analisis/<slug>`.
2. Fill it in as [data.md](data.md) describes.
3. Run `bun run archive:sources`. It fills the `archive` of every source it
   can.
4. Run `bun run test`. The test fails with a path to each invalid field.
5. Run `bun run build`. The page, the JSON and the CSV appear under
   `dist/analisis/`.

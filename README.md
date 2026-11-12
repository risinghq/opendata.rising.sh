# opendata.rising.sh

A catalogue of public events. Each event lists its acts, and each attendance
figure shows who estimated it and links to the report. The site is in Spanish.

## Develop

[mise](https://mise.jdx.dev) pins Bun and Node.

```sh
bun install
bun run dev      # dev server that renders each page on request
bun run test     # validates every event file and checks the build
bun run check    # lint, format and types
bun run fix      # format
bun run build    # write the site to dist/
bun run preview  # serve dist/ in the Worker, after bun run build
```

## Add an event

1. Create `data/events/<slug>.json`. The slug becomes the address
   `/eventos/<slug>`.
2. Fill it in as [docs/data.md](docs/data.md) describes.
3. Run `bun run test`. The test fails with a path to each invalid field.
4. Run `bun run build`. The page, the JSON and the CSV appear under
   `dist/eventos/`.

The code map is in [docs/architecture.md](docs/architecture.md).

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`. It checks, tests and
builds the site, then uploads `dist/` as the static assets of the Cloudflare
Worker `opendata` (`wrangler.jsonc`).

To run your own deployment:

1. In Cloudflare, open My Profile, API Tokens, and create a token from the
   "Edit Cloudflare Workers" template. Copy its value.
2. Copy your account id from the Workers & Pages overview.
3. In the GitHub repository, open Settings, Environments, create the
   environment `production`, and add two secrets: `CLOUDFLARE_API_TOKEN` with
   the token and `CLOUDFLARE_ACCOUNT_ID` with the account id.
4. Set `account_id` and the custom domain `routes` in `wrangler.jsonc` to your
   own.
5. Push to `main`, or run the `deploy` workflow by hand.

To deploy from your machine, run `bun run deploy` with the same two values in
the environment.

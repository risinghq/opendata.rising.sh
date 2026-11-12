# opendata.rising.sh

Figures from public events, such as how many people attended each act, with
every number tied to the sources that report it. The site is in Spanish and
lives at <https://opendata.rising.sh>.

## Develop

[mise](https://mise.jdx.dev) pins Bun and Node.

```sh
bun install
bun run dev      # Vite dev server
bun run check    # lint, format and types
bun run preview  # the built site in the Worker, after bun run build
```

## Deploy

A push to `master` runs `.github/workflows/deploy.yml`. It builds the site with
Vite and uploads `dist/` as the static assets of the Cloudflare Worker
`opendata` (`wrangler.jsonc`). The workflow reads the repository secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

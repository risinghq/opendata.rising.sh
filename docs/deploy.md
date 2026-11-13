# Deploy

A push to `main` runs `.github/workflows/deploy.yml`. It checks, tests and
builds the site, then uploads `dist/` as the static assets of the Cloudflare
Worker `opendata` (`wrangler.jsonc`).

## Your own deployment

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

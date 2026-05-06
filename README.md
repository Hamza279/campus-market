# CampusMarket

CampusMarket is a RedwoodSDK app deployed to Cloudflare Workers.

Live site:

```text
https://campus-market.hamzaalkasasbeh96.workers.dev
```

## Local Development

Install dependencies and start Vite:

```shell
npm install
npm run dev
```

Local secrets live in `.dev.vars`. Do not commit this file.

Required local values:

```text
AUTH_SECRET_KEY=<long random secret>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
APP_URL=http://localhost:5173
```

## Cloudflare Deployment

The Worker is configured in `wrangler.jsonc`:

- Worker name: `campus-market`
- Worker entry: `src/worker.tsx`
- Static assets: `dist/client` through the `ASSETS` binding
- D1 binding: `campusmarket_db`
- Durable Objects: `SYNCED_STATE_SERVER` and `SESSION_DURABLE_OBJECT`
- Non-secret app URL: `APP_URL`

Set production secrets with Wrangler:

```shell
npx wrangler secret put AUTH_SECRET_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Do not put secrets in `wrangler.jsonc`, `README.md`, or committed source files.

## Verification

Run checks before deploying:

```shell
npm run build
npm run check
```

Deploy only after review:

```shell
npm run release
```

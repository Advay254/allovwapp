# AllovWapp

One gateway. Every integration.

AllovWapp, by Allovity, is becoming a WhatsApp developer platform that connects messaging sessions to applications through a REST API and a dashboard. Version 1.0.0 is the foundation only: project structure, database, sign in, workspaces, the design system, a small dashboard, deployment and tests. It does not connect to WhatsApp yet.

## Deploy on Render

Everything below works from a phone. You never run a command.

1. Create a Postgres database (for example on Supabase). Copy its connection string. With a pooler, use session mode on port 5432.
2. On Render, choose New, then Web Service, and pick this GitHub repository.
3. Set Build Command to `npm install && npm run build` (see the lockfile note in `docs/DEPLOYMENT.md`; after a `package-lock.json` is committed, use `npm ci && npm run build`).
4. Set Start Command to `npm start`.
5. Set Health Check Path to `/health`.
6. Open the Environment tab and add the variables from the table below. Start with the five required ones.
7. Deploy. When the logs show the four lines in "Confirm it worked", open your service URL and add `/app/login` to sign in.

Full steps, including recovery and rollback, are in `docs/DEPLOYMENT.md`.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Any `sslmode` in it is ignored. |
| `DATABASE_SSL` | no | `require` (default), `verify` or `off`. |
| `DATABASE_CA_CERT` | no | CA certificate for `DATABASE_SSL=verify`. |
| `DATABASE_POOL_MAX` | no | Default 5. |
| `ENCRYPTION_KEY` | yes | At least 32 characters. Never change it after first use. |
| `ADMIN_USERNAME` | yes | Username of the first owner account. |
| `ADMIN_PASSWORD` | yes | Owner password, at least 12 characters. Changing it and redeploying resets access. |
| `ADMIN_PATH` | no | Private path prefix for sign in and dashboard. Default `/app`. |
| `BASE_URL` | yes | Public URL of the service. |
| `PORT` | no | Default 3000. |
| `ALLOV_ROLE` | no | `all` (default), `api` or `worker`. |
| `AUDIT_RETENTION_DAYS` | no | Default 90. |
| `LOG_LEVEL` | no | `warn` (default), `error`, `info`, `debug`. |

Details and examples: `docs/ENVIRONMENT.md`.

## Confirm it worked

On a healthy start the Render logs contain these lines, in this order:

1. `AllovWapp 1.0.0 listening on port <port>`
2. `Database connected`
3. `Migrations applied: <count>` (or `Migrations up to date` on later starts)
4. `Owner account ready`

Then `https://your-service/health` answers with `status: ok` and `database: ready`.

## Repository layout

```
allovwapp/
  package.json  .node-version  .npmrc  .env.example  .gitignore
  README.md  CHANGELOG.md  eslint.config.js  .prettierrc.json
  docs/         DEPLOYMENT.md  ENVIRONMENT.md  ARCHITECTURE.md  BRAND.md
  migrations/   SQL migrations (and meta/_journal.json)
  server/       Fastify API and worker (config, db, http, lib, auth, workspaces, audit, system, test)
  web/          React dashboard (pages, components, lib, styles, public, test)
  shared/       Types, schemas and constants used by both
```

License: to be decided by the owner

# Deploying AllovWapp on Render

This guide assumes you only have a phone. You use the GitHub app or website and the Render dashboard. You never run a command or SQL.

## Before you start

You need:

- This repository on your GitHub account.
- A Postgres database. Copy its connection string.
- Two secrets you make up yourself: `ENCRYPTION_KEY` (at least 32 characters, 64 random hex characters is best) and `ADMIN_PASSWORD` (at least 12 characters, 16 or more is better).

## Node version

The project needs Node.js 22. It is pinned in `.node-version` and in `package.json`. Render reads `.node-version`, so nothing else is needed. If a build ever shows a different Node version, add the environment variable `NODE_VERSION` with the value `22`.

## Lockfile note (read this once)

The build command in the original plan is `npm ci && npm run build`. `npm ci` needs a `package-lock.json`, and this repository was written without being able to run npm, so no lockfile exists yet. Until one is committed, use this build command instead:

```
npm install && npm run build
```

Render will create a lockfile during that build. It is not saved back to GitHub. To switch to `npm ci` later, commit a `package-lock.json` to the repository root (for example by running `npm install` once on any computer or in a free online development environment and uploading the file), then change the Build Command to `npm ci && npm run build`.

## Create the service

1. In Render choose New, then Web Service.
2. Connect your GitHub account and pick the `allovwapp` repository. Branch: `main`.
3. Runtime: Node.
4. Build Command: `npm install && npm run build` (or `npm ci && npm run build` once a lockfile exists).
5. Start Command: `npm start`.
6. Health Check Path: `/health`.
7. Pick the plan you want. A free plan is enough to start.

## Environment variables

Open the Environment tab and paste each variable as a name and value. The full list is in `ENVIRONMENT.md`. The required ones:

| Name | Example value |
|---|---|
| `DATABASE_URL` | your Postgres connection string |
| `ENCRYPTION_KEY` | 64 random hex characters |
| `ADMIN_USERNAME` | `owner` |
| `ADMIN_PASSWORD` | a long password |
| `BASE_URL` | `https://your-service.onrender.com` |

Set `BASE_URL` to the exact address Render gives the service. It decides whether session cookies are marked Secure, so it must start with `https://` in production.

Never share these values and never put them in the repository.

## Database setup

- Use any managed Postgres. The app creates its own tables in a schema called `allov`, so it is safe to use a database that already holds other applications.
- If you use a connection pooler such as Supabase, choose session mode on port 5432. Do not use transaction mode.
- `DATABASE_SSL` controls encryption. Leave it unset for `require` (encrypted, certificate not checked), which works with most managed providers. Use `verify` together with `DATABASE_CA_CERT` when you want the certificate checked. Use `off` only on a private network.
- Any `sslmode` or `ssl` text inside `DATABASE_URL` is ignored on purpose. Use `DATABASE_SSL` instead.
- You do not run migrations. The app applies them when it starts.

## First start and confirmation

Deploy, then open the Logs tab. A healthy start prints these lines in order:

```
AllovWapp 1.0.0 listening on port 10000
Database connected
Migrations applied: 1
Owner account ready
```

On later starts the third line reads `Migrations up to date`. If the database is slow, the service still goes live first and connects in the background. Open `/health` to see the state: `database` is `connecting`, `ready` or `error` with a short reason.

## First sign in

Open `https://your-service.onrender.com/app/login` (or your `ADMIN_PATH` followed by `/login`). Sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Sessions last 6 hours.

After 5 failed attempts sign in pauses, first for 1 minute, then 5, 15 and 60 minutes on repeated failures. The page shows a countdown.

## Recover access

If you forget the password or want to sign everyone out:

1. In Render open Environment and change `ADMIN_PASSWORD`.
2. Save. Render redeploys.
3. On start the app updates the stored password hash and signs out every session. The logs show `Owner password updated from the environment and all sessions were signed out`.
4. Sign in with the new password.

This only works for the account named in `ADMIN_USERNAME`.

## Roll back a deploy

In Render open the service, go to Events or Deploys, find the last good deploy and choose Rollback. Database migrations in this version only add tables, so an older version keeps working with the newer schema.

## Running two roles (optional)

By default one process runs the API and the worker (`ALLOV_ROLE=all`). Later you can run two services from the same repository, one with `ALLOV_ROLE=api` and one with `ALLOV_ROLE=worker`. The worker only runs the hourly maintenance sweep.

## Troubleshooting

| You see | Meaning |
|---|---|
| `AllovWapp cannot start. X is required` | Variable `X` is missing or empty. Add it and redeploy. |
| `ENCRYPTION_KEY is too weak` | Use at least 32 characters with some variety. |
| `/health` shows `database: error` with `authentication failed` | The username or password in `DATABASE_URL` is wrong. |
| `/health` shows `secure connection failed` | Try `DATABASE_SSL=require`, or check `DATABASE_CA_CERT` when using `verify`. |
| Sign in page shows a banner about the database | The database is not ready yet. The service keeps retrying. |

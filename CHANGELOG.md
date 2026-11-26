# Changelog

## 1.0.0

Foundation release.

- Monorepo with npm workspaces: `@allov/server`, `@allov/web`, `@allov/shared`.
- Fastify API with TypeBox validated requests and responses, one stable error shape and a request id on every response.
- PostgreSQL through Drizzle ORM. Every table lives in the `allov` schema. Migrations run at start inside an advisory lock.
- The server listens before the database is ready. `/health` always answers 200 and reports the database state.
- Owner account created from the environment. Changing `ADMIN_PASSWORD` updates the hash and signs out every session.
- Sign in with Argon2id, database backed throttling with growing waits, 6 hour sessions stored as hashes, CSRF header on every state changing request.
- Workspaces with roles (owner, admin, developer, read_only), workspace rename, audit log.
- Worker role with an hourly maintenance sweep.
- React dashboard with a public page, sign in, Overview, Settings (workspace and security) and a 404 page. One light theme.
- Deployment guide for Render and documentation of every environment variable.

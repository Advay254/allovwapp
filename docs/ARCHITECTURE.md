# Architecture

## One service, two roles

The server has two logical roles with separate entry points.

- `api` (`server/entry-api.ts`): the HTTP server. It serves the API under `/api/v1`, the built dashboard and the public page.
- `worker` (`server/entry-worker.ts`): a small job runner with bounded concurrency. Its only job in this version is an hourly maintenance sweep.

`ALLOV_ROLE=all` (default) runs both in one process. `api` or `worker` run only one. A Postgres advisory lock makes sure only one instance sweeps at a time.

The server starts listening immediately and connects to the database in the background. `GET /health` always answers 200 while the process is alive.

## Folders

Nothing sits deeper than two levels below the repository root.

```
server/   config  db  http  lib  auth  workspaces  audit  system  test
web/      pages  components  lib  styles  public  test
shared/   constants, error codes and TypeBox schemas used by both sides
migrations/
```

## Module rules

- The feature folders `auth`, `workspaces`, `audit` and `system` talk to each other only through exported service functions. They never read each other's tables or files. For example, the maintenance sweep calls `pruneExpiredSessions` from auth and `pruneAuditLogs` from audit.
- `http`, `db`, `lib` and `config` are shared infrastructure.
- Every service function that touches workspace data takes a workspace id and enforces it in the query. A workspace id from the browser is never trusted without checking membership. A non member receives the same `not_found` as a missing workspace.
- Create a folder only when it holds working code. When a feature grows, add files with a name prefix (`session-list.ts`) instead of a sub folder.

## Database

Every table is in the Postgres schema `allov`: `users`, `workspaces`, `workspace_members`, `auth_sessions`, `login_attempts`, `audit_logs`, `system_meta`. Drizzle's bookkeeping table `__drizzle_migrations` is in the same schema.

Migrations are SQL files in `migrations/` plus `migrations/meta/_journal.json`. They run at start on one dedicated connection that holds an advisory lock, so two instances starting together cannot collide. All pending migrations run in one transaction, so a failure leaves nothing half applied and stops the start with a message.

The initial migration was written by hand because the tooling could not be run when this version was prepared. To add a migration: add `NNNN_name.sql` to `migrations/` (statements separated by `--> statement-breakpoint`), add a matching entry with the next `idx`, a later `when` value and the same `tag` to `meta/_journal.json`, and update `server/db/schema.ts`. Keep migrations additive.

## Naming conventions

| Thing | Name |
|---|---|
| Repository and root folder | `allovwapp` |
| Packages | `@allov/server`, `@allov/web`, `@allov/shared` |
| Postgres schema | `allov` |
| Session cookie | `__Host-allov_session` over HTTPS, `allov_session` otherwise |
| CSRF header | `X-Allov-CSRF` |
| Request id header | `X-Allov-Request-Id` |
| Reserved secret token prefix | `allov_` |

The prefix `allov_` is reserved for future secret tokens (for example API keys). Nothing uses it yet. Do not use it for anything that is not a secret token.

## Authentication in short

- Sign in: `POST /api/v1/auth/login` with Argon2id verification and a dummy hash for unknown users, so timing is similar.
- Throttling: 5 failures per 15 minutes per client address and per username. After the limit the wait grows (1, 5, 15, 60 minutes). Keys are keyed hashes, stored in `login_attempts`, so the limit is shared across instances.
- Session: random 32 byte token in an HttpOnly cookie. The database stores only its SHA-256 hash. The 6 hour limit is absolute. A revoked session is a deleted row.
- CSRF: every request other than GET, HEAD and OPTIONS needs `X-Allov-CSRF` matching the secret returned by `GET /api/v1/auth/session`.
- The dashboard keeps the CSRF secret in memory only. It uses no browser storage.

## Error format and codes

Every error has the same shape and a request id:

```json
{ "error": { "code": "forbidden", "message": "Your role does not allow this action.", "requestId": "req_1a2b3c4d5e6f7a8b" } }
```

| Code | Status | Meaning |
|---|---|---|
| `validation_failed` | 400 (415 for compressed bodies) | The request was not valid. |
| `unauthenticated` | 401 | Not signed in or the session ended. |
| `invalid_credentials` | 401 | Wrong username or password (the same answer for both). |
| `csrf_failed` | 403 | The CSRF header is missing or wrong. |
| `forbidden` | 403 | The member's role does not allow the action. |
| `not_found` | 404 | Missing, or not visible to this user. |
| `payload_too_large` | 413 | Body over 1 MB. |
| `too_many_attempts` | 429 | Sign in paused. `Retry-After` says for how long. |
| `rate_limited` | 429 | General API rate limit. |
| `internal_error` | 500 | Unexpected failure. Details are only in the server log. |
| `database_unavailable` | 503 | The database is not ready yet. |

Stack traces, SQL, file paths and library messages never reach the browser.

The general API rate limit (300 requests per minute per address, 20 for sign in) is held in memory per instance. The sign in throttle is in the database and is shared.

## How to add a module in a later version

1. Add a folder only when it will hold working code, for example `server/sessions/`.
2. Put business logic in service files (`session-service.ts`) that take the database executor and a workspace id, and enforce the workspace id in every query.
3. Put HTTP routes in a `*-routes.ts` file that exports `registerXRoutes(app, ctx)`. Guard routes with `authenticate(ctx)` and check membership and role in the service.
4. Describe request and response shapes with TypeBox in `shared/schemas.ts`.
5. Register the routes in `server/http/app.ts` inside the `/api/v1` plugin.
6. Add tables in `server/db/schema.ts` and a new migration with a `workspace_id` column.
7. Record important actions with `recordAudit`.
8. Add a page in `web/pages/` and a navigation item only when the page is real.
9. Add tests in `server/test/` and `web/test/`, including a workspace isolation test.

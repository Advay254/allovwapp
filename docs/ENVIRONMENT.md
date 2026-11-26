# Environment variables

All configuration is read in one place (`server/config/index.ts`) and checked when the service starts. A missing or invalid required value stops the start with one message that names the variable. Weak optional settings only print a warning. Secret values are never logged.

The names match the ones used on the owner's other service, so hosting settings carry over.

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Must start with `postgresql://` or `postgres://`. |
| `DATABASE_SSL` | no | `require` (default): encrypted, certificate not verified. `verify`: encrypted and verified, using `DATABASE_CA_CERT` when set. `off`: no encryption. |
| `DATABASE_CA_CERT` | no | CA certificate used when `DATABASE_SSL=verify`. Accepts the PEM as is, the PEM on one line with `\n` between lines, or base64. |
| `DATABASE_POOL_MAX` | no | Maximum database connections, 1 to 50. Default 5. |
| `ENCRYPTION_KEY` | yes | At least 32 characters with some variety (64 hex characters recommended). It keys the sign in throttle hashes now and will encrypt stored credentials later. **Never change it after first use.** The service refuses to start if it is missing or weak. |
| `ADMIN_USERNAME` | yes | Username of the first owner account. 3 to 64 letters, digits, dots, underscores, at signs or hyphens. Stored in lowercase. |
| `ADMIN_PASSWORD` | yes | Owner password. At least 12 characters. A warning appears below 16. Changing it and redeploying resets the stored password and signs out all sessions. |
| `ADMIN_PATH` | no | Private path prefix for the sign in page and dashboard. Lowercase letters, digits, hyphens, underscores, up to three segments. Default `/app`. It cannot start with `api`, `assets` or `health`. |
| `BASE_URL` | yes | Public address of the service. Used for canonical links, the sitemap and the cookie Secure decision. |
| `PORT` | no | Port to listen on. Default 3000. Render sets this itself. |
| `ALLOV_ROLE` | no | `all` (default), `api` or `worker`. |
| `AUDIT_RETENTION_DAYS` | no | Days to keep audit entries. Default 90. |
| `LOG_LEVEL` | no | `warn` (default), `error`, `info`, `debug`. The start up lines in the deployment guide always print. |

## Examples

Minimal:

```
DATABASE_URL=postgresql://postgres.abcd:secret@aws-0-eu.pooler.supabase.com:5432/postgres
ENCRYPTION_KEY=9f2c1d7a5b8e4c3f0a6d9b2e7c1f4a8d3b5e0c9a7f1d2b6e8c4a0f3d5b7e9c1a
ADMIN_USERNAME=owner
ADMIN_PASSWORD=a-long-password-you-will-remember
BASE_URL=https://allovwapp.onrender.com
```

Private dashboard path and verified TLS:

```
ADMIN_PATH=/console-x7
DATABASE_SSL=verify
DATABASE_CA_CERT=-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----
```

## Tests

| Variable | Meaning |
|---|---|
| `TEST_DATABASE_URL` | Enables the integration tests. Point it at an empty, disposable database. The tests drop the `allov` schema. When unset, those tests are skipped with a message. |
| `TEST_DATABASE_SSL` | `require`, `verify` or `off`. Default `off` for tests. |

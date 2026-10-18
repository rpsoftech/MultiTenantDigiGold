# DigiGold Backend (MainServerGo)

Go backend for DigiGold, a multi-tenant digital gold platform. Jewelry shops (tenants)
let their customers buy gold at live market rates. Customers never sell: gold leaves a
vault only as physical gold collected at the store counter.
The platform aggregates customer exposure across tenants and hedges it with a liquidity
provider.

- **Language:** Go 1.26
- **HTTP:** Fiber v3
- **Database:** PostgreSQL 18+ (ledger, tenants, users, event outbox)
- **Cache / messaging:** Redis (live rates, OTP sessions, caches, event pub/sub)
- **Payments:** Razorpay (per-tenant keys)
- **Messaging:** WhatsApp (OTP delivery)
- **Tracing:** OpenTelemetry (OTLP gRPC, optional)

API reference: run the server and open **http://localhost:8080/docs** (Swagger UI).
The spec is [`cmd/api/openapi.yaml`](cmd/api/openapi.yaml).

---

## Contents

1. [Architecture](#architecture)
2. [Project layout](#project-layout)
3. [Getting started](#getting-started)
4. [Configuration](#configuration)
5. [Core flows](#core-flows)
6. [Security model](#security-model)
7. [Coding conventions](#coding-conventions)
8. [Adding an endpoint](#adding-an-endpoint)
9. [Testing](#testing)
10. [Monitoring](#monitoring)
11. [Deployment](#deployment)
12. [Known gaps](#known-gaps)

---

## Architecture

```
                 ┌────────────── Rate feed (external) ──────────────┐
                 │ HSET LastRate GOLD <json>; PUBLISH rate/GOLD <json>│
                 └──────────────────────────┬───────────────────────┘
                                            │
 Consumer app ─┐                            ▼
 Admin app ────┼──► cmd/api (Fiber) ──► Redis ◄──────────┐
 Razorpay ─────┘      │  RateHub (SSE)     ▲             │
                      │  controllers       │ pub/sub     │
                      │  services          │ events      │
                      │  repositories      │             │
                      ▼                    │             │
                 PostgreSQL ◄──────────────┴──── cmd/worker
                 (ledger, outbox)               event consumer
                                                outbox recovery cron
```

Two binaries:

| Binary | Entry                | Runs                                                                       |
| ------ | -------------------- | -------------------------------------------------------------------------- |
| API    | `cmd/api/main.go`    | HTTP API, SSE rate hub, event consumer, outbox recovery cron, hedging cron |
| Worker | `cmd/worker/main.go` | Event consumer and outbox recovery cron only                               |

Both processes may run the event consumer at the same time. Each event is claimed
atomically in PostgreSQL, so it is handled once (see [Events](#events-and-the-outbox)).

Layers, strictly one direction:

```
Controller (internal/api)  → parse input, pick tenant/user from context, call a service
Service    (internal/service) → business rules, open/commit transactions
Repository (internal/repository) → SQL only, prepared statements, Redis caching
```

---

## Project layout

```
cmd/
  api/            API entry point, Swagger setup, openapi.yaml (embedded)
  worker/         Worker entry point
env/              Env loading and validation (APP_ENV, PORT, JWT keys)
events/           Event types written to system_events and published to Redis
interfaces/       Request DTOs, RequestError, error codes, sentinel errors, error translator
internal/
  api/            Fiber controllers, one package per area (auth, trade, rates, admin, tenant)
  constants/      Redis keys and channels for the rate feed
  database/       Migration runner, schema reset, event partitions, mock data (mock_data.sql), test seed
  integration/    Integration tests (build tag `integration`)
  middleware/     Tenant resolution, customer/admin JWT, roles, rate limit, error handler, tracing
  monitoring/     Critical-error and refund reporting to OpenTelemetry
  models/         Structs that map to database tables
  repository/     Data access (prepared statements, tenant-scoped queries, caches)
  schema/         Table and column name constants (no SQL strings with raw names elsewhere)
  server/         Builds the Fiber app with every route (used by cmd/api and the tests)
  service/        Business logic: trade, redemption, OTP, JWT, admin auth, payments, hedging, tenants
  worker/         Event consumer, WhatsApp OTP sender, hedging consumer, crons
pkg/              Payment and WhatsApp provider clients
utility/          Postgres/Redis clients, OTA updater, OpenTelemetry, helpers
scripts/deploy.go Build and publish binaries for the OTA updater
migrations/       The SQL schema (one file while there is no production data), embedded in the binaries
cmd/dbtool/       CLI: migrate up/down/version/force, reset, seed, bootstrap
```

---

## Getting started

### Prerequisites

- Go 1.26+
- PostgreSQL 18+ and Redis 7+, or Docker with Compose

### 1. Start PostgreSQL and Redis

```sh
cd packages/servers/MainServerGo
docker compose up -d db redis
```

The API creates the schema itself: it runs the migrations on startup. If you have an old
`pgdata` volume from PostgreSQL 15, remove it first (`docker compose down -v`); the
data format is not compatible.

### 2. Create env files

```sh
cp digiGold.env_example cmd/api/digiGold.env
cp digiGold.env_example cmd/worker/digiGold.env
```

Set `ACCESS_TOKEN_KEY` and `REFRESH_TOKEN_KEY` to two different random strings of
100+ characters:

```sh
openssl rand -base64 96 | tr -d '\n'
```

Both env files are git-ignored. Never commit them.

### 3. Run

The binaries load `digiGold.env` from the working directory, so run from the `cmd` folder:

```sh
cd cmd/api && go run .        # API on :8080
cd cmd/worker && go run .     # optional; the API already runs the consumer
```

With `APP_ENV=LOCAL` or `DEVELOP` the API prints all routes on boot.
With `LOCAL`, `DEVELOP` or `STAGING` it serves Swagger UI at `/docs`.

### 4. Mock data

```sh
cd cmd/api && go run ../dbtool seed
```

`seed` loads [`internal/database/mock_data.sql`](internal/database/mock_data.sql) and a
starting gold rate. Loading it twice changes nothing, and it refuses to run when
`APP_ENV=PRODUCTION`. Dates are relative to now, so "today" lists always have rows.

| What                    | Value                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform tenant         | `01900000-0000-7000-8000-000000000001` (`default`, fallback WhatsApp config)                                                                         |
| Demo store              | `01900000-0000-7000-8000-000000000002` (₹100/g margin, 3% GST, 1000 g credit)                                                                        |
| Second store            | `01900000-0000-7000-8000-000000000003` (for tenant-isolation checks)                                                                                 |
| Suspended store         | `01900000-0000-7000-8000-000000000004` (`closed`: its customers and staff get `403`)                                                                 |
| Admins                  | `platform-admin` (super_admin), `demo-manager`, `other-manager`, `closed-manager` (manager)                                                          |
| More demo store staff   | `demo-new-staff` (no TOTP yet: first sign-in enrols it), `demo-former-staff` (deactivated)                                                           |
| Customers of demo store | `9999900001` KYC verified, `9999900002` KYC in review, `9999900003` none, `9999900004` rejected                                                      |
| Trades                  | Online and counter buys, a reversed buy, collected pickups (one today), a cancelled pickup                                                           |
| Pickups at the counter  | Code `482913` (customer `9999900002`); one more locked after 5 wrong codes                                                                           |
| Store configs           | DigiGold default UI config (logo, theme, all modules); WhatsApp OTPs via the platform's placeholder endpoint (read the OTP from Redis); webhooks off |
| Store KYC documents     | Demo: PAN and GST verified; other store: business registration pending; closed store: director ID rejected                                           |
| Live rate (Redis)       | ask 7000 / bid 6950, only if no rate exists yet                                                                                                      |

Every admin signs in with password `DigiGold@123` and TOTP secret
`JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (add it to any authenticator app). The stores' Razorpay keys
are placeholders; for checkout, set real test keys with `SEED_RAZORPAY_KEY_ID`,
`SEED_RAZORPAY_KEY_SECRET` and `SEED_RAZORPAY_WEBHOOK_SECRET` when running `seed`.

The integration tests don't use this file: they seed a smaller set of the same IDs from
`database.Seed`, with test-only secrets. `TestMockDataIsConsistent` loads the file into a
schema of its own and checks that its balances add up.

### Production bootstrap

`seed` refuses `PRODUCTION`. A new production database gets the platform tenant (`default`,
whose config is the fallback for every store) and its first `super_admin` from `bootstrap`,
which writes no demo data and is safe to run again:

```sh
cd cmd/api
BOOTSTRAP_ADMIN_USERNAME=platform-root \
BOOTSTRAP_ADMIN_PHONE=9000000001 \
BOOTSTRAP_ADMIN_PASSWORD='at-least-12-characters' \
go run ../dbtool bootstrap
```

It prints the platform tenant UUID. The super_admin signs in with `X-Tenant-ID` set to that
UUID (an admin panel build whose `NEXT_PUBLIC_TENANT_UUID` is the platform tenant), then
sets up TOTP. Stores are then created with `POST /admin/tenants/stub`, which also creates
the store's root admin (a `manager`) with the password given. Unset
`BOOTSTRAP_ADMIN_PASSWORD` afterwards; it is stored only as a bcrypt hash.

### Schema

No database holds data that must be kept yet, so the whole schema is one file:
[`migrations/000001_init.up.sql`](migrations/000001_init.up.sql). The API and the worker apply
it on startup (golang-migrate holds a PostgreSQL advisory lock, so both can start together).

To change the schema, edit that file and reset each database:

```sh
cd cmd/api
go run ../dbtool reset    # drop everything, create the schema, clear the app's Redis keys
go run ../dbtool seed     # load the mock data again
```

Restart the API and worker after a reset: they keep tenant IDs in memory. `reset` refuses
`PRODUCTION`. A database created before the schema became one file is recorded at version 6,
which no longer exists, so the servers stop with `no migration found for version 6` until it is
reset.

Once a database holds data that must be kept, stop editing `000001_init` and add numbered
migrations (`000002_name.up.sql` / `.down.sql`) instead:

```sh
go run ../dbtool migrate up          # apply pending
go run ../dbtool migrate version     # show version
go run ../dbtool migrate down 1      # revert the last one
go run ../dbtool migrate force 1     # clear a failed (dirty) run after fixing it by hand
```

`system_events` is partitioned by month. `ensure_system_events_partitions()` keeps the
current month and the next three; the API calls it on startup and daily. A `DEFAULT`
partition catches anything outside them, so event writes never fail for lack of a partition.

### Postman

Postman collections live next to this file: `DigiGold_Auth_Flow.postman_collection.json`,
`Trade_Endpoints.postman_collection.json` and `api_collection.json`. Swagger is kept
up to date first; the collections may lag behind.

---

## Configuration

All variables are read from `digiGold.env` in the working directory, then from the
process environment.

| Variable                                                                       | Required | Notes                                                                                 |
| ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| `APP_ENV`                                                                      | yes      | `LOCAL`, `DEVELOP`, `CI`, `STAGING`, `PRODUCTION`                                     |
| `PORT`                                                                         | yes      | HTTP port for the API                                                                 |
| `ACCESS_TOKEN_KEY`                                                             | yes      | HMAC key for access and registration tokens, 100+ chars                               |
| `REFRESH_TOKEN_KEY`                                                            | yes      | HMAC key for refresh tokens, 100+ chars, different from the access key                |
| `PG_HOST`, `PG_PORT`, `PG_USERNAME`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SCHEMA` | yes      | PostgreSQL connection                                                                 |
| `REDIS_DB_HOST`, `REDIS_DB_PORT`, `REDIS_DB_PASSWORD`                          | yes      | Redis connection. Password must not be empty                                          |
| `REDIS_DB_USERNAME`                                                            | no       | Redis ACL user                                                                        |
| `REDIS_DB_DATABASE`                                                            | yes      | Redis DB index (0-100)                                                                |
| `REDIS_DEFAULT_KEY`                                                            | yes      | Prefix for app keys (e.g. `digiGold:`)                                                |
| `REDIS_DEFAULT_CHANNEL`                                                        | yes      | Prefix for event channels (e.g. `digiGold:`)                                          |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                                  | no       | OTLP gRPC collector for traces and metrics (default `localhost:4317`)                 |
| `CORS_ALLOW_ORIGINS`                                                           | prod     | Comma-separated frontend origins. Unset allows `*`; PRODUCTION won't start without it |
| `ENABLE_MOCK_LP_HEDGING`                                                       | no       | `true` runs the hedging cron with simulated LP fills. Ignored in PRODUCTION           |

Per-tenant secrets (Razorpay keys, webhook secret, WhatsApp credentials) are stored
in `tenant_internal_configs` and set through `PATCH /admin/tenants/{uuid}/config`.

`APP_ENV` behaviour:

|                    | LOCAL | DEVELOP | CI  | STAGING | PRODUCTION |
| ------------------ | ----- | ------- | --- | ------- | ---------- |
| Swagger `/docs`    | ✓     | ✓       |     | ✓       |            |
| Route list on boot | ✓     | ✓       |     |         |            |
| OTA self-update    |       |         |     | ✓       | ✓          |

---

## Core flows

### Tenancy

Every tenant-scoped request carries `X-Tenant-ID` (tenant UUID).
`middleware.TenantInterceptor` resolves it to the internal numeric ID and stores it in
Fiber locals. Controllers read it with `middleware.GetTenantIntID(c)`, never from the
request body. Every repository query on tenant data filters by tenant ID.

A store can be suspended (`PATCH /admin/tenants/{uuid}/status {"is_active": false}`). The
interceptor then refuses it with `403 TENANT_INACTIVE`; each API instance re-reads the flag
at least every 30 seconds. Payments already captured still settle (the webhook doesn't go
through the interceptor). The platform tenant, and the tenant in the caller's own
`X-Tenant-ID`, can't be suspended (`400 CANNOT_SUSPEND_PLATFORM_TENANT`): platform admins
sign in through it, so nobody could reactivate it.

### Customer login (OTP)

```
POST /auth/otp/request   {phone}            → WhatsApp OTP, is_registered
POST /auth/otp/verify    {phone, otp}       → access + refresh token   (registered)
                                            → registration_token       (new user)
POST /auth/register      {registration_token, full_name, location, email_id?}
                                            → access + refresh token
POST /auth/refresh       {refresh_token}    → new access + refresh token (single use)
POST /auth/logout        {refresh_token}    → revokes the refresh token
```

OTP rules: 10-digit phone and 6-digit code (validated), 30 s cooldown, 5 sends per
10-minute window, 5 guesses per code (counted atomically, so parallel guesses can't exceed
it). OTP state lives in Redis only: the `OTPReqEvent` carries no code, and the WhatsApp
worker reads it from the live session when it sends.

Customer refresh tokens are recorded in Redis by their `jti` (like admin ones), so each
works once and logout revokes it. Access tokens last 15 minutes.

### Admin login (password + TOTP)

```
POST /admin/auth/login        {username, password} → temp_token (5 min)
POST /admin/auth/totp/setup   {temp_token}         → otpauth_uri  (first login only)
POST /admin/auth/totp/verify  {temp_token, code}   → access + refresh token
POST /admin/auth/refresh      {refresh_token}      → new token pair
```

Roles in the schema: `super_admin` (platform), `manager` (shop), `custom` (unused). Tenant
onboarding creates the store's root admin as `manager`. Staff (`/admin/admins`): a
`super_admin` manages any store's admins; a `manager` manages only their own store's, can
give only the `manager` role and can't change a `super_admin`. Nobody can deactivate their
own account or change their own role.

### Live rates

An external feed writes the latest snapshot to the Redis hash `LastRate` (field `GOLD`)
and publishes the same JSON on channel `rate/GOLD`. `RateHub` subscribes once,
formats each change once, and fans it out to all SSE clients on `GET /rates/stream`
without blocking. Slow clients skip ticks.

### Trading

Customers only **buy** gold. There is no sell. Gold leaves a vault only through a
**redemption**: the customer collects physical gold at the store counter. No money moves
out of the system.

`TradeService.ExecuteTrade` (buy):

1. Reads the live rate from Redis.
2. Price: ask + margin + GST.
3. Rejects the trade if the price differs from `requested_rate_per_gram` by more than ₹30
   (`409 SLIPPAGE_EXCEEDED`).
4. In one transaction:
   - locks the user row (scoped to the tenant),
   - writes a `GOLD_PURCHASE` ledger entry (+ grams),
   - writes the audit event,
   - updates tenant unlifted grams (rejects the buy past the store's credit limit).
5. Publishes the event to Redis after commit.

Online buy:

```
POST /trade/buy/initiate {total_amount_inr, requested_rate_per_gram}
  → price check + store credit check → quote locked for 15 min
  → Razorpay order + trade intent (request + quote) in Redis (7 days)
Razorpay → POST /webhook/razorpay (payment.captured)
  → verify signature, event type, tenant, amount and quote expiry
  → ExecuteQuotedTrade at the locked quote (no second price check)
```

Online buys are priced by amount only. The response includes the locked `weight_grams`,
`final_rate_per_gram` and `quote_expires_at`.

If a captured payment can never be settled, the webhook **refunds it in full** through the
Razorpay refund API and writes a `TRADE_PAYMENT_REFUNDED` audit event. This happens when
the quote expired before capture, the amount does not match, the intent is missing, or
the trade is rejected (store out of credit, user gone). A missing intent is refunded only
for orders tagged `notes.source = "digigold"`. Transient failures (database, Redis,
Razorpay refund call) return `500` so Razorpay retries.

Counter buys are two calls. `POST /admin/store/trade/counter/quote` prices the sale for a
customer (`user_uuid`, `COUNTER_CASH` or `COUNTER_UPI`) at the store's own rate and holds
it for 5 minutes; the cashier collects exactly that amount. `POST /admin/store/trade/counter`
with the `quote_id` records it, with reference `COUNTER_<quote_id>`: confirming the same
quote again returns the recorded sale (`already_recorded: true`) instead of a second one.
Cash is refused once the customer's cash paid at the counter today (IST) would reach
₹2,00,000 (Income Tax Act s.269ST), checked at quote time and again under the customer's
vault lock when confirming.

Redemption (counter pickup):

```
POST /trade/redeem {weight_grams}
  → PHYSICAL_REDEMPTION ledger entry (− grams, payment_mode NONE, amount 0)
  → redemption request PENDING + 6-digit pickup code (shown to the customer only)
Customer shows the code at the counter
  → GET  /admin/store/redemptions/pending?phone=...   (staff find the request)
  → POST /admin/store/redemptions/collect {redemption_uuid, pickup_code}  → COLLECTED
  → GET  /admin/store/redemptions/collected            (today's handovers, for the day's count)
```

Each wrong pickup code counts against the request. After 5 it locks (`PICKUP_CODE_LOCKED`):
even the right code is refused and the request can only be cancelled, so a 6-digit code
can't be found by trying them all. Collect is also rate limited per staff login.

A `PENDING` request can be cancelled by the customer (`POST /trade/redemptions/{uuid}/cancel`)
or by staff (`POST /admin/store/redemptions/cancel`). Cancelling posts a `SYSTEM_REVERSAL`
that returns the grams to the vault. A collected request cannot be cancelled or reversed.

Reversals (`POST /admin/store/ledger/reverse`) post an opposite `SYSTEM_REVERSAL` entry.
The ledger is append-only; rows are never updated.

### Events and the outbox

- Every state change writes a row to `system_events` inside its own transaction.
- After commit the service publishes the event to Redis (`<REDIS_DEFAULT_CHANNEL>event:...`).
- The event consumer (API and worker) receives it and **claims** it with
  `UPDATE ... SET is_processed = true WHERE id = $1 AND is_processed = false`.
  Only one consumer wins. A row that is not committed yet cannot be claimed.
- Trade events are claimed inside the same transaction as the hedging update (exactly once).
- Other handlers release the claim on failure so the event is retried.
- The outbox recovery cron (every 5 min) republishes events that are unprocessed and older than 1 minute.
- Audit-only events are marked processed with no side effect.

Handled today: `OTPReqEvent` (send WhatsApp OTP) and `TRADE_GOLD_PURCHASE` (update hedging
exposure; also emitted for redemptions and reversals with signed grams).

### Hedging

Every ledger movement adds its signed grams to `master_hedging_state.unhedged_grams`. No
liquidity provider is integrated yet, so the hedging cron is **off** by default and the
exposure simply accumulates. With `ENABLE_MOCK_LP_HEDGING=true` (never in PRODUCTION) the
cron runs every 10 s and books whole 100 g lots as `master_hedging_orders` with simulated
fills (fixed rate, `LP_MOCK_` references).

---

## Security model

- **Tokens:** HS256 JWTs sent raw in `X-Api-Token`. Each kind has its own audience
  (`digigold:user:access`, `digigold:user:refresh`, `digigold:user:registration`,
  `digigold:admin:access`, `digigold:admin:refresh`). A token of one kind is rejected
  everywhere else.
- **Customer isolation:** the customer token's tenant must equal `X-Tenant-ID`.
- **Admin isolation:** the admin token's tenant must equal `X-Tenant-ID`, except for
  `super_admin`. Give `super_admin` to platform staff only, never to shop owners.
- **Roles:** checked with `middleware.RequireRole(...)` on each admin route group; staff
  management (`/admin/admins`) also scopes a manager to their own store.
- **Rate limits:** `/auth/*` and `/admin/auth/*` allow 10 requests per minute per IP and
  route (in memory, per API instance).
- **Money safety:** balance checks run under a row lock; reversals are locked and
  single-use; webhook trades check event type, tenant and amount. A payment, counter quote
  or reversal reference can be in the ledger only once (unique index), and a repeated
  webhook for a payment already credited or refunded does nothing.
- **Errors:** 5xx responses never include internal error text.
- **Secrets:** env files and binaries are git-ignored. Per-tenant secrets live in the database.

When adding a route, decide which guard chain it needs and follow an existing group.

---

## Coding conventions

The full rule set is in [`.agents/skills/digigold-backend-architecture/SKILL.md`](../../../.agents/skills/digigold-backend-architecture/SKILL.md). Key rules:

- **Layers:** no SQL in controllers or services; no business logic in controllers.
- **Names:** table and column names come from `internal/schema` constants.
- **IDs:** internal `BIGSERIAL` IDs use `json:"-"`. APIs take and return UUIDs only.
  Never accept an internal ID from a request body.
- **Singletons:** repositories, services and controllers are created once with `sync.Once`.
- **Prepared statements:** prepare SQL once at repository init.
- **Transactions:**
  - lock mutable rows with `SELECT ... FOR UPDATE` inside a `*sql.Tx`,
  - write the audit event in the same transaction,
  - publish events with `EventRepo.PublishAsync` only **after** `Commit`,
  - never call external HTTP APIs inside a transaction.
- **Ledger:** use signed quantities and never update ledger rows.
- **Rows:** check `rows.Err()` after every `rows.Next()` loop.
- **Goroutines:** give every background goroutine a `context.WithTimeout`.
- **Errors:**
  - Return errors from controllers and let `middleware.GlobalErrorHandler` format them.
  - For expected failures, add a sentinel in `interfaces/sentinel_errors.go` and map
    it in `interfaces/error_translator.go`.
  - Do not return `err.Error()` to clients.
- **Formatting:** run `gofmt` (the pre-commit hook runs it on staged Go files).

---

## Adding an endpoint

1. **Model:** add or extend a struct in `internal/models` and any new column constants in `internal/schema`.
2. **Repository:** add the query as a prepared statement. Filter by tenant ID.
3. **Service:** put the business logic here. Use a transaction if you write more than
   one row, and save an audit event in it.
4. **Controller:** in `internal/api/<area>`, register the route inside a group with the
   right guards:
   - customer: `TenantInterceptor` + `GetAuthMiddleware().Intercept`
   - admin: `TenantInterceptor` + `GetAdminAuthMiddleware().Intercept` + `RequireRole(...)`
5. **Wiring:** if the controller is new, register it in `cmd/api/main.go`.
   Attach middleware to a specific prefix group (e.g. `/trade`). Never attach it to a
   `"/"` group: Fiber then runs it for every later route under `/api/v1`.
6. **Docs:** add the path to `cmd/api/openapi.yaml` and lint it:
   `npx @redocly/cli lint cmd/api/openapi.yaml`
7. **Tests:** add tests next to the code (`*_test.go`).

---

## Testing

```sh
go vet ./...
go test ./...                                                   # unit tests, no database
go test -tags=integration -count=1 -v ./internal/integration/...  # integration tests
```

The integration tests start the real app in-process (`internal/server`) against a real
PostgreSQL 18 and Redis, and a fake Razorpay server (`RAZORPAY_BASE_URL`). By default they
use the `docker compose up -d db redis` services. They **wipe** the database and Redis DB
they use, so they refuse to run unless `PG_DATABASE` ends in `_test` (default
`digigold_test`, created if missing) and `REDIS_DB_DATABASE=15`.

Covered flows: online buy (initiate, signed webhook, locked quote, duplicate webhook, bad
signature, amount mismatch refund, expired quote refund, slippage, store out of credit, KYC
limit), counter buy, counter redemption with pickup code (collect, wrong code, customer
and staff cancel, overdraw), reversal, tenant isolation, and event partitions. Customer
tokens are minted directly because OTP login needs WhatsApp.

CI runs both suites on every pull request that touches the backend
(`.github/workflows/backend-tests.yml`).

To add a test: put a `//go:build integration` file in `internal/integration/`, then use
`call(...)` to hit an endpoint, `customerToken`/`adminToken` to authenticate, and
`balance`/`expectGrams`/`expectError` to assert.

---

## Monitoring

The API and worker export traces and metrics over OTLP gRPC (`OTEL_EXPORTER_OTLP_ENDPOINT`).
Report anything that needs a human with `monitoring.Critical(ctx, kind, err)`: it logs the
error, marks the current span failed, and increments `digigold.critical_errors{kind}`.

| Metric (Prometheus name)         | Labels   | Alert when                     |
| -------------------------------- | -------- | ------------------------------ |
| `digigold_critical_errors_total` | `kind`   | any increase                   |
| `digigold_payment_refunds_total` | `reason` | unusual rate (a pricing issue) |

`kind` values: `http_5xx`, `refund_failed` (customer paid, no gold, refund not done yet),
`refund_not_logged`, `webhook_processing`, `event_publish`, `event_consumer`,
`outbox_republish`, `partition_maintenance`, `whatsapp_send`.

Example Grafana alert: `sum by (kind) (increase(digigold_critical_errors_total[5m])) > 0`.

---

## Deployment

### Docker

```sh
docker compose up -d --build
```

Builds the API image (`Dockerfile`) and runs it with PostgreSQL and Redis. The API reads
secrets from `cmd/api/digiGold.env`; compose overrides the database and Redis hosts. The
image also contains `dbtool`: `docker compose run --rm api ./dbtool seed`.

### OTA binaries (staging / production)

`scripts/deploy.go` builds `api` and `worker` for linux/amd64, uploads them to the file
server and bumps the version in the key-value store. Run from the repository root:

```sh
DEPLOY_ENV=STAGING FILE_SERVER_TOKEN=... KV_TOKEN=... go run ./packages/servers/MainServerGo/scripts/deploy.go
```

Options:

- `-dry-run` builds, compresses and hashes every binary into `build/` without uploading anything or
  touching the key-value store. No tokens needed. Backend Tests runs it on every pull request.
- A trailing number forces the version, e.g. `go run ./packages/servers/MainServerGo/scripts/deploy.go 120`.
  Servers only install versions higher than the one they run.

Without an override, one version covers every binary in the run. It is higher than every published
version, and in CI never lower than the workflow run number. Each release uploads to its own file
(`<key>_v<N>.gz`), so older releases stay available.

`DEPLOY_ENV` must equal the target servers' `APP_ENV`. Running servers with `APP_ENV`
`STAGING` or `PRODUCTION` check for a newer version every 5 minutes, verify the SHA-256,
replace their own binary, and shut down gracefully. A process manager (systemd, etc.)
must restart them.

---

## Known gaps

- No liquidity provider integration: hedging exposure accumulates (see Hedging).
- `OTPReqEvent` rows written before this change still contain the code;
  the event log API redacts it.
- Some admin routes return `{"error": "..."}` instead of the standard error shape.
- WhatsApp delivery itself is not covered by the integration tests (they read the code
  from Redis).

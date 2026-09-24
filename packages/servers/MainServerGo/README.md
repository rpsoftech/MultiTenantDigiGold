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
  database/       Migration runner (golang-migrate), event partition upkeep, seed data
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
migrations/       Versioned SQL migrations (source of truth for the schema), embedded in the binaries
cmd/dbtool/       CLI: migrate up/down/version/force, seed
schema.sql          Legacy MySQL schema. Not used.
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

The API creates the schema itself: it runs all pending migrations on startup. If you have an old
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

### 4. Seed data

```sh
cd cmd/api && go run ../dbtool seed
```

The seed is idempotent and refuses to run when `APP_ENV=PRODUCTION`. It creates:

| What                    | Value                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| Platform tenant         | `01900000-0000-7000-8000-000000000001` (`default`, fallback WhatsApp config)  |
| Demo store              | `01900000-0000-7000-8000-000000000002` (₹100/g margin, 3% GST, 1000 g credit) |
| Second store            | `01900000-0000-7000-8000-000000000003` (for tenant-isolation checks)          |
| Admins                  | `platform-admin` (super_admin), `demo-manager`, `other-manager` (manager)     |
| Customers of demo store | `9999900001` (KYC verified), `9999900002` (KYC pending)                       |
| Live rate (Redis)       | ask 7000 / bid 6950, only if no rate exists yet                               |

Admin password and TOTP secret come from `SEED_ADMIN_PASSWORD` (default `DigiGold@123`) and
`SEED_ADMIN_TOTP_SECRET` (default `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`; add it to any
authenticator app). Store Razorpay keys come from `SEED_RAZORPAY_KEY_ID`,
`SEED_RAZORPAY_KEY_SECRET` and `SEED_RAZORPAY_WEBHOOK_SECRET`.

### Schema migrations

Files live in `migrations/` as `NNNNNN_name.up.sql` / `.down.sql`. The API and the worker
apply pending migrations on startup (golang-migrate holds a PostgreSQL advisory lock, so
both can start together). To change the schema, add the next numbered pair; never edit a
migration that has already run anywhere.

```sh
cd cmd/api
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

| Variable                                                                       | Required | Notes                                                                  |
| ------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------- |
| `APP_ENV`                                                                      | yes      | `LOCAL`, `DEVELOP`, `CI`, `STAGING`, `PRODUCTION`                      |
| `PORT`                                                                         | yes      | HTTP port for the API                                                  |
| `ACCESS_TOKEN_KEY`                                                             | yes      | HMAC key for access and registration tokens, 100+ chars                |
| `REFRESH_TOKEN_KEY`                                                            | yes      | HMAC key for refresh tokens, 100+ chars, different from the access key |
| `PG_HOST`, `PG_PORT`, `PG_USERNAME`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SCHEMA` | yes      | PostgreSQL connection                                                  |
| `REDIS_DB_HOST`, `REDIS_DB_PORT`, `REDIS_DB_PASSWORD`                          | yes      | Redis connection. Password must not be empty                           |
| `REDIS_DB_USERNAME`                                                            | no       | Redis ACL user                                                         |
| `REDIS_DB_DATABASE`                                                            | yes      | Redis DB index (0-100)                                                 |
| `REDIS_DEFAULT_KEY`                                                            | yes      | Prefix for app keys (e.g. `digiGold:`)                                 |
| `REDIS_DEFAULT_CHANNEL`                                                        | yes      | Prefix for event channels (e.g. `digiGold:`)                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                                  | no       | OTLP gRPC collector for traces and metrics (default `localhost:4317`)  |

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

### Customer login (OTP)

```
POST /auth/otp/request   {phone}            → WhatsApp OTP, is_registered
POST /auth/otp/verify    {phone, otp}       → access + refresh token   (registered)
                                            → registration_token       (new user)
POST /auth/register      {registration_token, full_name, location, email_id?}
                                            → access + refresh token
```

OTP rules: 30 s cooldown, resend limit per 10-minute window, verify attempts limited.
OTP state lives in Redis.

### Admin login (password + TOTP)

```
POST /admin/auth/login        {username, password} → temp_token (5 min)
POST /admin/auth/totp/setup   {temp_token}         → otpauth_uri  (first login only)
POST /admin/auth/totp/verify  {temp_token, code}   → access + refresh token
POST /admin/auth/refresh      {refresh_token}      → new token pair
```

Roles in the schema: `super_admin` (platform), `manager` (shop), `custom`. Tenant
onboarding creates the store's root admin as `manager`. The event log also
accepts `auditor`, but the `tu_role` CHECK constraint does not allow that value yet.

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

Counter buys (`POST /admin/store/trade/counter`) identify the customer by `user_uuid` and
accept `COUNTER_CASH` or `COUNTER_UPI`.

Redemption (counter pickup):

```
POST /trade/redeem {weight_grams}
  → PHYSICAL_REDEMPTION ledger entry (− grams, payment_mode NONE, amount 0)
  → redemption request PENDING + 6-digit pickup code (shown to the customer only)
Customer shows the code at the counter
  → GET  /admin/store/redemptions/pending?phone=...   (staff find the request)
  → POST /admin/store/redemptions/collect {redemption_uuid, pickup_code}  → COLLECTED
```

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

The hedging cron (API process, every 10 s) locks `master_hedging_state`. When unhedged
exposure reaches 100 g it books whole 100 g lots as `master_hedging_orders`. The
liquidity provider call is **mocked** (fixed rate).

---

## Security model

- **Tokens:** HS256 JWTs sent raw in `X-Api-Token`. Each kind has its own audience
  (`digigold:user:access`, `digigold:user:refresh`, `digigold:user:registration`,
  `digigold:admin:access`, `digigold:admin:refresh`). A token of one kind is rejected
  everywhere else.
- **Customer isolation:** the customer token's tenant must equal `X-Tenant-ID`.
- **Admin isolation:** the admin token's tenant must equal `X-Tenant-ID`, except for
  `super_admin`. Give `super_admin` to platform staff only, never to shop owners.
- **Roles:** checked with `middleware.RequireRole(...)` on each admin route group.
- **Rate limits:** `/auth/*` and `/admin/auth/*` allow 10 requests per minute per IP and
  route (in memory, per API instance).
- **Money safety:** balance checks run under a row lock; reversals are locked and
  single-use; webhook trades check event type, tenant and amount.
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

`DEPLOY_ENV` must equal the target servers' `APP_ENV`. Running servers with `APP_ENV`
`STAGING` or `PRODUCTION` check for a newer version every 5 minutes, verify the SHA-256,
replace their own binary, and shut down gracefully. A process manager (systemd, etc.)
must restart them.

---

## Known gaps

- Liquidity provider hedging is mocked.
- OTP codes are stored in `system_events` payloads. This is by design: only platform
  staff can read the event log.
- Some admin routes return `{"error": "..."}` instead of the standard error shape.
- Customer OTP login is not covered by the integration tests (it needs WhatsApp).
- The `auditor` role is referenced in code but not allowed by the schema.

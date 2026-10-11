# DigiGold — project context for AI assistants

DigiGold is a multi-tenant digital-gold platform. Each **tenant** is a gold store. Its
**customers** buy gold online or at the store counter, hold it in a vault (grams), and
collect physical gold at the counter. Store **staff/admins** run the counter, review KYC,
and see the ledger. A **platform super admin** manages tenants and reads the audit log. A
jewellery catalogue exists but runs on sample data until MainServer has catalogue endpoints.

Read these first; they are more detailed than this file and are kept up to date:

- Backend: `packages/servers/MainServerGo/README.md` (architecture, flows, security model,
  coding conventions, testing, deployment, known gaps).
- Backend rules: `.agents/skills/digigold-backend-architecture/SKILL.md`.
- API: `packages/servers/MainServerGo/cmd/api/openapi.yaml` (Swagger UI at
  `http://localhost:8080/docs` locally).

## Repository

Nx monorepo (yarn, Node), Windows development machine.

| Path                                      | What                                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/apps/DigiGold`                  | The main web app: Next.js 16, **static export** (`output: 'export'`), React Query, Redux Toolkit, SCSS modules, Jest (SWC). Customer app + admin panel (`/admin/*`). |
| `packages/servers/MainServerGo`           | Go API + worker: Fiber v3, PostgreSQL 18 (needs `uuidv7()`), Redis, golang-migrate.                                                                                  |
| `packages/apps/admin-app`, `consumer-app` | Angular apps (built in CI; not the focus of recent work).                                                                                                            |
| `packages/libs/*`                         | Shared libs (`core` is tested in CI).                                                                                                                                |

DigiGold `src/`: `app/` (routes), `components/<area>/<Component>/` (component, `.module.scss`,
`.spec.tsx` side by side), `features/<area>/` (`*.service.ts`, `*.types.ts`, `*.mock.ts`,
`hooks/`), `store/` (Redux slices), `lib/` (API client, constants, utils), `test-utils/`.

## How the team works

- Flow: feature branch → PR into `staging` (**squash merge**) → `staging` → `main` for release.
- The owner commits and pushes; an assistant prepares changes and **commit messages**.
  **Never add AI attribution** (no `Co-Authored-By: Claude/Gemini…`, no "Generated with…")
  to commit messages or PR descriptions. When squash-merging on GitHub, delete such lines
  from the squash message.
- Usual loop per branch: merge staging in and resolve conflicts → honest review against
  `origin/staging` → "fix all" → verify → commit message.
- **Merging staging into a feature branch:** branches often still carry their own pre-squash
  commits whose squashed (and later fixed) versions are already on staging. Resolve by taking
  staging's tree (`git checkout origin/staging -- .`), removing files staging deleted or
  renamed, then re-applying only the branch's genuinely new commit(s) with
  `git diff <c>^ <c> | git apply --3way --index`. Verify:
  `git diff --cached --numstat origin/staging` equals `git diff --numstat <c>^ <c>`. If a
  branch is a parallel rewrite of work already on staging, keep staging's version and port
  only what staging lacks. Keep the merge open so it records both parents.
- Before deleting files or code, check twice that nothing still uses them.

## Verifying changes (the bar used so far)

Frontend, from `packages/apps/DigiGold`:

```bash
npx tsc -p tsconfig.json --noEmit --composite false --declaration false --declarationMap false
npx eslint src --quiet
npx jest --ci            # whole suite; expect 0 console errors/warnings in the output
```

- Prettier (repo root): `npx prettier --list-different --end-of-line auto <files>`. Use
  `--end-of-line auto`: the working tree is CRLF (core.autocrlf), so without it every file
  looks unformatted. `lint-staged` formats staged files on commit.
- Plain `tsc -p tsconfig.json` fails (composite project); use the flags above.

Backend, from `packages/servers/MainServerGo`:

```bash
gofmt -l ./internal ./interfaces ./cmd ./events
go build ./... && go vet ./... && go vet -tags=integration ./internal/integration/...
go test -count=1 ./...
go test -tags=integration -count=1 ./internal/integration/...   # needs: docker compose up -d db redis
```

Integration tests wipe `digigold_test` / Redis DB 15 and run in CI (`backend-tests.yml`).
Recent integration tests and migrations 000004/000005 have **only run in CI**, not locally.

Good practice used here: after adding a test, temporarily break the code it protects and
confirm the test fails (a "mutation check"), then restore.

## Frontend conventions and gotchas

- **Static export:** no server rendering at request time. `useSearchParams` needs a
  `<Suspense>` boundary and makes that subtree client-only (the jewellery pages use
  `fallback={null}`, so they have no catalogue content in static HTML). `redirect()` in a
  page only runs in the browser.
- **API client** (`lib/api/client.ts`): rejects with `NormalizedApiError`
  `{ message, code, status, extra? }`. `code` is MainServer's error `name`
  (e.g. `CASH_LIMIT_EXCEEDED`), `status` is `null` for no response/timeout, `extra` carries
  details (e.g. `{ attempts_left }`). Use `isNormalizedApiError` and `describeApiError`.
  Default timeout 15 s; `/tenant/info` uses 4 s.
- **Services and sample mode:** each `*.service.ts` switches to `*.mock.ts` behind an env
  flag. Mocks must behave like MainServer (same error codes, limits, idempotency).
- **Tenant config:** `selectTenantConfig` applies build switches (jewellery off in
  production). `tenant.resolved` is false until the host's config arrives or fails; home
  jewellery sections render nothing until then, the catalogue renders its shell and waits only
  for designs.
- **Shared UI:** `components/admin/PagedTable` is the frame for every paged admin table
  (title, actions, toolbar, rows-per-page, loading/error/empty states, pagination, optional
  total). Use it instead of re-implementing. Also `common/Modal`, `common/Drawer`,
  `common/Toast` (`useToast`), `common/Button`, `common/Badge`.
- **Styling:** CSS custom properties/tokens (`var(--color-*)`, `--space-*`), mixins in
  `src/styles/_mixins.scss` (`stacked-table` turns tables into cards on phones and resets
  `min-width`, so pass a table's width as a CSS variable, not inline `min-width`).
- **Tests (Jest + SWC):** `jest.mock` is **not hoisted** when `jest` is imported from
  `@jest/globals`, so prefer rendering with a real Redux `Provider`/`QueryClient`, or use the
  global `jest`. Variables used inside `jest.mock` factories must start with `mock`.
  Components that read Redux need a Provider (`test-utils/renderWithProviders`, or
  `components/jewellery/testUtils.tsx` `renderable(ui, { ecommerce, resolved })`).
- Dates shown to staff/customers are IST (`timeZone: 'Asia/Kolkata'`).
- Copy should state only facts the system guarantees (no "usually completed shortly",
  no unbacked privacy or certification claims).

## Backend conventions and gotchas

(Full list in the README "Coding conventions".) Layers: controller → service → repository;
SQL only in repositories with `internal/schema` constants; UUIDs in APIs, internal IDs never
accepted from clients; lock with `SELECT … FOR UPDATE` in a transaction, write the audit event
in the same transaction, `PublishAsync` only after commit; expected failures are sentinel
errors in `interfaces/sentinel_errors.go` mapped in `interfaces/error_translator.go`
(typed errors such as `PickupCodeMismatchError` are handled with `errors.As`); controllers
return errors to `GlobalErrorHandler` and never send `err.Error()` to clients.

- Migrations: `migrations/NNNNNN_name.{up,down}.sql`, embedded; never edit one that has run.
  Current: 000001 init, 000002 user city, 000003 ledger reference index, 000004 KYC review,
  000005 pickup code attempts.
- `system_events.tenant_id` holds either the tenant UUID or its internal numeric ID depending
  on the producer; `GET /admin/events` resolves both and returns the UUID.
- The event consumer (`internal/worker/event_consumer.go`) only acts on `OTPReqEvent` (sends
  the WhatsApp OTP); other events are audit-only and are marked processed.
- Go files are LF (`.gitattributes`); run `gofmt`.

## Environment flags (DigiGold)

| Flag                                                                                | Meaning                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_TENANT_UUID`, `NEXT_PUBLIC_DEFAULT_TENANT` | API and default tenant                                                                                                                                                             |
| `NEXT_PUBLIC_ENABLE_JEWELLERY`                                                      | `true` shows the jewellery catalogue, `false` hides it everywhere; **unset = on in `next dev`/tests, off in `next build`**. Production keeps it off until the catalogue API exists |
| `NEXT_PUBLIC_USE_MOCK_MARKETPLACE` / `…_MARKETPLACE_CATEGORY`                       | Home jewellery sections / jewellery pages use sample data (pages then show a "Sample catalogue" notice)                                                                            |
| `NEXT_PUBLIC_USE_MOCK_ADMIN`                                                        | Admin panel data from sample mocks (`isAdminDataSample()`); `false` in production                                                                                                  |
| `NEXT_PUBLIC_USE_MOCK_AUTH`, `…_ADMIN_AUTH`, `…_MARKET`, `…_PORTFOLIO`              | Other mocks; all `false` in production                                                                                                                                             |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`                                                       | Razorpay key ID only (secret stays on MainServer)                                                                                                                                  |

Templates: `.env.example` (development) and `.env.production.example`. The production
frontend is built from a hand-made, git-ignored `.env.production`, not in CI.

## Business rules in the code

| Rule                         | Value / where                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Online buy needs KYC above   | ₹50,000 (`kycRequiredAboveINR`); tenants in `upfront` KYC mode need it for any buy                                                                                                                                                                                                         |
| Online quote validity        | 15 min (`quoteValidity`); slippage tolerance ₹30/g (`slippageToleranceINR`)                                                                                                                                                                                                                |
| Counter sale                 | Two calls: `POST /admin/store/trade/counter/quote` (server prices at the store's own margin, holds 5 min) then `POST /admin/store/trade/counter {quote_id}`. Recorded under reference `COUNTER_<quote_id>`; confirming the same quote again returns the sale with `already_recorded: true` |
| Cash at the counter          | Refused once a customer's cash today (IST) would reach ₹2,00,000 (Income Tax Act s.269ST), checked at quote and again under the vault lock. Confirm the exact rule with a CA                                                                                                               |
| Pickup (physical redemption) | 6-digit code shown only to the customer; 5 wrong codes lock the request (`423 PICKUP_CODE_LOCKED`, only cancel remains); collect rate limit 30/min per staff login                                                                                                                         |
| KYC decisions                | Only a pending submission with documents can be approved/rejected (`409 KYC_NOT_AWAITING_REVIEW` otherwise); records who (`user_status_approved_by`) and when; writes a `KYC_DECIDED` event; queue ordered by `user_kyc_submitted_at`                                                      |
| Ledger                       | Append-only, signed grams; reversals post a `SYSTEM_REVERSAL` with reference `REVERSAL_<gl_uuid>`; one reversal per entry; a collected redemption can't be reversed                                                                                                                        |
| Audit log                    | `GET /admin/events`, super admin only; secret payload fields (OTP codes, secrets, tokens, passwords, pickup codes) are returned as `[redacted]`; from/to are IST                                                                                                                           |
| Auth rate limit              | 10 requests/min per IP and route on auth endpoints                                                                                                                                                                                                                                         |
| Demo seed                    | Demo store: ₹100/g margin + 3% GST (rate 7313 at ask 7000), 1000 g credit                                                                                                                                                                                                                  |

## Admin panel features (DigiGold `/admin/*`)

Overview, Customers (directory), Counter sale (quote → confirm → receipt), KYC review (queue +
review dialog; Approve disabled without PAN and Aadhaar digits), Pickups (pending with lock
state + "Collected today"), Store ledger (with reversal), Audit log (super admin). Access is
gated by `StoreAccessGate` / `AuditAccessGate`; MainServer enforces roles on every request.

## Open items before release to main

- Run the new integration tests and migrations 000004/000005 locally or confirm CI is green.
- OTP codes and payment-gateway secrets are still stored in plain text in `system_events`
  payloads (masked only when read); the OTP must reach the WhatsApp sender another way first.
- GitHub Production environment and secrets; rotate the Razorpay test key; legal pages.
- Decisions: PAN encryption at rest; KYC required before physical redemption; the hard-coded
  "Market Trading Gate" badge.
- Jewellery catalogue: needs MainServer catalogue endpoints (they must send `categoryId`);
  then set `NEXT_PUBLIC_ENABLE_JEWELLERY=true` and the marketplace mock flags `false`.
- The jewellery pages are not prerendered (Suspense + `useSearchParams`); prerendering the
  shell would mean reading filters outside the Suspense boundary.

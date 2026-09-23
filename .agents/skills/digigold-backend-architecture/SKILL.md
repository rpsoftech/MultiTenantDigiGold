# SKILL: Backend Architecture & Engineering Standards

## 1. Non-Negotiable Core Laws

- **Strict Three-Tier Separation:** Controllers handle routes and parsing (zero business logic), Services orchestrate transactions and logic (zero raw SQL), and Repositories exclusively handle data access.
- **Zero Magic Strings:** Hardcoding SQL table or column names is strictly forbidden; all identifiers must reference constants in `package schema`.
- **Dual-ID Isolation:** Internal database indexing uses `BIGSERIAL` (hidden via `json:"-"`), while APIs expose cryptographically secure `UUID`s.
- **Strict Singletons (`sync.Once`):** Repositories, Services, and Controllers are instantiated exactly once at boot, preventing per-request memory allocation.
- **Boot-Time Prepared Statements:** All SQL statements must be pre-compiled (`db.Db.Prepare`) during repository initialization.
- **Row-Level Locking:** All mutable state changes (e.g., balances) must utilize PostgreSQL `SELECT ... FOR UPDATE` inside an explicit `*sql.Tx` block.
- **Signed Ledger Arithmetic:** Financial balances must use signed quantities (`+` for credit, `-` for debit) and compute via mathematical summation.
- **Mandatory Row Scan Error Checks:** Every `rows.Next()` loop must explicitly conclude with a `rows.Err()` check to prevent silent data truncation.
- **Event Sourcing (Time Machine):** Every state-changing transaction must append an immutable audit record to `system_events` within the same database transaction.
- **Bounded Goroutines:** Every asynchronous goroutine must be passed a detached `context.WithTimeout` to prevent zombie process leaks.

## 2. Centralized Schema & Domain Models\* **Schema Registry:** `internal/schema/tables.go` and `internal/schema/columns.go` maintain all database strings (e.g., `TableSystemEvents`, `ColEventID`).

- **Domain Models:** Structs in `internal/models/` map directly to the schema, utilizing `json.RawMessage` for JSONB data and `time.Time` for timestamps.

## 3. Repository Layer Architecture\* Repositories must initialize as thread-safe singletons via `sync.Once`.

- They must implement Query-Hash caching for read operations and invalidate Redis caches asynchronously with bounded contexts.
- They must support both standalone execution and transaction-aware execution (using `tx.StmtContext`).

## 4. Service Layer Architecture\* Services act as the core brain, coordinating business logic, enforcing domain boundaries, and validating pricing slippage.

- They orchestrate transactions by opening the `*sql.Tx`, executing repository methods, and committing the transaction atomically.

## 5. Event Stream & Background Consumer Pattern\* Heavy, external, or non-critical tasks (like hedging or webhooks) are consumed asynchronously by dedicated background workers.

- Consumers use `SELECT ... FOR UPDATE SKIP LOCKED` to safely fetch unprocessed events from `system_events` without blocking concurrent workers.

## 6. Controller & Fiber API Layer\* Controllers handle input validation and Server-Sent Events (SSE) streaming.

- SSE streams use zero-allocation fan-out, formatting data exactly once in a centralized Hub and broadcasting pre-formatted strings to clients.
- Stream writers explicitly call `w.Flush()` before blocking loops to instantly establish TCP connections.

## 7. Global Error Handling & Sentry Observability\* All API errors must return a standardized JSON structure (`success`, `error`, `request_id`).

- A centralized Fiber middleware captures 500-level status codes and unhandled panics, stripping raw DB stack traces and dispatching enriched alerts to Sentry.

## 8. Anti-Patterns (STRICTLY BANNED)

- ❌ NO raw SQL query strings inside Service or Controller files.
- ❌ NO hardcoded column or table strings.
- ❌ NO unbuffered or unbounded goroutines without `context.WithTimeout`.
- ❌ NO exposing internal `BIGSERIAL` IDs in API JSON tags.
- ❌ NO allocating new Repository or Service structs per HTTP request.
- ❌ NO skipping `rows.Err()` checks after `rows.Next()` loops.
- ❌ NO calling third-party external HTTP APIs inside PostgreSQL transaction blocks.
- ❌ NO formatting SSE payloads inside individual client fan-out loops.

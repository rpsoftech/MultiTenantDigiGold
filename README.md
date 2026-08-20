# DigiGold

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/js?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Generate a library

```sh
npx nx g @nx/js:lib packages/pkg1 --publishable --importPath=@my-org/pkg1
```

## Run tasks

To build the library use:

```sh
npx nx build pkg1
```

To run any task with Nx use:

```sh
npx nx <target> <project-name>
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Versioning and releasing

To version and release the library use

```
npx nx release
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Keep TypeScript project references up to date

Nx automatically updates TypeScript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files to ensure they remain accurate based on your project dependencies (`import` or `require` statements). This sync is automatically done when running tasks such as `build` or `typecheck`, which require updated references to function correctly.

To manually trigger the process to sync the project graph dependencies information to the TypeScript project references, run the following command:

```sh
npx nx sync
```

You can enforce that the TypeScript project references are always in the correct state when running in CI by adding a step to your CI job configuration that runs the following command:

```sh
npx nx sync:check
```

# Digi Gold Multi-Tenant Platform (Backend Phase 1)

A high-performance, multi-tenant backend engine designed to handle concurrent digital gold spot trading, automated SIPs, and frictionless offline physical redemptions.

## Tech Stack

- **Language:** Go (Golang)
- **Primary Database:** PostgreSQL 13+ (Relational, ACID-compliant ledger)
- **In-Memory Cache & Queues:** Redis (Live spot rate ticker, OTPs, short-lived states)

## Core Architectural Principles

### 1. Absolute Multi-Tenancy (Row-Level Security)

This platform serves multiple independent retail jewelry shops. **Every API request MUST be intercepted by the `tenancy.go` middleware.**

- The middleware extracts the `tenant_uuid` from the request header or subdomain.
- It injects the internal `tenant_id` into the Go `context.Context`.
- Database repositories must strictly append `WHERE tenant_id = ?` to all operations to guarantee absolute data isolation.

### 2. Dual-ID Database Pattern

To ensure maximum internal join performance while maintaining public API security:

- **Internal DB Operations:** Use standard `BIGSERIAL` integer IDs (e.g., `user_id`, `tenant_id`) for hyper-fast SQL `JOIN`s and foreign key relationships.
- **Public REST API / Frontend:** Expose and consume only `UUID`s (e.g., `user_uuid`, `tenant_uuid`). The repository layer is responsible for translating the UUID back to the internal integer ID.

### 3. The Schema Registry & Prepared Statements

Do **not** hardcode SQL strings or column names across multiple files.

- All database table and column names live exclusively as constants inside `internal/schema/`.
- High-traffic endpoints (like Spot Trading) must utilize `sql.Stmt` (Prepared Statements) loaded into memory on server boot via `internal/repository/registry.go` to minimize database parsing overhead during spikes in concurrent traffic.

### 4. Fractional Math

All gold weights are strictly calculated and stored at a 4-decimal precision (e.g., `12.4500g`) utilizing `DECIMAL(14,4)` in PostgreSQL to prevent floating-point rounding errors.

## Folder Structure (Domain-Driven Design)

- `/cmd/api/` - The entry point. Initializes database/Redis connections and starts the HTTP server.
- `/internal/schema/` - Centralized registry for all database table/column constants.
- `/internal/models/` - Struct definitions representing database rows.
- `/internal/repository/` - The only layer allowed to communicate with PostgreSQL. Houses prepared statements.
- `/internal/service/` - The business logic brain (calculates GST, validates KYC limits).
- `/internal/api/` - HTTP delivery layer (Request decoding, routing, and JSON responses).
- `/internal/middleware/` - Request interceptors (JWT validation, Tenancy extraction).
- `/pkg/` - Shared, independent utilities (Redis connections, external WhatsApp APIs).

## Quickstart (Development)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd digigold-backend
   ```

# Plan: User Registration & Authentication (OTP Verification)

Implement a secure, multi-tenant OTP verification and user registration flow using JWT tokens, while fixing critical bugs in the existing Go backend.

## Steps

### Phase 1: Fix Existing Critical Bugs

1. **Tenant Repository Deadlock/Panic**:
   - File: `packages/servers/MainServerGo/internal/repository/tenant_repo.go`
   - Fix `TenantUUIDtoID` to call `r.uuidMapMutex.Unlock()` instead of `r.uuidMapMutex.RUnlock()` after `r.uuidMapMutex.Lock()`.
2. **Tenant Config Repository UUID Lookup Bug**:
   - File: `packages/servers/MainServerGo/internal/repository/tenant_config_repo.go`
   - Update `stmtGetByTenantUUID` to join with the `tenants` table so that it correctly queries by the tenant's UUID (`tenant_uuid`) instead of the config's UUID (`tic_uuid`).
3. **API Server Environment Loading Bug**:
   - File: `packages/servers/MainServerGo/cmd/api/main.go`
   - Call `env.LoadEnv(env.ENV_FILE_NAME)` at the very beginning of `main()` to ensure environment variables are loaded and validated before initializing the database and Redis.
4. **Database Schema Nullability Fix**:
   - File: `packages/servers/MainServerGo/posgrest.scema.sql`
   - Alter the `users` table to make `user_status_approved_by` nullable, allowing self-registered users to exist without an immediate admin approval reference.

### Phase 2: Add JWT Library & Utility

1. **Add JWT Dependency**:
   - File: `packages/servers/MainServerGo/go.mod`
   - Add `github.com/golang-jwt/jwt/v5` to the dependencies.
2. **Create JWT Utility**:
   - File: `packages/servers/MainServerGo/utility/jwt/jwt.go` (New File)
   - Implement functions to:
     - Generate Access Tokens (short-lived, e.g., 15 minutes) and Refresh Tokens (long-lived, e.g., 7 days) containing `user_uuid`, `tenant_uuid`, and `phone`.
     - Validate Access and Refresh Tokens.
     - Generate and validate short-lived Registration Tokens (e.g., 10 minutes) containing the verified phone number and tenant UUID.

### Phase 3: Implement JWT Authentication Middleware

1. **Create Auth Middleware**:
   - File: `packages/servers/MainServerGo/internal/middleware/auth_middleware.go` (New File)
   - Implement `UserAuthInterceptor` to:
     - Extract the Bearer token from the `Authorization` header.
     - Validate the token and ensure the tenant UUID in the token matches the tenant UUID in the request header (injected by `TenantInterceptor`).
     - Inject the `user_uuid` and `phone` into the Fiber context locals.

### Phase 4: Update OTP Service & Controller

1. **Update OTP Service**:
   - File: `packages/servers/MainServerGo/internal/service/otp.service.go`
   - Refactor `SendLoginOTP` to a unified `SendOTP` method that does not fail if the user is not found. If the user is not found, it should proceed with a default name (e.g., `"Customer"`) and return `isRegistered = false`.
   - Update `VerifyOTP` to return `isRegistered = bool` and a `registrationToken` (if not registered) or the user details (if registered).
2. **Update Auth Controller**:
   - File: `packages/servers/MainServerGo/internal/api/auth/auth_controller.go`
   - Update `RequestOTP` to return `is_registered` in the JSON response.
   - Add `VerifyOTP` handler (`POST /api/v1/auth/otp/verify`) to verify the OTP. If the user is registered, return JWT Access and Refresh tokens. If not registered, return a signed `registration_token`.
   - Add `Register` handler (`POST /api/v1/auth/register`) to accept the `registration_token`, `full_name`, and optional `email_id`. Validate the token, create the user in the database, and return the final JWT Access and Refresh tokens.

### Phase 5: Register Routes

1. **Register Routes in API Server**:
   - File: `packages/servers/MainServerGo/cmd/api/main.go`
   - Register `POST /api/v1/auth/otp/verify` under the `auth` group.
   - Register `POST /api/v1/auth/register` under the `auth` group.

## Relevant files

- `packages/servers/MainServerGo/internal/repository/tenant_repo.go` — Fix deadlock in `TenantUUIDtoID`.
- `packages/servers/MainServerGo/internal/repository/tenant_config_repo.go` — Fix UUID lookup query in `stmtGetByTenantUUID`.
- `packages/servers/MainServerGo/cmd/api/main.go` — Load environment variables and register new routes.
- `packages/servers/MainServerGo/posgrest.scema.sql` — Make `user_status_approved_by` nullable.
- `packages/servers/MainServerGo/go.mod` — Add JWT dependency.
- `packages/servers/MainServerGo/utility/jwt/jwt.go` — Implement JWT token generation and validation.
- `packages/servers/MainServerGo/internal/middleware/auth_middleware.go` — Implement JWT validation middleware.
- `packages/servers/MainServerGo/internal/service/otp.service.go` — Refactor OTP sending and verification logic.
- `packages/servers/MainServerGo/internal/api/auth/auth_controller.go` — Implement OTP verification and registration handlers.

## Verification

1. **Database Schema Update**: Run the SQL command to alter the `users` table and verify it succeeds.
2. **Unit Tests**: Write unit tests for JWT utility functions (`GenerateTokens`, `ValidateToken`, `GenerateRegistrationToken`, `ValidateRegistrationToken`).
3. **Integration Tests**:
   - Test `POST /api/v1/auth/otp/request` for both registered and unregistered numbers.
   - Test `POST /api/v1/auth/otp/verify` with correct and incorrect OTPs.
   - Test `POST /api/v1/auth/register` with valid and invalid registration tokens.
   - Test accessing a protected route with valid, expired, and missing JWT access tokens.

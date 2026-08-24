# Implementation Plan

[Overview]
Implement the core business engine for trade execution and hedging state management.

This implementation covers Phase 2 of the Digi Gold execution plan. It introduces the Trade Execution Service, which performs real-time slippage validation (±30 INR per gram tolerance) and atomically processes gold purchases or redemptions by writing to the ledger and event store within a single database transaction. It also introduces the Master Hedging Service, which centralizes the fractional accumulation state logic (read/write to the hedging buffer) that will be consumed later by the background hedging worker. All implementations must adhere to the rules defined in `SKILLS.md`.

[Types]
Definition of new transactional and request interfaces for the trade process.

- `interfaces.TradeExecutionRequest`:
  - `TenantID int64`
  - `UserID int64`
  - `RequestedRatePerGram float64` (Client's expected final rate per gram)
  - `WeightGrams float64` (Requested weight)
  - `TotalAmountINR float64` (Total value including 3% GST)
  - `PaymentMode string` (ONLINE_PG, COUNTER_CASH, COUNTER_UPI)
  - `ReferenceID string` (Payment Reference ID)
- `events.tradeEvent`:
  - Inherits from `events.BaseEvent`
  - Event payload containing the finalized `models.GoldTransactionLedger` state.
- `models.MarginConfig`:
  - Contains margin data sourced from `margin_configurations` table.

[Files]
Additions for services, models, and repositories.

- `Packages/servers/MainServerGo/internal/models/margin_config.go` (New): Struct representing the `margin_configurations` table.
- `Packages/servers/MainServerGo/internal/repository/margin_repo.go` (New): Repository to fetch `margin_configurations` given a TenantID and CommodityType.
- `Packages/servers/MainServerGo/interfaces/trade_req.interface.go` (New): Contains the `TradeExecutionRequest` struct.
- `Packages/servers/MainServerGo/events/trade.events.go` (New): Contains event definitions for `GoldPurchaseEvent`.
- `Packages/servers/MainServerGo/internal/repository/gold_ledger_repo.go` (Modify): Add `GetLastBalanceForUpdateWithTx` and `InsertLedgerEntryWithTx` methods.
- `Packages/servers/MainServerGo/internal/repository/event_repo.go` (Modify): Add `InsertEventWithTx` method.
- `Packages/servers/MainServerGo/internal/service/trade_service.go` (New): Implements `ExecuteTrade` wrapping slippage validation, SQL Tx orchestration, ledger insertion, and event sourcing.
- `Packages/servers/MainServerGo/internal/service/hedging_service.go` (New): Implements `UpdateHedgingBuffer` to manage the unhedged fraction accumulation in `master_hedging_state`.

[Functions]
Key service methods to enforce business rules.

- `trade_service.go -> ExecuteTrade(ctx, req TradeExecutionRequest) (*models.GoldTransactionLedger, error)`: Fetches live rate from Redis and tenant margin. Calculates final rate (apply margins + 3% GST). Validates slippage against RequestedRatePerGram ± 30 INR per gram. Opens a PG Tx, locks user's current DB ledger balance, calculates new offset balance, inserts new ledger row, emits system event, commits Tx.
- `hedging_service.go -> UpdateHedgingBuffer(ctx context.Context, additionalGrams float64) error`: Opens a Tx, locks the hedging state via `GetStateForUpdateWithTX`, adds `additionalGrams` to `unhedged_grams`, updates via `UpdateStateWithTX`, commits Tx.
- `margin_repo.go -> GetMarginByTenant(ctx, tenantID, commodityType) (*models.MarginConfig, error)`: Retrieves margin properties for slippage math.
- `gold_ledger_repo.go -> GetLastBalanceForUpdateWithTx`, `InsertLedgerEntryWithTx`: Transactional executor bindings for prepared statements.
- `event_repo.go -> InsertEventWithTx`: Transactional executor binding for prepared statements.

[Classes]
Go structs to act as Singletons representing the Trade and Hedging services.

- `service.TradeService`: Holds pointers to `GoldLedgerRepository`, `EventRepository`, `MarginRepository`, and the Postgres Database connection for transactions.
- `service.HedgingService`: Holds a pointer to `HedgingRepository` and Postgres database for transaction management.
- `repository.MarginRepository`: Singleton wrapper around prepared statements for `margin_configurations`.

[Dependencies]
No new external library dependencies are required.

Will leverage existing Redis utility for live rate extraction and `database/sql` for transactions. Code logic expects GST standard application at 3%.

[Testing]
Ensure transactional atomicity and slippage bounds.

- Table-driven unit tests functionality for slippage logic (mocking Redis rate + applying 3% GST + margins vs requested rate).
- Verification that `ExecuteTrade` correctly throws an error if rate deviation > 30 INR per gram.
- Verifying the Tx rollback logic on database insertion failures.

[Implementation Order]
Step-by-step sequence to guarantee safe database interaction.

1. Implement `models.MarginConfig` and `repository.MarginRepository` to fetch tenant margin data.
2. Extend `gold_ledger_repo.go` and `event_repo.go` with explicit `*sql.Tx` passed methods.
3. Implement `interfaces.TradeExecutionRequest` and `events.trade.events.go`.
4. Implement `HedgingService` with `UpdateHedgingBuffer` utilizing the transaction block and `HedgingRepository`.
5. Implement `TradeService` starting with the private `validateSlippage` helper method (3% GST, ±30 INR per gram tolerance).
6. Complete `TradeService.ExecuteTrade` to orchestrate ledger insertion and event injection inside a unified DB transaction.

Note: All code must strictly adhere to the guidelines set forth in `SKILLS.md`, ensuring correct singleton patterns, error handling, thread safety, and response formatting.

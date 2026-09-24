package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"fmt"
	"log"
	"math"
	"math/big"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
)

// Redemption is the only way gold leaves a customer's vault: the customer
// requests grams in the app, the grams are debited at once, and the customer
// collects the physical gold at the store counter with a pickup code.

// newPickupCode returns a random 6-digit code.
func newPickupCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("failed to generate pickup code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// RequestRedemption debits weightGrams from the customer's vault and creates a
// PENDING redemption request with a pickup code.
func (s *TradeService) RequestRedemption(ctx context.Context, tenantID, userID int64, weightGrams float64, ipAddress string) (*models.RedemptionRequest, error) {
	weight := math.Round(weightGrams*10000) / 10000
	if weight <= 0 {
		return nil, interfaces.ErrInvalidTradePayload
	}

	code, err := newPickupCode()
	if err != nil {
		return nil, err
	}

	// No money changes hands. The live bid is recorded for reference only, so a
	// missing rate feed must not block a redemption.
	var refRate float64
	if rate, err := s.liveRate(ctx); err == nil {
		refRate = rate.Bid
	}

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	entry := &models.GoldTransactionLedger{
		TenantID:         tenantID,
		UserID:           userID,
		EventType:        ledgerEventRedemption,
		PaymentMode:      "NONE",
		WeightGrams:      -weight,
		TotalAmountINR:   0,
		MCXBaseRate:      refRate,
		FinalRatePerGram: refRate,
	}
	// RecordTransactionWithTX locks the user row and rejects an overdraw.
	ledger, event, err := s.recordLedgerMovementWithTX(ctx, tx, entry, ipAddress, "CUSTOMER")
	if err != nil {
		return nil, err
	}

	rr := &models.RedemptionRequest{
		TenantID:    tenantID,
		UserID:      userID,
		LedgerID:    ledger.ID,
		LedgerUUID:  ledger.UUID,
		WeightGrams: weight,
		PickupCode:  code,
	}
	if err := s.RedemptionRepo.CreateWithTX(ctx, tx, rr); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit redemption: %w", err)
	}
	s.EventRepo.PublishAsync(event)

	log.Printf("[TradeService] Redemption requested: tenantID=%d, userID=%d, weight=%f, redemption=%s",
		tenantID, userID, weight, rr.UUID)
	return rr, nil
}

// CollectRedemption marks a PENDING request as handed over at the counter.
// Staff must enter the customer's pickup code.
func (s *TradeService) CollectRedemption(ctx context.Context, tenantID int64, redemptionUUID, pickupCode, adminUUID, ipAddress string) (*models.RedemptionRequest, error) {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	rr, err := s.RedemptionRepo.GetForUpdateWithTX(ctx, tx, tenantID, redemptionUUID)
	if err != nil {
		return nil, err
	}
	if rr.Status != models.RedemptionPending {
		return nil, interfaces.ErrRedemptionNotPending
	}
	if subtle.ConstantTimeCompare([]byte(rr.PickupCode), []byte(pickupCode)) != 1 {
		return nil, interfaces.ErrInvalidPickupCode
	}

	if err := s.RedemptionRepo.MarkCollectedWithTX(ctx, tx, rr.ID, adminUUID); err != nil {
		return nil, err
	}
	rr.Status = models.RedemptionCollected
	rr.PickupCode = "" // never echo the code back to staff or into the event log

	collected := events.GenerateRedemptionCollectedEvent(fmt.Sprintf("%d", tenantID), adminUUID, ipAddress, rr)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, &collected.BaseEvent); err != nil {
		return nil, fmt.Errorf("failed to save redemption event: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit redemption collection: %w", err)
	}
	s.EventRepo.PublishAsync(&collected.BaseEvent)
	return rr, nil
}

// CancelRedemption cancels a PENDING request and returns its grams to the vault
// by reversing the ledger debit. Collected requests cannot be cancelled.
// ownerUserID > 0 restricts the cancel to that customer's own request.
func (s *TradeService) CancelRedemption(ctx context.Context, tenantID int64, redemptionUUID string, ownerUserID int64, actorID, ipAddress string) (*models.GoldTransactionLedger, error) {
	ledgerUUID, err := s.redemptionLedgerUUID(ctx, tenantID, redemptionUUID, ownerUserID)
	if err != nil {
		return nil, err
	}
	// ReverseTransaction re-checks and cancels the PENDING request under lock.
	return s.ReverseTransaction(ctx, tenantID, ledgerUUID, actorID, ipAddress)
}

func (s *TradeService) redemptionLedgerUUID(ctx context.Context, tenantID int64, redemptionUUID string, ownerUserID int64) (string, error) {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	rr, err := s.RedemptionRepo.GetForUpdateWithTX(ctx, tx, tenantID, redemptionUUID)
	if err != nil {
		return "", err
	}
	if ownerUserID > 0 && rr.UserID != ownerUserID {
		return "", interfaces.ErrRedemptionNotFound
	}
	if rr.Status != models.RedemptionPending {
		return "", interfaces.ErrRedemptionNotPending
	}
	return rr.LedgerUUID, nil
}

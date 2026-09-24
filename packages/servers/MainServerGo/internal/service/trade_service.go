package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/constants"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

var (
	tradeServiceInstance *TradeService
	tradeServiceOnce     sync.Once
)

type TradeService struct {
	DB             *postgres.PostgresDBStruct
	Redis          *redis_client.RedisClientStruct
	LedgerRepo     *repository.GoldLedgerRepository
	EventRepo      *repository.EventRepository
	MarginRepo     *repository.MarginRepository
	RedemptionRepo *repository.RedemptionRepository
}

func InitTradeService() *TradeService {
	tradeServiceOnce.Do(func() {
		tradeServiceInstance = &TradeService{
			DB:             postgres.GetPostgresDB(),
			Redis:          redis_client.InitRedisClient(),
			LedgerRepo:     repository.InitGoldLedgerRepo(),
			EventRepo:      repository.GetEventRepository(),
			MarginRepo:     repository.InitMarginRepository(),
			RedemptionRepo: repository.InitRedemptionRepo(),
		}
	})
	return tradeServiceInstance
}

const (
	ledgerEventReversal     = "SYSTEM_REVERSAL"
	ledgerEventRedemption   = "PHYSICAL_REDEMPTION"
	reversalReferencePrefix = "REVERSAL_"

	// quoteValidity is how long a priced online order may wait for its payment.
	quoteValidity = 15 * time.Minute
)

type rateSnapshot struct {
	Ask float64 `json:"ask"`
	Bid float64 `json:"bid"`
}

// TradeQuote is the server-side price and size of a trade. Online buys lock a
// quote when the order is created and execute it when the payment is captured.
type TradeQuote struct {
	FinalRatePerGram float64 `json:"final_rate_per_gram"`
	MCXBaseRate      float64 `json:"mcx_base_rate"`
	MarginApplied    float64 `json:"margin_applied"`
	GSTApplied       float64 `json:"gst_applied"`
	WeightGrams      float64 `json:"weight_grams"`
	TotalAmountINR   float64 `json:"total_amount_inr"`
	ExpiresAt        int64   `json:"expires_at"` // unix seconds
}

// Expired reports whether the quote can no longer be executed at time now.
func (q *TradeQuote) Expired(now time.Time) bool {
	return now.Unix() > q.ExpiresAt
}

func isDebitAction(action string) bool {
	return action == "SELL" || action == "REDEEM"
}

// ledgerEventType maps a trade action to its gold_transaction_ledger event type.
func ledgerEventType(action string) string {
	switch action {
	case "SELL":
		return "GOLD_SELL"
	case "REDEEM":
		return ledgerEventRedemption
	default:
		return "GOLD_PURCHASE"
	}
}

// sizeTrade derives the traded grams and INR amount from either a weight or an amount.
func sizeTrade(weightGrams, totalAmountINR, finalRate float64) (weight, total float64, err error) {
	if weightGrams > 0 {
		weight = math.Round(weightGrams*10000) / 10000
		total = math.Round((weight*finalRate)*100) / 100
	} else if totalAmountINR > 0 {
		total = math.Round(totalAmountINR*100) / 100
		weight = math.Round((total/finalRate)*10000) / 10000
	} else {
		return 0, 0, interfaces.ErrInvalidTradePayload
	}
	if weight <= 0 || total <= 0 {
		return 0, 0, interfaces.ErrInvalidTradePayload
	}
	return weight, total, nil
}

func (s *TradeService) validateSlippage(ctx context.Context, tenantID int64, requestedRate float64, action string) (finalRate, mcxRate, marginApplied, gstApplied float64, err error) {
	rateStr, err := s.Redis.GetHashKeyWithOriginalKey(ctx, constants.RedisKeyLatestRawRate, "GOLD")
	if err != nil || rateStr == "" {
		return 0, 0, 0, 0, fmt.Errorf("failed to fetch live rate from Redis: %w", err)
	}

	var rate rateSnapshot
	if err := json.Unmarshal([]byte(rateStr), &rate); err != nil {
		return 0, 0, 0, 0, fmt.Errorf("failed to parse live rate: %w", err)
	}

	if isDebitAction(action) {
		mcxRate = rate.Bid
	} else {
		mcxRate = rate.Ask
	}

	margin, err := s.MarginRepo.GetMarginByTenant(ctx, tenantID, "GOLD")
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("failed to get margin config: %w", err)
	}

	switch margin.SellMarginType {
	case "FIXED_INR", "FLAT":
		marginApplied = margin.SellMarginValue
	case "PERCENTAGE":
		marginApplied = mcxRate * (margin.SellMarginValue / 100.0)
	}

	if isDebitAction(action) {
		rateWithMargin := mcxRate - marginApplied
		gstApplied = 0
		finalRate = rateWithMargin
	} else {
		rateWithMargin := mcxRate + marginApplied
		if margin.IsGSTEnabled {
			gstApplied = rateWithMargin * (margin.GSTPercentage / 100.0)
		}
		finalRate = rateWithMargin + gstApplied
	}

	if math.Abs(finalRate-requestedRate) > 30.0 {
		return 0, 0, 0, 0, fmt.Errorf("%w: expected %f, live %f", interfaces.ErrSlippageExceeded, requestedRate, finalRate)
	}

	return finalRate, mcxRate, marginApplied, gstApplied, nil
}

// PriceTrade checks the requested rate against the live rate and sizes the trade.
func (s *TradeService) PriceTrade(ctx context.Context, req interfaces.TradeExecutionRequest) (*TradeQuote, error) {
	finalRate, mcxRate, marginApplied, gstApplied, err := s.validateSlippage(ctx, req.TenantID, req.RequestedRatePerGram, req.Action)
	if err != nil {
		log.Printf("[TradeService] Slippage validation failed for userID=%d, tenantID=%d: %v", req.UserID, req.TenantID, err)
		return nil, err
	}

	weight, total, err := sizeTrade(req.WeightGrams, req.TotalAmountINR, finalRate)
	if err != nil {
		return nil, err
	}

	return &TradeQuote{
		FinalRatePerGram: finalRate,
		MCXBaseRate:      mcxRate,
		MarginApplied:    marginApplied,
		GSTApplied:       gstApplied,
		WeightGrams:      weight,
		TotalAmountINR:   total,
		ExpiresAt:        time.Now().Add(quoteValidity).Unix(),
	}, nil
}

// QuoteBuy prices an online buy and checks that the tenant's B2B credit can
// cover it, so the customer is never charged for a trade that cannot settle.
func (s *TradeService) QuoteBuy(ctx context.Context, req interfaces.TradeExecutionRequest) (*TradeQuote, error) {
	quote, err := s.PriceTrade(ctx, req)
	if err != nil {
		return nil, err
	}
	if err := s.MarginRepo.CheckCreditCapacity(ctx, req.TenantID, "GOLD", quote.WeightGrams); err != nil {
		return nil, err
	}
	return quote, nil
}

// ExecuteTrade prices the trade against the live rate and records it.
func (s *TradeService) ExecuteTrade(ctx context.Context, req interfaces.TradeExecutionRequest, ipAddress, adminID string) (*models.GoldTransactionLedger, error) {
	if req.Action == "" {
		req.Action = "BUY"
	}
	quote, err := s.PriceTrade(ctx, req)
	if err != nil {
		return nil, err
	}
	return s.ExecuteQuotedTrade(ctx, req, quote, ipAddress, adminID)
}

// ExecuteQuotedTrade records a trade at an already computed quote. The caller
// must check that the quote is still valid.
func (s *TradeService) ExecuteQuotedTrade(ctx context.Context, req interfaces.TradeExecutionRequest, quote *TradeQuote, ipAddress, adminID string) (*models.GoldTransactionLedger, error) {
	if req.Action == "" {
		req.Action = "BUY"
	}

	log.Printf("[TradeService] ExecuteTrade (%s): tenantID=%d, userID=%d, rate=%f, weight=%f, amount=%f, ip=%s",
		req.Action, req.TenantID, req.UserID, quote.FinalRatePerGram, quote.WeightGrams, quote.TotalAmountINR, ipAddress)

	finalWeight := quote.WeightGrams
	if isDebitAction(req.Action) {
		finalWeight = -finalWeight
	}

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	entry := &models.GoldTransactionLedger{
		TenantID:            req.TenantID,
		UserID:              req.UserID,
		EventType:           ledgerEventType(req.Action),
		PaymentMode:         req.PaymentMode,
		WeightGrams:         finalWeight,
		TotalAmountINR:      quote.TotalAmountINR,
		MCXBaseRate:         quote.MCXBaseRate,
		MasterMarginApplied: 0,
		TenantMarginApplied: quote.MarginApplied,
		GSTApplied:          quote.GSTApplied,
		FinalRatePerGram:    quote.FinalRatePerGram,
		ReferenceID:         req.ReferenceID,
	}

	result, err := s.LedgerRepo.RecordTransactionWithTX(ctx, tx, entry)
	if err != nil {
		return nil, err
	}

	if req.Action == "REDEEM" {
		addressJSON, _ := json.Marshal(req.ShippingAddress)
		fulfillment := &models.RedemptionFulfillment{
			TenantID:           req.TenantID,
			UserID:             req.UserID,
			LedgerID:           result.ID,
			ItemSKU:            "CUSTOM_GRAMS", // Or parse from req
			FulfillmentStatus:  "PENDING",
			ShippingDetailJSON: addressJSON,
		}
		if err := s.RedemptionRepo.CreateRedemptionFulfillmentWithTX(ctx, tx, fulfillment); err != nil {
			return nil, fmt.Errorf("failed to save redemption details: %w", err)
		}
	}

	// Every signed ledger movement is published as one trade event; the hedging
	// consumer applies its signed weight to the platform exposure.
	tenantIdStr := fmt.Sprintf("%d", req.TenantID)
	tradeEvent := events.GenerateGoldPurchaseEvent(tenantIdStr, adminID, ipAddress, result)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, &tradeEvent.BaseEvent); err != nil {
		return nil, fmt.Errorf("failed to save trade event: %w", err)
	}

	if err := s.MarginRepo.IncrementUnliftedGramsWithTx(ctx, tx, req.TenantID, "GOLD", finalWeight); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	s.EventRepo.PublishAsync(&tradeEvent.BaseEvent)

	log.Printf("[TradeService] Trade successful: tenantID=%d, userID=%d, weight=%f, amount=%f, ledgerUUID=%s",
		req.TenantID, req.UserID, finalWeight, quote.TotalAmountINR, result.UUID)

	return result, nil
}

func (s *TradeService) ReverseTransaction(ctx context.Context, tenantID int64, ledgerUUID string, adminID string, ipAddress string) (*models.GoldTransactionLedger, error) {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Lock the original row so two concurrent reversals serialize here.
	original, err := s.LedgerRepo.GetEntryForUpdateWithTX(ctx, tx, tenantID, ledgerUUID)
	if err != nil {
		return nil, err
	}
	if original.EventType == ledgerEventReversal {
		return nil, interfaces.ErrLedgerNotReversible
	}

	// 2. Each entry may be reversed only once.
	reversalRef := reversalReferencePrefix + ledgerUUID
	alreadyReversed, err := s.LedgerRepo.ReferenceExistsWithTX(ctx, tx, tenantID, reversalRef)
	if err != nil {
		return nil, err
	}
	if alreadyReversed {
		return nil, interfaces.ErrLedgerAlreadyReversed
	}

	// A redemption may be reversed only while its shipment is still pending; the
	// shipment is cancelled in the same transaction so it can no longer be fulfilled.
	if original.EventType == ledgerEventRedemption {
		if err := s.RedemptionRepo.CancelPendingByLedgerWithTX(ctx, tx, tenantID, original.ID); err != nil {
			return nil, err
		}
	}

	reversalEntry := &models.GoldTransactionLedger{
		TenantID:            tenantID,
		UserID:              original.UserID,
		EventType:           ledgerEventReversal,
		PaymentMode:         "NONE", // payment_mode_enum has no SYSTEM value
		WeightGrams:         -original.WeightGrams,
		TotalAmountINR:      -original.TotalAmountINR,
		MCXBaseRate:         original.MCXBaseRate,
		MasterMarginApplied: 0,
		TenantMarginApplied: -original.TenantMarginApplied,
		GSTApplied:          -original.GSTApplied,
		FinalRatePerGram:    original.FinalRatePerGram,
		ReferenceID:         reversalRef,
	}

	// RecordTransactionWithTX rejects the reversal if it would make the balance negative
	// (e.g. reversing a purchase whose gold was already sold).
	result, err := s.LedgerRepo.RecordTransactionWithTX(ctx, tx, reversalEntry)
	if err != nil {
		return nil, err
	}

	tenantIdStr := fmt.Sprintf("%d", tenantID)
	reversalEvent := events.GenerateGoldPurchaseEvent(tenantIdStr, adminID, ipAddress, result)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, &reversalEvent.BaseEvent); err != nil {
		return nil, fmt.Errorf("failed to save reversal event: %w", err)
	}

	if err := s.MarginRepo.IncrementUnliftedGramsWithTx(ctx, tx, tenantID, "GOLD", -original.WeightGrams); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit reversal: %w", err)
	}
	s.EventRepo.PublishAsync(&reversalEvent.BaseEvent)

	return result, nil
}

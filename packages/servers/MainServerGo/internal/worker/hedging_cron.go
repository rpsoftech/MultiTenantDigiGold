package workers

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

// mockLPHedgingKey enables the hedging cron. Its cycle books simulated LP fills (fixed rate,
// LP_MOCK_ references) because no liquidity provider is integrated yet, so it is off unless
// this is "true", and never runs in PRODUCTION. Without it, unhedged exposure keeps
// accumulating in master_hedging_state until a real LP integration takes it over.
const mockLPHedgingKey = "ENABLE_MOCK_LP_HEDGING"

// MockLPHedgingEnabled reports whether the API should run the (simulated) hedging cron.
func MockLPHedgingEnabled(appEnv env.AppEnv, flag string) bool {
	return flag == "true" && appEnv != env.APP_ENV_PRODUCTION
}

// StartHedgingCron runs the hedging cycle every 10 seconds when MockLPHedgingEnabled.
func StartHedgingCron(ctx context.Context) {
	if !MockLPHedgingEnabled(env.Env.APP_ENV, os.Getenv(mockLPHedgingKey)) {
		log.Printf("ℹ️ Hedging cron off: no LP integration (set %s=true outside PRODUCTION to simulate fills).", mockLPHedgingKey)
		return
	}
	log.Println("🚀 Starting Master Hedging Cron Worker with SIMULATED LP fills (Tick: 10s)...")

	hedgingService := service.InitMasterHedgingService()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Shutting down Master Hedging Cron gracefully...")
			return
		case <-ticker.C:
			cycleCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			if err := hedgingService.ProcessHedgingCycle(cycleCtx); err != nil {
				log.Printf("⚠️ [HedgingCron] Cycle error: %v", err)
			}
			cancel()
		}
	}
}

package workers

import (
	"context"
	"log"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

func StartHedgingCron(ctx context.Context) {
	log.Println("🚀 Starting Master Hedging Cron Worker (Tick: 10s)...")

	hedgingService := service.InitMasterHedgingService()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Shutting down Master Hedging Cron gracefully...")
			return
		case <-ticker.C:
			if err := hedgingService.ProcessHedgingCycle(context.Background()); err != nil {
				log.Printf("⚠️ [HedgingCron] Cycle error: %v", err)
			}
		}
	}
}

package workers

import (
	"context"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/monitoring"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

// StartPartitionCron keeps system_events partitions three months ahead. It runs
// at startup and then every 24 hours.
func StartPartitionCron(ctx context.Context) {
	db := postgres.GetPostgresDB().Db
	run := func() {
		runCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		if err := database.EnsureEventPartitions(runCtx, db); err != nil {
			monitoring.Critical(runCtx, monitoring.KindPartitionMaint, err)
		}
	}

	run()
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

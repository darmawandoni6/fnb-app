package worker

import (
	"context"
	"log/slog"
	"time"

	"fnb-server/internal/usecase"
)

const tickInterval = time.Minute

func RunScheduler(ctx context.Context, u *usecase.SchedulerUsecase, log *slog.Logger) {
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			u.Tick(ctx)
		}
	}
}

package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"fnb-server/internal/config"
	"fnb-server/internal/database"
	"fnb-server/internal/delivery/worker"
	"fnb-server/internal/repository"
	"fnb-server/internal/usecase"
	"fnb-server/pkg/logger"
)

func main() {
	cfg := config.LoadConfig()
	log := logger.New(cfg.Environment, cfg.LogLevel)
	slog.SetDefault(log)

	if err := cfg.Validate(log); err != nil {
		log.Error("configuration validation failed", "error", err)
		os.Exit(1)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Error("database initialization failed", "error", err)
		os.Exit(1)
	}

	// Seed first owner if users table is empty
	userRepo := repository.NewUserRepository(db)
	seedUsecase := usecase.NewSeedUsecase(userRepo, cfg.SeedOwnerEmail, cfg.SeedOwnerPassword, log)
	if err := seedUsecase.SeedOwner(context.Background()); err != nil {
		log.Error("failed to seed owner", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	hub := newHub(ctx)
	scheduler := newSchedulerUsecase(db, hub, log)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		worker.RunScheduler(ctx, scheduler, log)
	}()

	e := newRouter(db, cfg, hub, log)
	if err := e.Start(":" + cfg.Port); err != nil {
		log.Error("API server stopped", "error", err)
	}

	stop()
	wg.Wait()
}

# Concurrency Rules

Use concurrency only when it improves independent I/O, CPU-bound work, or background processing.

## HTTP

Echo already handles requests concurrently. Do not add goroutines in handlers for ordinary CRUD.

## Independent reads

Use `errgroup.WithContext` for independent repository reads. Cancel sibling work when one read fails. Keep shared result writes isolated or synchronized. Reference implementation: `internal/usecase/stock_usecase.go` (`RecipeItemUsecase.Create`).

## Transactions

Never share a transaction `*gorm.DB` across goroutines. Transaction steps must remain sequential in one goroutine so stock updates and movement inserts preserve atomic ordering.

## Database queries

Prefer one set-based query over one goroutine per row. Do not use concurrency to replace `JOIN`, `Preload`, or `IN` queries.

## Background work

Long-running jobs belong in worker processes or managed goroutines with cancellation and graceful shutdown, not inside HTTP handlers.

## WebSocket

One hub: `map[topic]map[*client]struct{}` guarded by a mutex, buffered send channel per client, publish from the goroutine that owns the hub. A client whose buffer is full is dropped, never blocked on. No transaction crosses into the hub.

## Scheduled jobs

One goroutine, one fixed tick. Every job is idempotent and re-selects its candidates each tick. Each job opens its own short transaction per record; one failing record never aborts the tick.

Implementation: `internal/delivery/worker/scheduler.go` ticks once per minute into `usecase.SchedulerUsecase.Tick`, started from `main` with the signal-cancelled context and joined with a `sync.WaitGroup` on shutdown. Thresholds are read from `settings` every tick.

## Verification

Non-trivial concurrent logic requires focused tests and race detection:

```bash
make test-race
```

The race detector needs cgo; run it in CI or any environment with a C toolchain (`CGO_ENABLED=1`).

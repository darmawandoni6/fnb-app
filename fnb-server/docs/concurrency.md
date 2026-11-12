# Concurrency Rules

Use concurrency only when it improves independent I/O, CPU-bound work, or background processing.

## HTTP

Echo already handles requests concurrently. Do not add goroutines in handlers for ordinary CRUD.

## Independent reads

Use `errgroup.WithContext` for independent repository reads. Cancel sibling work when one read fails. Keep shared result writes isolated or synchronized.

## Transactions

Never share a transaction `*gorm.DB` across goroutines. Transaction steps must remain sequential in one goroutine so stock updates and movement inserts preserve atomic ordering.

## Database queries

Prefer one set-based query over one goroutine per row. Do not use concurrency to replace `JOIN`, `Preload`, or `IN` queries.

## Background work

Long-running jobs belong in worker processes or managed goroutines with cancellation and graceful shutdown, not inside HTTP handlers.

## Verification

Non-trivial concurrent logic requires focused tests and race detection:

```bash
go test -race ./...
```

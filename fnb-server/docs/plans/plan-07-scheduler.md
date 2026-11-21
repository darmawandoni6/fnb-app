# Plan 07 — Scheduler

> **Status:** DONE (Completed on 2026-11-21)
> - `SchedulerUsecase.Tick` runs four jobs (cash timeout, `READY → DELIVERED`, `DELIVERED → COMPLETED`, idle session close) with errors joined and per-job failure counters.
> - Thresholds read from `settings` every tick; a job failure logs a warning, the second consecutive failure logs an error, and the remaining jobs still run.
> - Cash timeout reuses the plan 04 cancel helper (`cancelTimeout`), so stock restore and audit follow one path; only unpaid `CASH` orders older than the timeout are cancelled.
> - `internal/delivery/worker/scheduler.go` ticks once per minute from `main` with the signal-cancelled context, joined by a `sync.WaitGroup`.
> - Migration `000004_scheduler_indexes` adds the three partial indexes.
> - Unit tests passing: `scheduler_usecase_test.go` (thresholds, idempotency, failure isolation).


One loop, one minute tick, safe to repeat (PRD §12; `flow.md` scheduled jobs).

Depends on: 04, 05, 06.
Blocks: 09.

## 1. Scope

In:

- `internal/usecase/scheduler.go` and `internal/delivery/worker/scheduler.go` (managed goroutine, started from `main`).
- Four jobs: cash timeout cancel, `READY → DELIVERED` fallback, `DELIVERED → COMPLETED`, close empty table sessions.
- Aggregate recomputation and `audit_log` for every change, `actor_id = NULL`, `actor_role = NULL`.
- Publication of the same events as plan 06.

Out:

- Manual close and manual transitions (plan 04, 08).
- A general job framework, cron syntax, or per-job intervals.

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Single ticker, `time.NewTicker(1 * time.Minute)`, each job in sequence in one goroutine. | PRD §12 "one scheduler loop runs every minute". |
| 2 | Every job is written to be idempotent: it re-selects candidates each tick, so a missed or doubled tick is harmless. | PRD §12 "safe to run repeatedly". |
| 3 | Thresholds come from `settings` on every tick, not cached at startup. | Owner can change timers and the change applies immediately (PRD §7.4). |
| 4 | A job that fails logs and continues with the next job; it does not kill the loop. Two consecutive failures of the same job log at `ERROR`. | Availability over strictness for a background loop. |
| 5 | Each job opens its own transaction per order, not one giant transaction. | A single bad order must not block the tick. |
| 6 | Cash timeout selects orders where `payment_status = BELUM`, `canceled_at IS NULL`, `payment_method = CASH`, and `created_at < now() - cash_timeout_minutes`. It calls the same `CancelOrder` helper as plan 04 with reason `cash timeout`. | BR-03, EC-01, one cancel path. |
| 7 | Non-cash orders are **not** cancelled by the timer; Midtrans expiry drives that (plan 05). A cash order that was later confirmed is excluded by `payment_status`. | PRD §4.7 scenario B. |
| 8 | Auto-deliver selects items `READY` where `ready_at < now() - ready_auto_deliver_minutes`, sets `DELIVERED`, `delivered_at = now()`. | BR-17, EC-12. |
| 9 | Auto-complete selects items `DELIVERED` where `delivered_at < now() - delivered_auto_complete_minutes`, sets `COMPLETED`, `completed_at = now()`. Items already `COMPLETED` by a manual override are skipped by the status filter. | BR-14, EC-09, EC-13. |
| 10 | The auto-deliver warning is not a job. It is a derived flag computed in `GET /orders` for the kitchen: `delivered_soon = ready_auto_deliver_minutes - ready_auto_deliver_warning_minutes` minutes after the item became `READY`. | PRD §7.3 wants a warning, not a state; no need to persist or broadcast it. |
| 11 | `ready_at` on `order_items` is the trigger clock for `READY`, written with every `→ READY` transition (migration `000004_scheduler_indexes`). Plan 09 renamed it from the planned `updated_at`, which `order_items` never had. | Simplest column that survives restarts. |
| 12 | Session close job selects `OPEN` sessions with no order in `MENUNGGU`/`DIPROSES`, sets `CLOSED`, `ended_at`, `closed_by = NULL`, publishes `session.closed`. | PRD §4.6 step 3. |
| 13 | Order aggregate is recomputed inside the same transaction as the item write. | Keeps `orders.status` consistent (PRD §5.3). |
| 14 | The loop stops on `ctx.Done()`; in-flight work finishes first (no `context` cancellation mid-transaction). | `docs/concurrency.md` graceful shutdown. |
| 15 | Job names are constants in the scheduler package: `job_cash_timeout`, `job_auto_deliver`, `job_auto_complete`, `job_session_close`. | `docs/constants.md`. |

## 3. Schema

None. Uses plan 01 columns.

One supporting index for the timeout queries:

```sql
CREATE INDEX orders_pending_created_at_idx ON orders(created_at) WHERE payment_status = 'BELUM';
CREATE INDEX order_items_ready_updated_at_idx ON order_items(updated_at) WHERE status = 'READY';
CREATE INDEX order_items_delivered_at_idx ON order_items(delivered_at) WHERE status = 'DELIVERED';
```

Add to `000003` in plan 01 or as `000004_scheduler_indexes`; prefer folding into `000003` before it ships.

## 4. Domain

No new types. Reuses `domain.CalcTotals`? No — no money math in the scheduler.

## 5. Usecase

`internal/usecase/scheduler_usecase.go`

```go
type SchedulerUsecase struct {
    orderRepo   domain.OrderQueryRepository
    orderTx     TxRunner
    sessionRepo domain.TableSessionRepository
    settingRepo domain.SettingRepository
    publisher   domain.Publisher
    log         *slog.Logger
}

func (u *SchedulerUsecase) Tick(ctx context.Context) error
```

`Tick` runs the four jobs, collecting errors with `errors.Join`:

```go
func (u *SchedulerUsecase) cashTimeout(ctx context.Context, s *domain.Setting) error
func (u *SchedulerUsecase) autoDeliver(ctx context.Context, s *domain.Setting) error
func (u *SchedulerUsecase) autoComplete(ctx context.Context, s *domain.Setting) error
func (u *SchedulerUsecase) closeSessions(ctx context.Context) error
```

Each job:

1. Select candidate IDs with one query (`Limit(500)` per tick to bound the work; the next tick continues).
2. For each ID, `withTx` and apply the change, recompute the aggregate, `audit_log`.
3. Publish after each transaction.

Cash timeout reuses `OrderUsecase.CancelOrder` semantics; factor the core into an exported helper in `internal/usecase/cancel_order.go` so both paths call it:

```go
func cancelUnpaidOrder(ctx, tx OrderTx, order *domain.Order, reason string, actor *uuid.UUID, role *domain.UserRole) error
```

## 6. Delivery

`internal/delivery/worker/scheduler.go`

```go
func RunScheduler(ctx context.Context, u *usecase.SchedulerUsecase, log *slog.Logger) 
```

`main.go`:

```go
ctx, cancel := context.WithCancel(context.Background())
var wg sync.WaitGroup
wg.Add(1)
go func() { defer wg.Done(); worker.RunScheduler(ctx, schedulerUsecase, log) }()
...
cancel()
wg.Wait()
```

Do not touch `main.go` beyond adding the goroutine and shutdown hook (`docs/structure.md` wiring rule 3 — new features update `wiring.go`; the scheduler start is process bootstrap, so `main.go` is the correct place).

## 7. Tests

- `autoDeliver`: `READY` at `now - 11m` with `ready_auto_deliver_minutes = 10` → `DELIVERED`; at `now - 9m` → untouched; settings changed to `1` → the younger item moves on the next tick (decision 3).
- `autoComplete`: `DELIVERED` older than 5m → `COMPLETED`; already `COMPLETED` → skipped; `completed_at` set.
- `cashTimeout`: `MENUNGGU`/`BELUM` older than 15m → `DIBATALKAN`, items `CANCELLED`, `RESTORE` movements once; `LUNAS` older → untouched; `NON_CASH` older → untouched.
- `closeSessions`: session with only `SELESAI`/`DIBATALKAN` orders → closed; session with a `MENUNGGU` order → stays open; published `session.closed`.
- Idempotency: run `Tick` twice on the same fixtures → second run writes nothing (assert audit row counts).
- Failure isolation: a job returning an error does not stop the others.
- `go test -race`.

## 8. Verification

```bash
go test -race ./internal/usecase/...
make run
# fast-forward: UPDATE settings SET ready_auto_deliver_minutes = 1;
# create an order, set an item READY, wait two ticks, observe DELIVERED in psql and in the WS client
```

## 9. Docs to update

- `docs/concurrency.md` — add one line: scheduled jobs live in a managed goroutine with cancellation, one tick per minute.
- `../../../docs/flow.md` — already accurate; no change.
- `AGENTS.md` — no change.

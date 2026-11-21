# Plan 09 — Verification and rollout

> **Status:** DONE (Completed on 2026-11-21)
> - Migrations applied to the local database: `000004_scheduler_indexes` needed `delivered_at` (the `READY → DELIVERED` job keys off it, not `updated_at`, which `order_items` does not have); repository query fixed to match.
> - Startup crash found by the smoke run: `AuditLog`, `PaymentLog`, and `OrderSequence` had no `TableName()`, so GORM queried `audit_logs`/`payment_logs`/`order_sequences` while migrations create singular tables. Fixed and guarded by `internal/domain/table_names_test.go`.
> - `scripts/seed.sql` updated to `service_rate`/`tax_rate`/four timers and re-run successfully.
> - Bruno collection reorganised: `tables/` (list, create, update, deactivate, get-session, close-session), `audit/01-list`, `menus/09-toggle-menu-availability`, stock adjust + movements; `script:post-response` now saves `categoryId`, `adminMenuId`, `tableId`, `ingredientId`, `recipeItemId`, `itemId`, `orderNumber`, `sessionToken`; every request asserts the envelope.
> - Docs synced: `api.md` (Bruno path, order-number format, stock opname and audit responses, soft delete), `tech-stack.md`, `rules.md`, `structure.md`, `concurrency.md`, `AGENTS.md`, `README.md`, `.env.example` (`OUTLET_TIMEZONE`).
> - Manual smoke on a live stack passed: owner login, QR session, menu, cash order `DI-20261121-001`, cash confirm, item walk `COOKING → READY → DELIVERED → COMPLETED` with aggregate `SELESAI`, take-away `TA-` order, order cancel with exact stock restore, stock opname with signed `ADJUSTMENT`, movement ordering, audit filters, cashier availability toggle and `403` on menu create, `STORE_CLOSED` recipe gate, settings cross-field `400`s, `GET /tables/:id/session` and close with `session.closed` received over `GET /ws`.
> - `go test -race` is not runnable in this environment (no C compiler); it remains a CI step.


Closes the milestone: tests, API collection, documentation sync, and the commit gate.

Depends on: 01–08 in this order, though tests for a plan land with that plan.

## 1. Scope

In:

- Test coverage that `docs/rules.md` requires (one focused test per business rule).
- `go test -race` for order, hub, and scheduler packages.
- Bruno collection rewrite under `api-collection/` to match `api.md` after plans 03–05.
- `scripts/seed.sql` update for new settings columns.
- Documentation sync and the commit gate.

Out:

- Frontend work.
- Performance and load testing (not in PRD).

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | No new test framework. Standard `testing` only. | `docs/tech-stack.md`. |
| 2 | Handler tests use `httptest` + an in-memory or test-database repository double; DB-heavy rules are covered in `internal/repository` with a real PostgreSQL from `docker-compose.yml`. | Matches the existing test style; keeps most tests fast. |
| 3 | Business-rule tests live beside the rule, not in one giant file. | `docs/structure.md` naming. |
| 4 | `api-collection/` stays Bruno (already present at `api-collection/`, not `bruno/` as `api.md` says). Fix `api.md` to point at `api-collection/`. | Truth over intent. |
| 5 | `scripts/seed.sql` is updated to the new `settings` columns and stays idempotent. | Local setup must work after plan 01. |
| 6 | The completion gate is `go test ./... && go build ./...`; a red build blocks the commit. | `AGENTS.md`. |
| 7 | Documentation that describes behavior is updated in the same commit as the behavior. | `docs/rules.md` checklist. |
| 8 | Every convention used by the new code is added to `docs/rules.md`'s checklist only if it is a rule reviewers must keep applying (session header masking, order number format, soft delete). | Checklist stays actionable. |

## 3. Test inventory

| Package | File | Covers |
|---|---|---|
| `internal/domain` | `order_status_test.go` | `CalcTotals` (round half up, zero rates, component order), `AggregateOrderStatus` (PRD §5.3 table + cancelled), `ValidateItemTransition` (full matrix), `FormatOrderNumber` |
| `internal/usecase` | `order_create_test.go` | pricing snapshot, closed store, unavailable menu, stock shortage, required name, order number prefix, BR-12 isolation |
| | `order_transition_test.go` | role matrix per target and order type, `PAYMENT_REQUIRED`, no-op repeat (EC-10), aggregate recompute |
| | `order_cancel_test.go` | order-level cancel, items `CANCELLED`, stock `RESTORE` exact quantities, paid order rejected, double cancel rejected |
| | `order_payment_test.go` | idempotent cash confirm, one `payment_log`, cash math validation, manual non-cash |
| | `midtrans_callback_test.go` | signature rejection, settlement, expire, replay, unknown status |
| | `table_session_usecase_test.go` | idempotent open, closed session rejected, inactive table, concurrent open |
| | `scheduler_usecase_test.go` | the four jobs, settings read per tick, idempotent double tick, failure isolation |
| | `ws_hub_test.go` | fan-out, unregister, slow-client drop, topic authorization |
| | `auth_usecase_test.go` | login, refresh rotation, logout, inactive user |
| | `seed_usecase_test.go` | owner seed idempotency |
| `internal/delivery/http` | `session_middleware_test.go` | header parsing, `401` shapes |
| | `order_handler_test.go` | response envelope, status codes, DTO field names |
| | `public_handler_test.go` | menu shape, session-scoped order listing |
| | `ws_handler_test.go` | upgrade, subscribe authorization |
| | `audit_handler_test.go` | owner-only, filters |
| `internal/repository` | `order_sequence_repository_test.go` | atomic `NextSeq` under concurrency (`-race`, real DB) |
| | `order_repository_test.go` | `ConsumeStock`/`RestoreStock` symmetry, locking |

Every test name states the rule it protects, e.g. `TestConfirmPayment_IsIdempotent_BR11`.

## 4. Bruno collection

Directory stays `api-collection/`. Rebuild folder by folder against `api.md`:

```text
api-collection/
├── bruno.json
├── collection.bru
├── environments/local.bru     # add sessionToken, qrToken, orderId, itemId, orderNumber
├── auth/                      01-login 02-refresh 03-logout
├── public/                    01-open-session 02-menu 03-create-order
│                              04-list-orders 05-get-order 06-cancel-order
├── orders/                    01-list 02-get 03-create-manual
│                              04-confirm-payment 05-update-item-status 06-cancel
├── tables/                    01-list 02-create 03-update 04-deactivate
│                              05-get-session 06-close-session
├── menus/                     categories + menus (existing, rename fields)
├── stock/                     ingredients, restock, adjust, recipes, movements
├── users/                     users + settings
└── audit/                     01-list
```

Per-request requirements:

- `tests` block asserting `res.status` and the envelope `success` field.
- `script:post-response` on requests that produce an id saves it into an env var (`sessionToken`, `orderId`, `itemId`).
- Delete obsolete requests: `public/03-order-status.bru`, `public/04-cancel-item.bru`, `orders` per-item cancel.
- Add the Midtrans callback request with a placeholder signature and a comment explaining the SHA-512 input.

## 5. Seed and local setup

`scripts/seed.sql`:

```sql
INSERT INTO settings (id, cafe_name, service_rate, tax_rate, is_open,
                      cash_timeout_minutes, delivered_auto_complete_minutes,
                      ready_auto_deliver_minutes, ready_auto_deliver_warning_minutes)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Cafe', 5, 10, TRUE, 15, 5, 10, 2)
ON CONFLICT (id) DO UPDATE SET
  cafe_name = EXCLUDED.cafe_name,
  service_rate = EXCLUDED.service_rate,
  tax_rate = EXCLUDED.tax_rate,
  is_open = EXCLUDED.is_open;
```

Keep the demo table and menus; add one ingredient, one recipe, and an owner user is *not* seeded here (it comes from the environment seed in plan 02).

## 6. Documentation sync

| File | Change |
|---|---|
| `../../../docs/api.md` | order number format `DI-YYYYMMDD-SSS`; Bruno path is `api-collection/`; soft-delete wording; audit-log response |
| `../../../docs/flow.md` | verify; only the auto-deliver warning flag needs a line |
| `../../../docs/PRD.md` | only if a resolved decision changes (should be none) |
| `docs/tech-stack.md` | gorilla/websocket added; WebSocket moved out of "Deliberately Excluded"; hand-rolled Midtrans client noted |
| `docs/rules.md` | add: mask `X-Session-Token`; order status is derived, never accepted; cancel is order-level only |
| `docs/structure.md` | add `internal/delivery/worker/` to the layout |
| `docs/concurrency.md` | one line on scheduler goroutine |
| `AGENTS.md` | `SEED_OWNER_*`, `MIDTRANS_*`, `OUTLET_TIMEZONE`, `X-Session-Token` note |
| `README.md` | note the scheduler and WS in the feature list |

## 7. Verification

```bash
make reset          # only in a development environment, deletes the volume
make migrate
make seed
go test ./... 
go test -race ./internal/usecase/ ./internal/repository/
go build ./...
make run
make db-check
make api-check
```

Manual smoke, in order:

1. Login as owner; open a table session with `demo-qr-token`; fetch the menu.
2. Create a dine-in cash order; confirm it appears on the dashboard board and in the kitchen queue.
3. Confirm cash payment; watch the item go `COOKING → READY → DELIVERED → COMPLETED`; the order becomes `SELESAI`.
4. Repeat with a take away order; print receipt fields from the order response.
5. Create an order and cancel it unpaid; check stock returned to the pre-order value.
6. Set `ready_auto_deliver_minutes = 1`; create an order, mark an item `READY`, wait two ticks.
7. Drop the WS client; confirm the dashboard polling keeps the board correct.
8. Run the Bruno collection top to bottom with a fresh environment.

## 8. Commit

Checklist from `../../../docs/git.md`:

- [ ] Conventional Commit subject, e.g. `feat(orders): align order flow with PRD v1`
- [ ] `go test ./...` green
- [ ] `go build ./...` green
- [ ] No `.env`, `bin/`, credentials, or tokens staged
- [ ] Docs updated in the same commit
- [ ] Plan file checked off

Propose the message and wait for confirmation before committing (`AGENTS.md`).

## 9. Rollout order

Land in this sequence so the build is red for the shortest time:

1. Branch `feat/prd-alignment`.
2. Plans 01 + 04 in one PR (schema + order core), because 01 breaks the order packages.
3. Plan 03 (public session) — its removal of the tracking-token routes is included.
4. Plans 02 + 08 (auth hardening + admin alignment).
5. Plan 05 (payment).
6. Plan 06 (realtime).
7. Plan 07 (scheduler).
8. Plan 09 (tests, Bruno, docs) as the closing PR.

Merge to `master` only after step 8's checklist passes.

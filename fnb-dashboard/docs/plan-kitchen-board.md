# Plan — Kitchen Board Conformance

Plan for aligning the dashboard kitchen board (`/kitchen`) with `../docs/PRD.md` §3, §5, §6.1, `../docs/flow.md`, `../docs/api.md` §Internal — orders, and the real backend behavior in `../../fnb-server/internal/domain/order_status.go`.

Status: **draft round 2 — decisions settled through grilling, awaiting review before implementation**.

## Scope

Dashboard (`fnb-dashboard`) and its mock layer (`src/mocks/`), plus the shared documents `../docs/PRD.md`, `../docs/flow.md`, and `../docs/api.md` where they contradict each other or the backend. Backend code is the reference and is not changed.

## Decisions (settled)

1. Kitchen receives **paid orders only** (`payment_status = LUNAS`), enforced server-side for `KITCHEN` and additionally filtered client-side so the board is identical for every role (an `OWNER` viewing `/kitchen` must not see unpaid orders or trigger `PAYMENT_REQUIRED` from the board).
2. Board query uses `useOrders()` without a status filter (Option A), then filters client-side.
3. Board shows an order when **all** of the following hold: paid (`LUNAS`), `status ∈ {MENUNGGU, DIPROSES, DIANTAR}`, and it still has at least one active item in `PENDING` or `COOKING`.
   - `MENUNGGU`: paid but not yet started (PRD §5.1 row 1 — payment does not move it to `DIPROSES`).
   - `DIANTAR` with a still-cooking item: a multi-item order where the cashier delivered one item early keeps its `COOKING`/`PENDING` items on the board (PRD §5.1 row 4; `AggregateOrderStatus` checks `any COOKING` before `any DELIVERED`, and `allDelivered && !LUNAS → DIANTAR`).
   - `READY` items inside a still-active order remain visible; the order leaves only when nothing is left to cook.
4. Orders that reach `SIAP` (all active items `READY`) **leave** the board; the kitchen queue is done at that point (PRD §5.1 row 3, flow.md line 61).
5. Item cancellation stays `PENDING`-only and is **not** offered to `KITCHEN` (PRD §5.2, `api.md`, `router.go:83`: customer, `CASHIER`, `OWNER`).
6. `../docs/PRD.md` is edited to remove its self-contradictions (see Step 5).

## Reference Rules (quoted)

Item transitions (PRD §5, `api.md`, `ValidateItemTransition`):

```text
PENDING → COOKING → READY → DELIVERED
PENDING → CANCELLED
```

Order aggregation (PRD §5.1, mirrored by `AggregateOrderStatus`):

```text
active = items with status != CANCELLED
len(active) == 0                        → DIBATALKAN
all active PENDING                      → MENUNGGU
any active COOKING                      → DIPROSES
all active DELIVERED && LUNAS           → SELESAI
all active DELIVERED && !LUNAS          → DIANTAR
any active DELIVERED                    → DIANTAR
all active READY                        → SIAP
otherwise                               → DIPROSES
```

Consequences that drive this plan:

- Item `PENDING` exists in two order states: unpaid (`MENUNGGU`) and paid-but-not-started (`MENUNGGU`).
- `DIPROSES` starts only when the first item becomes `COOKING` (flow.md line 59).
- `COOKING` is rejected with `PAYMENT_REQUIRED` while the order is `BELUM` (PRD §5.3, flow.md line 57).
- `flow.md` line 191 documents the kitchen board as `GET /orders?status=DIPROSES`, which cannot return a paid, not-yet-started order. That is the deadlock this plan removes.

## Findings

| #   | Finding                                                                                                                                                                                          | Severity            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 1   | Mock `deriveStatus` returns `DIPROSES` for a paid order whose items are all `PENDING`; PRD §5.1 and `fnb-server` return `MENUNGGU`                                                               | bug                 |
| 2   | Mock `updatePayment` never recomputes `order.status`; backend recomputes in the same transaction (needed for the `SELESAI` edge when payment arrives after all items are `DELIVERED`)            | bug                 |
| 3   | Mock `getOrders` / `getOrder` do not restrict `KITCHEN` to `LUNAS`; `api.md` requires paid-only listing and `404 NOT_FOUND` for unpaid reads                                                     | gap (authorization) |
| 4   | Kitchen board polls `?status=DIPROSES` only, so paid unstarted orders are invisible (flow.md P2 must change)                                                                                     | bug                 |
| 5   | Every kitchen card shows both `Mulai masak` and `Siap` regardless of item status, exposing invalid transitions (`INVALID_TRANSITION`)                                                            | UX / spec           |
| 6   | Cards omit item `qty` and `note`; PRD §2/§3 require quantities and notes                                                                                                                         | UX                  |
| 7   | PRD §5 (line 114) and §5.3 (line 153) say "all actors" may cancel; PRD §5.2, `api.md`, and `router.go:83` allow only customer, `CASHIER`, `OWNER`                                                | doc inconsistency   |
| 8   | PRD §5.1 has no row for (a) all items `DELIVERED` while still `BELUM` (backend: `DIANTAR`, fnb-server test #6) or (b) a `PENDING` + `READY` mix without `COOKING` (backend: `DIPROSES`, test #8) | doc gap             |
| 9   | With only `{MENUNGGU, DIPROSES}` on the board, a `DIANTAR` order that still has a `COOKING` item loses that item from the board (same defect exists today)                                       | bug                 |

## Step 1 — Shared status derivation in the mock layer

1. Extract `deriveStatus` from `src/mocks/handlers/orders.ts` into `src/mocks/handlers/deriveStatus.ts`.
2. Align it with `AggregateOrderStatus` above: the `all active PENDING` branch runs before any payment check; payment decides only `SELESAI` vs `DIANTAR`; `any COOKING` is evaluated before `any DELIVERED`.
3. `orders.ts` imports the shared helper.

## Step 2 — Recompute status when payment settles

`src/mocks/handlers/payments.ts`:

- After setting `payment_status` / `payment_method` / `amount_received` / `change_amount`, call `targetOrder.status = deriveStatus(targetOrder)`.
- No behavior change for paid-unstarted orders (stays `MENUNGGU`); the recompute matters when all items are already `DELIVERED` and payment moves the order to `SELESAI`.

## Step 3 — Enforce paid-only access for KITCHEN

`src/mocks/handlers/orders.ts`, matching `api.md:106` and `order_repository.go:36`:

- `getOrders`: when the current user is `KITCHEN`, filter results to `payment_status === LUNAS` before applying the other filters.
- `getOrder`: `KITCHEN` + unpaid order → `fail(API_ERROR_CODE.NOT_FOUND, 'Order not found')`.

Server-side enforcement stays even though Step 4 also filters client-side: UI filtering is not authorization.

## Step 4 — Kitchen board query and rendering

`src/pages/KitchenPage.tsx`:

1. Replace `useOrders({ status: 'DIPROSES' })` with `useOrders()`.
2. Client-side order filter, applied to every role:
   - `payment_status === LUNAS` (identical board for `OWNER` and `KITCHEN`; unpaid orders never appear);
   - `status === 'MENUNGGU' || status === 'DIPROSES' || status === 'DIANTAR'`;
   - at least one active (`!= CANCELLED`) item in `PENDING` or `COOKING`.
3. Keep the three item columns (`PENDING`, `COOKING`, `READY`); cancelled and delivered items stay out. `READY` items of a still-active order render normally.
4. `KitchenItemCard`:
   - `PENDING` → single button `Mulai masak` (`COOKING`).
   - `COOKING` → single button `Siap` (`READY`).
   - `READY` → badge `Menunggu kasir`, no action (kitchen cannot set `DELIVERED`).
   - Show `qty` (`2x`) and `note` when present, plus a small `#order_id` for traceability.
5. Empty state copy: `Belum ada order lunas yang menunggu` / `Order lunas berstatus MENUNGGU atau DIPROSES akan muncul di sini.`

## Step 5 — Documentation

1. `../docs/flow.md` §Polling: change P2 from `poll GET /orders?status=DIPROSES` to `poll GET /orders` for the kitchen board, with a note that the server returns only `LUNAS` orders and the board filters `MENUNGGU` + `DIPROSES` + `DIANTAR` orders that still have active `PENDING`/`COOKING` items.
2. `../docs/flow.md` sequence diagram: after line 55 (`update payment_status = LUNAS`), add the aggregate recompute step performed by the backend (needed for the `SELESAI` edge: all items `DELIVERED` while `BELUM`, then paid).
3. `../docs/api.md` §Internal — orders: add one sentence stating that the kitchen board combines `MENUNGGU`, `DIPROSES`, and still-active `DIANTAR` because a paid order stays `MENUNGGU` until the first item is `COOKING`.
4. `../docs/PRD.md`:
   - §5 line 114 and §5.3 line 153: reword "all actors" / "any actor" to the §5.2 actor list (customer, `CASHIER`, `OWNER`) so the document stops contradicting itself.
   - §5.1: add the two missing rows — `all active DELIVERED && payment BELUM → DIANTAR` and `PENDING + READY mix (no COOKING) → DIPROSES` — so the table covers every state `AggregateOrderStatus` produces.
5. `AGENTS.md` status line: mention the kitchen board fix once implemented.

## Step 6 — Self-check

`src/mocks/selfcheck.ts`:

- Paying an order whose items are all `PENDING` keeps `status = MENUNGGU` (regression guard for finding 1).
- First `PENDING → COOKING` moves the order to `DIPROSES`.
- `getOrders` as `KITCHEN` returns only `LUNAS` orders.
- `getOrder` of an unpaid order as `KITCHEN` throws `NOT_FOUND`.
- All items `DELIVERED` while `BELUM`, then payment, yields `SELESAI` (covers finding 2).
- `deriveStatus` parity guards: one `DELIVERED` + one `COOKING` → `DIANTAR`; `PENDING` + `READY` mix → `DIPROSES`; all `DELIVERED` while `BELUM` → `DIANTAR`.

## Step 7 — Verification

```bash
npm run lint
npm run format:check
npm run build
```

Manual (`npm run dev`, backend not required, mock layer):

1. Login `kasir@demo.cafe`, create a multi-item manual order, pay it.
2. Login `kitchen@demo.cafe`: the paid order appears in the `PENDING` column; unpaid seed orders never appear.
3. `Mulai masak` → item moves to `COOKING`, order becomes `DIPROSES`; only `Siap` is offered.
4. Back as cashier, deliver one ready item early while another item is still `COOKING` → order becomes `DIANTAR`, and the cooking item **stays** on the kitchen board.
5. `Siap` on the last cooking item → when every active item is `READY` the order becomes `SIAP` and leaves the board.
6. Login `owner@demo.cafe`, open `/kitchen`: the board matches the kitchen view — no unpaid orders.

## Commits

```
fix(mocks): derive order status per PRD and restrict kitchen to paid orders
feat(kitchen): show paid MENUNGGU and DIPROSES orders with next-step actions
docs(flow): kitchen board polls paid MENUNGGU and DIPROSES orders
```

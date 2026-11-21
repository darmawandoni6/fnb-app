# Phase 2.6 — Status, Closed, Invalid

Granular plan for Phase 2.6 of `../implementation-plan.md`.

Goal: `/status` renders stored orders as an accordion of cards, polling the session's order list once every 5 seconds, with order-level cancel; `/tutup` and `/tidak-valid` close the flow.

## Prerequisites

- Phase 2.5 complete: orders are stored in `session.orders` as `{ id, snapshot }`.
- Docs read: `../docs/PRD.md` §4.7, §5, `../docs/api.md` (Cancel order, rate limits), `docs/tech-stack.md` (Polling Rules).

## Steps

### Step 1 — Create the orders list query `[REWORK]`

Files: `src/features/orders/api.ts`, `src/features/orders/status.ts`

```ts
export const ordersQuery = (sessionToken: string) =>
  queryOptions({
    queryKey: ['public-orders', sessionToken],
    queryFn: () => getPublicOrders(sessionToken),
  })

const isFinished = (status: OrderStatus) => status === 'SELESAI' || status === 'DIBATALKAN'
```

Verify: the predicate returns true only for the two terminal statuses.

### Step 2 — Implement `useOrderList` `[REWORK]`

Files: `src/features/orders/status.ts`

- One `useQuery` over `ordersQuery(session.sessionToken)`; `enabled` while `sessionToken` is non-empty.
- `refetchInterval` returns `5_000` while any order in the response is unfinished, `false` once every order is `SELESAI` or `DIBATALKAN`.
- `refetchIntervalInBackground: true`.
- On each successful fetch, merge every returned order into `session.orders` by `id`, overwriting `snapshot`; entries missing from the response keep their last snapshot.
- On `401 UNAUTHORIZED` re-open the session from `session.qr` once, store the new token (which changes the query key), and refetch.
- On `404 NOT_FOUND` from the session re-open, redirect to `/tidak-valid`.

Verify: the query polls once per interval regardless of how many cards are stored; a finished list stops polling.

### Step 3 — Build the status page and accordion `[REWORK]`

Files: `src/features/orders/pages/StatusPage.tsx`

- `/status` redirects to `/` when `session.orders` is empty.
- One card per order, newest first.
- Exactly one card open; opening another closes the previous.
- Collapsed cards render from `snapshot`; the single list poll refreshes every snapshot, so no per-card query exists anymore.

Verify: with three orders, only one request fires per 5 seconds and all three cards show fresh data after a change.

### Step 4 — Build the status stepper `[REWORK]`

Files: `src/features/orders/components/StatusStepper.tsx`

- Steps derive from the item statuses, because the aggregate has no `SIAP` / `DIANTAR`:
  - all items `PENDING` → "menunggu"
  - any item `COOKING` → "diproses"
  - any item `READY` → "siap"
  - any item `DELIVERED` → "dalam pengantaran"
  - every item `COMPLETED` or `CANCELLED` → done
- Aggregate `MENUNGGU` (unpaid) still renders as the first step; `payment_status` `BELUM` never shows kitchen steps beyond "menunggu".
- No timeline and no timestamps; the API returns none.
- `DIBATALKAN` renders a distinct cancelled state instead of a step.

Verify: each fixture lights the right step; a mixed `COMPLETED`/`PENDING` order shows "diproses", not "selesai".

### Step 5 — Build the order item row

Files: `src/features/orders/components/OrderItemRow.tsx`

- `menu_name_snapshot`, qty, unit price, note, and item status badge.
- `CANCELLED` items stay visible, crossed out, with "Dibatalkan".
- No per-item cancel button; cancellation is order-level (Step 7).

Verify: cancelled fixtures show crossed out with no cancel control.

### Step 6 — Show payment status and server totals

Files: `src/features/orders/components/OrderCard.tsx`

- `payment_status` badge: `BELUM` and `LUNAS`.
- Display `order_number`, `subtotal_amount`, `service_amount`, `tax_amount`, and `total_amount` from the response only.
- Never recompute; the client prints server figures.

Verify: totals match the mock response exactly.

### Step 7 — Implement the order cancel action `[REWORK]`

Files: `src/features/orders/status.ts`, `src/features/orders/components/OrderCard.tsx`

- `useCancelOrder` mutation calling `cancelPublicOrder(sessionToken, order.id, { reason })`.
- Cancel button renders only when the order is `MENUNGGU` with `payment_status` `BELUM`; otherwise no button at all.
- `AlertDialog` with an optional reason input (Indonesian placeholder, e.g. "alasan membatalkan (opsional)").
- No refund warning: a `MENUNGGU` order has collected no money (PRD §4.7).
- On success, replace the stored `snapshot` and update the list query data.
- On `INVALID_TRANSITION`, toast the server message and refresh; on `401`, re-open the session once and retry.

Verify: cancelling an unpaid order flips the card to `DIBATALKAN` with items crossed out; a `LUNAS` order shows no cancel button.

### Step 8 — Merge list responses into stored cards `[REWORK]`

Files: `src/features/orders/status.ts`

- Merge by `id`; never drop a stored card just because the list response lacks it (an older session's orders keep their snapshot).
- A card whose snapshot is older than the newest list entry always prefers the list entry.

Verify: storing three orders, deleting none, and reloading keeps all three cards.

### Step 9 — Handle `429` with backoff `[REWORK]`

Files: `src/features/orders/status.ts`

- On `429`, back off instead of retrying immediately: skip the next interval and retry on the following one.
- Keep the last good snapshots on screen.
- No toast storm; one toast maximum.
- `GET /public/orders` is limited to 30/minute per session; one 5-second poll is 12/minute.

Verify: forcing several requests per second does not hammer the endpoint.

### Step 10 — Add the "Tambah pesanan" action

Files: `src/features/orders/pages/StatusPage.tsx`

- Returns to `/` with the cart empty and `session.orders` preserved.
- Does not reset `qr` or `sessionToken`.

Verify: adding a second order produces two cards, newest first.

### Step 11 — Build the closed screen

Files: `src/features/checkout/pages/ClosedPage.tsx`

- Route `/tutup`; message that the store is closed.
- "Lihat menu saja" sets `browseOnly` and navigates to `/`.
- Visiting `/tutup` while `is_open` is true redirects to `/`.

Verify: browse-only survives a reload and the banner shows.

### Step 12 — Build the invalid table screen

Files: `src/features/checkout/pages/InvalidTablePage.tsx`

- Route `/tidak-valid`; guidance to scan the table QR again.
- Shown when the session open returns `404` (unknown or deactivated `qr_token`).
- No retry loop; the customer must rescan.

Verify: `demo-invalid` and an unknown token both land here.

## Phase Checklist

- [x] `/status` with no orders redirects to `/`.
- [x] Cards render newest first with exactly one open.
- [ ] One list request per 5 seconds refreshes every card.
- [ ] Polling stops when every stored order is `SELESAI` or `DIBATALKAN`.
- [ ] Stepper derives from item statuses; no `SIAP` / `DIANTAR` aggregate exists.
- [x] `CANCELLED` items stay visible, crossed out.
- [x] Payment badge and server totals render as returned.
- [ ] Cancel button appears only for `MENUNGGU` + `BELUM` and cancels the whole order with a reason.
- [ ] A `LUNAS` or `DIPROSES` order shows no cancel button and no refund warning.
- [ ] `401` re-opens the session once and polling continues.
- [x] `429` backs off and keeps the last snapshots.
- [x] "Tambah pesanan" returns to `/` with orders preserved.
- [x] `/tutup` and `/tidak-valid` behave per their guards.
- [x] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [x] The full mock flow works: scan → browse → cart → checkout → order → track → cancel.
- [x] No screen computes order status or money.
- [ ] Phase 3 needs no component change.

## Gotchas

- One list poll, not one poll per card; the 30/minute session limit splits fast otherwise.
- Do not add timestamps to the stepper; the API has no timeline.
- Do not show a refund warning; v1 cancels only unpaid orders.

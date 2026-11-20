# Phase 2.6 — Status, Closed, Invalid

Granular plan for Phase 2.6 of `../implementation-plan.md`.

Goal: `/status` renders stored orders as an accordion of cards, polling only the open card, with cancel and refund warning; `/tutup` and `/tidak-valid` close the flow.

## Prerequisites

- Phase 2.5 complete: orders are stored in `session.orders` as `{ id, trackingToken, snapshot }`.
- Docs read: `../docs/PRD.md` §5.1, `../docs/api.md` (Cancel item, rate limits), `docs/tech-stack.md` (Polling Rules).

## Steps

### Step 1 — Create the tracking query

Files: `src/features/orders/api.ts`, `src/features/orders/status.ts`

```ts
export const orderQuery = (trackingToken: string) =>
  queryOptions({
    queryKey: ['public-order', trackingToken],
    queryFn: () => getPublicOrder(trackingToken),
  })

const isFinished = (status: OrderStatus) => status === 'SELESAI' || status === 'DIBATALKAN'
```

Verify: the predicate returns true only for the two terminal statuses.

### Step 2 — Implement `useTrackedOrder`

Files: `src/features/orders/status.ts`

- `useQuery` with `initialData` from the stored `snapshot` and `initialDataUpdatedAt: 0`.
- `refetchInterval` returns `5_000` while the order is unfinished, `false` once finished.
- `refetchIntervalInBackground: true`.
- On each successful fetch, overwrite that order's `snapshot` in the session.
- An `enabled` flag lets the caller poll only the open card.

Verify: toggling the flag stops requests immediately.

### Step 3 — Build the status page and accordion

Files: `src/features/orders/pages/StatusPage.tsx`

- `/status` redirects to `/` when `session.orders` is empty.
- One card per order, newest first.
- Exactly one card open; opening another closes the previous.
- Collapsed cards render from `snapshot` only and never poll.
- The open card passes `enabled: true` to `useTrackedOrder`; collapsed cards pass `false`.

Verify: with three orders, only one request fires per 5 seconds.

### Step 4 — Build the status stepper

Files: `src/features/orders/components/StatusStepper.tsx`

- Steps derived from the aggregate `status`: `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, then done.
- No timeline and no timestamps; the API returns none.
- `DIBATALKAN` renders a distinct cancelled state instead of a step.

Verify: each fixture status lights the right step.

### Step 5 — Build the order item row

Files: `src/features/orders/components/OrderItemRow.tsx`

- `menu_name`, qty, unit price, note, and item status badge.
- `CANCELLED` items stay visible, crossed out, with "Dibatalkan".
- Cancel button only on `PENDING` items.

Verify: cancelled fixtures show crossed out with no cancel button.

### Step 6 — Show payment status and server totals

Files: `src/features/orders/components/OrderCard.tsx`

- `payment_status` badge: `BELUM` and `LUNAS`.
- Display `subtotal_amount`, `tax_amount`, and `total_amount` from the response only.
- Never recompute; the client prints server figures.

Verify: totals match the mock response exactly.

### Step 7 — Implement the cancel action

Files: `src/features/orders/status.ts`, `src/features/orders/components/OrderCard.tsx`

- `useCancelOrderItem` mutation calling `cancelOrderItem(trackingToken, itemId)`.
- `AlertDialog` confirmation naming the item.
- When `payment_status` is `LUNAS`, the dialog adds the refund warning; `api.md` refunds a paid item.
- On success, replace the stored `snapshot` and invalidate the query.
- On `INVALID_TRANSITION`, toast the server message and refresh.

Verify: cancelling a paid `PENDING` item warns, succeeds, and the total drops.

### Step 8 — Handle the unknown tracking token

Files: `src/features/orders/pages/StatusPage.tsx`

- A `404 NOT_FOUND` on the open card renders an invalid-order state inside the card.
- The card stays in the accordion; it is not silently deleted.
- The invalid state offers "Hapus dari riwayat" scoped to that card only.

Verify: corrupting one stored token leaves the other cards usable.

### Step 9 — Handle `429` with backoff

Files: `src/features/orders/status.ts`

- On `429`, back off instead of retrying immediately: skip the next interval and retry on the following one.
- Keep the last good `snapshot` on screen.
- No toast storm; one toast maximum.

Verify: forcing several requests per second does not hammer the endpoint.

### Step 10 — Add the "Tambah pesanan" action

Files: `src/features/orders/pages/StatusPage.tsx`

- Returns to `/` with the cart empty and `session.orders` preserved.
- Does not reset `qr`.

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
- No retry loop; the customer must rescan.

Verify: `demo-invalid` and an unknown token both land here.

## Phase Checklist

- [x] `/status` with no orders redirects to `/`.
- [x] Cards render newest first with exactly one open.
- [x] Only the open card polls; collapsed cards render from `snapshot`.
- [x] Polling stops on `SELESAI` and `DIBATALKAN`.
- [x] Stepper derives from the aggregate status only.
- [x] `CANCELLED` items stay visible, crossed out.
- [x] Payment badge and server totals render as returned.
- [x] Cancel works on `PENDING`; a `LUNAS` order warns about the refund.
- [x] A bad tracking token shows the invalid-order state without breaking other cards.
- [x] `429` backs off and keeps the last snapshot.
- [x] "Tambah pesanan" returns to `/` with orders preserved.
- [x] `/tutup` and `/tidak-valid` behave per their guards.
- [x] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [x] The full mock flow works: scan → browse → cart → order → track → cancel.
- [x] No screen computes order status or money.
- [x] Phase 3 needs no component change.

## Gotchas

- Do not poll every card; 30/minute per IP splits fast.
- Do not add timestamps to the stepper; the API has no timeline.
- Do not delete an invalid card automatically.

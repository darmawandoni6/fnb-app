# Phase 2.5 — Cart, Checkout Form, Order Submit

Granular plan for Phase 2.5 of `../implementation-plan.md`.

Goal: a working cart page that lists lines with unit prices, collects the required customer name plus payment method, submits the order through `@/api`, and stores the resulting order in the session. No client-side aggregate totals.

## Prerequisites

- Phase 2 complete: cart helpers, session store, menu query, cart bar.
- Docs read: `docs/tech-stack.md` (Cart Rules), `../docs/api.md` (Create order, Open table session, Error codes).

## Steps

### Step 1 — Create the cart line row

Files: `src/features/checkout/components/CartLineRow.tsx`

- Menu name, unit price via `formatRupiah`, qty stepper, note text, remove button.
- Qty stepper clamps to `MAX_QTY 50` and removes the line at zero after confirmation.
- Note is editable inline, capped at `NOTE_MAX`.
- Item thumbnail from `image_url`, initials placeholder otherwise.
- Touch targets at least 44×44 px.

Verify: stepper, note edit, and remove all update `session.cart` immediately.

### Step 2 — Build the cart page layout

Files: `src/features/checkout/pages/CartPage.tsx`

- Rows from `cartLines(session.cart, menus)`.
- Empty state with a link back to `/`.
- Hidden lines from `cartLines` are dropped silently, per Step 4.

Verify: an empty cart shows the empty state, not a broken list.

### Step 3 — Add the footer with no aggregate

Files: `src/features/checkout/pages/CartPage.tsx`

- Footer text: "N item · total dihitung kasir".
- No subtotal, service, tax, or total anywhere on the page.
- Submit button disabled when the cart is empty or ordering is blocked.

`api.md` forbids the client from determining prices, tax, or totals. This step is the enforcement point.

Verify: searching the rendered DOM for a rupiah total finds only unit prices.

### Step 4 — Handle lines whose menu disappeared

Files: `src/features/checkout/pages/CartPage.tsx`, `src/features/browse/cart.ts`

- A line whose `menuId` is missing from the menu response is hidden and dropped from the submit payload.
- The session keeps the line; the view does not show it.
- When every line is hidden, the submit button is disabled with "menu sudah tidak tersedia".

Verify: remove a menu from the mock response, reload, and confirm the cart empties with the message.

### Step 5 — Build the checkout form `[REWORK]`

Files: `src/features/checkout/components/CheckoutForm.tsx`, `src/schemas/checkout.ts`

- `customer_name`: required, trimmed, non-empty; React Hook Form + Zod (already installed).
- `customer_phone`: optional; empty string maps to `null` in the payload.
- `payment_method`: radio group `CASH` / `NON_CASH`, default `CASH`; helper text for `NON_CASH` says payment continues in Snap.
- Inline errors from the Zod schema; no client-side totals anywhere in the form.

Verify: submitting with an empty name shows an inline error and never calls the API.

### Step 6 — Implement the submit mutation `[REWORK]`

Files: `src/features/checkout/hooks.ts`

```ts
export const useSendOrder = () =>
  useMutation({
    mutationFn: (input: CreatePublicOrderRequest) => createPublicOrder(session.sessionToken, input),
  })
```

- Payload is `{ order_type: 'DINE_IN', customer_name, customer_phone, payment_method, items: [{ menu_id, qty, note }] }` with hidden lines removed.
- Empty payload after filtering → do not call the API.
- On success: prepend `{ id: response.id, snapshot: response }` to `session.orders`, clear `cart`, then handle the payment branch (Step 7).
- `401 UNAUTHORIZED` → re-open the session from `session.qr` once and retry the submit; `404` → `/tidak-valid`.

Verify: submitting adds one card and empties the cart.

### Step 7 — Branch on the payment method `[REWORK]`

Files: `src/features/checkout/pages/CartPage.tsx`

- `CASH`: navigate to `/status`; the order stays `MENUNGGU` until the cashier confirms.
- `NON_CASH`: the response carries `payment_url`; navigate to it (`window.location.assign`) after the order is stored in the session, so `/status` still shows the order on return.
- Store the order before navigating in both branches.

Verify: `CASH` lands on `/status`; `NON_CASH` opens the Snap URL and the order card is still there on return.

### Step 8 — Handle `STORE_CLOSED`

Files: `src/features/checkout/pages/CartPage.tsx`

- Toast the server `message`.
- Refresh the menu query so `is_open` is current.
- Route to `/tutup`.

Verify: `demo-tutup` on submit toasts and lands on `/tutup`.

### Step 9 — Handle `STOCK_NOT_ENOUGH`, `VALIDATION_ERROR`, and `429`

Files: `src/features/checkout/pages/CartPage.tsx`

- `STOCK_NOT_ENOUGH`: toast the message, refetch the menu, keep the cart.
- `VALIDATION_ERROR`: toast the message and keep the cart; the client does not re-implement server validation.
- `429` (submit is limited to 5/minute per session): back off, one toast maximum, no immediate retry loop.
- Any other code: generic error toast with a retry action.

Verify: `demo-habis` toasts and refetches without clearing the cart.

### Step 10 — Add the submission pending state

Files: `src/features/checkout/pages/CartPage.tsx`

- Disable submit and the steppers while the mutation is pending.
- Show a spinner in the button.
- Prevent double submit — a second POST would hit the 5/minute limit.

Verify: double-clicking submit creates exactly one order.

## Phase Checklist

- [x] Cart lists lines with unit prices and no aggregate total.
- [x] Stepper clamps at 50 and removing the last unit removes the line after confirmation.
- [x] Note edits persist to the session.
- [x] Hidden lines are excluded from the payload; an all-hidden cart cannot submit.
- [ ] Checkout form requires `customer_name`, accepts an optional phone, and offers `CASH` / `NON_CASH`.
- [x] Submit stores the order card and clears the cart.
- [ ] `NON_CASH` navigates to the returned `payment_url` with the order already stored.
- [x] `STORE_CLOSED` toasts and routes to `/tutup`.
- [x] `STOCK_NOT_ENOUGH` toasts and refetches.
- [ ] `429` backs off with a single toast.
- [x] Pending state blocks double submit.
- [x] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [x] An order can be created end-to-end on mock data and appears as a stored session order.
- [x] No client-side money aggregate exists anywhere in the cart flow.
- [ ] `CASH` and `NON_CASH` both complete from the cart on mock data.
- [x] Phase 2.6 can render the stored order on `/status`.

## Gotchas

- `service_rate` and `tax_rate` from the menu response must not be used to display a tax preview.
- Do not clear the cart before the submit response arrives.
- Do not drop a cart line from the session just because its menu is hidden.
- Do not navigate to `payment_url` before the order is written to `session.orders`.

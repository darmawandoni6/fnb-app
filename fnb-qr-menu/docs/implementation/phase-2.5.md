# Phase 2.5 — Cart and Order Submit

Granular plan for Phase 2.5 of `../implementation-plan.md`.

Goal: a working cart page that lists lines with unit prices, submits the order through `@/api`, and stores the resulting order in the session. No aggregate totals.

## Prerequisites

- Phase 2 complete: cart helpers, session store, menu query, cart bar.
- Docs read: `docs/tech-stack.md` (Cart Rules), `../docs/api.md` (Create QR order, Error codes).

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
- No subtotal, tax, or total anywhere on the page.
- Submit button disabled when the cart is empty or ordering is blocked.

`api.md` forbids the client from determining prices, tax, or totals. This step is the enforcement point.

Verify: searching the rendered DOM for a rupiah total finds only unit prices.

### Step 4 — Handle lines whose menu disappeared

Files: `src/features/checkout/pages/CartPage.tsx`, `src/features/browse/cart.ts`

- A line whose `menuId` is missing from the menu response is hidden and dropped from the submit payload.
- The session keeps the line; the view does not show it.
- When every line is hidden, the submit button is disabled with "menu sudah tidak tersedia".

Verify: remove a menu from the mock response, reload, and confirm the cart empties with the message.

### Step 5 — Implement the submit mutation

Files: `src/features/checkout/hooks.ts`

```ts
export const useSendOrder = () =>
  useMutation({
    mutationFn: (input: CreatePublicOrderRequest) =>
      createPublicOrder(session.qr, input),
  })
```

- Payload is `items: [{ menu_id, qty, note }]` with hidden lines removed.
- Empty payload after filtering → do not call the API.
- On success: prepend `{ id: order_id, trackingToken: tracking_token, snapshot: response }` to `session.orders`, clear `cart`, then navigate to `/status`.

Verify: submitting adds one card and empties the cart.

### Step 6 — Handle `STORE_CLOSED`

Files: `src/features/checkout/pages/CartPage.tsx`

- Toast the server `message`.
- Refresh the menu query so `is_open` is current.
- Route to `/tutup`.

Verify: `demo-tutup` on submit toasts and lands on `/tutup`.

### Step 7 — Handle `STOCK_NOT_ENOUGH` and `VALIDATION_ERROR`

Files: `src/features/checkout/pages/CartPage.tsx`

- `STOCK_NOT_ENOUGH`: toast the message, refetch the menu, keep the cart.
- `VALIDATION_ERROR`: toast the message and keep the cart; the client does not re-implement server validation.
- Any other code: generic error toast with a retry action.

Verify: `demo-habis` toasts and refetches without clearing the cart.

### Step 8 — Add the submission pending state

Files: `src/features/checkout/pages/CartPage.tsx`

- Disable submit and the steppers while the mutation is pending.
- Show a spinner in the button.
- Prevent double submit.

Verify: double-clicking submit creates exactly one order.

## Phase Checklist

- [ ] Cart lists lines with unit prices and no aggregate total.
- [ ] Stepper clamps at 50 and removing the last unit removes the line after confirmation.
- [ ] Note edits persist to the session.
- [ ] Hidden lines are excluded from the payload; an all-hidden cart cannot submit.
- [ ] Submit prepends an order card and clears the cart.
- [ ] `STORE_CLOSED` toasts and routes to `/tutup`.
- [ ] `STOCK_NOT_ENOUGH` toasts and refetches.
- [ ] Pending state blocks double submit.
- [ ] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [ ] An order can be created end-to-end on mock data and appears as a stored session order.
- [ ] No client-side money aggregate exists anywhere in the cart flow.
- [ ] Phase 2.6 can render the stored order on `/status`.

## Gotchas

- `tax_percent` from the menu response must not be used to display a tax preview.
- Do not clear the cart before the submit response arrives.
- Do not drop a cart line from the session just because its menu is hidden.

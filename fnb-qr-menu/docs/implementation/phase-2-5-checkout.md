# Phase 2.5 — Checkout and Submit

Granular plan for executing section 2.5 from `../implementation-plan.md`.

## Scope

Checkout form and order submission: required name, optional phone, payment method, server-owned money, stored order snapshot, and error handling.

## Status

DONE — checkout shipped. The `NON_CASH` payment-link branch is superseded by phase 2.8.

## Files

- `src/features/checkout/components/CheckoutForm.tsx`
- `src/schemas/checkout.ts`
- `src/features/checkout/hooks.ts`
- `src/features/checkout/pages/CartPage.tsx`

## Tasks

- [x] React Hook Form + Zod: `customer_name` required and trimmed; `customer_phone` optional, empty maps to `null`.
- [x] `payment_method` radio `CASH` / `NON_CASH`, default `CASH`; helper text for `NON_CASH`.
- [x] Inline Zod errors; never call the API when invalid.
- [x] Submit payload `{ order_type: 'DINE_IN', customer_name, customer_phone, payment_method, items: [{ menu_id, qty, note }] }` with hidden lines removed.
- [x] Empty payload after filtering never calls the API.
- [x] On success: prepend `{ id, snapshot }` to `session.orders`, clear the cart, then branch on payment.
- [x] `CASH` navigates to `/status`; order stays `MENUNGGU` until the cashier confirms.
- [x] `NON_CASH` with a `payment_url` navigates to Snap after the order is stored.
- [x] `NON_CASH` with `payment_url: null` keeps the order, navigates to `/status`, and shows an info toast (Snap failure, EC-05). See phase 2.8 for the card copy.
- [x] `401 UNAUTHORIZED` re-opens the session once and retries; `404` routes to `/tidak-valid`.
- [x] `STORE_CLOSED` toasts, refetches the menu, routes to `/tutup`.
- [x] `STOCK_NOT_ENOUGH` toasts, refetches the menu, keeps the cart; `VALIDATION_ERROR` toasts and keeps the cart.
- [x] `429` backs off with one toast maximum and no immediate retry (submit limit 5/minute).
- [x] Pending state disables the form and steppers and shows a spinner; double submit creates one order.

## Verification

- Empty name shows an inline error and never calls the API.
- Submit stores the card and empties the cart.
- `CASH` lands on `/status`; `NON_CASH` with a URL opens Snap; `NON_CASH` with `null` lands on `/status`.
- `demo-tutup` toasts and routes to `/tutup`; `demo-habis` toasts and refetches without clearing the cart.
- Double-clicking submit creates exactly one order.

## Notes

- Do not clear the cart before the response arrives.
- Do not navigate before the order is written to `session.orders`.
- `service_rate` and `tax_rate` must not be used to preview a total.

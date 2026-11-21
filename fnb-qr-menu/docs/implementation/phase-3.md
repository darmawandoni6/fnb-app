# Phase 3 — API Integration

Granular plan for Phase 3 of `../implementation-plan.md`.

Goal: replace the mock with the real `fnb-server` public API by changing `src/api/` and one env flag. Components, hooks, and screens are untouched.

## Prerequisites

- Phase 2.6 complete: every screen works against the mock.
- `fnb-server` running at `http://localhost:8081` (`make run` in `../fnb-server`).
- Docs read: `../docs/api.md` (Public — customer), `../docs/api-response.md`.

## Steps

### Step 1 — Create the HTTP client

Files: `src/api/client.ts`

- Axios instance with `baseURL` from `VITE_API_URL`.
- No credentials and no cookies; the public API needs neither.
- A request interceptor attaches `X-Session-Token` from the session store for every path except `POST /public/tables/:qr_token/sessions`.
- A response interceptor unwraps `{ success: true, data }` to `data`.
- A response interceptor maps `{ success: false, error }` to `ApiError { code, message, status }`.
- Network failure maps to `ApiError` with `code: 'NETWORK_ERROR'`.

Verify: a request to `/health` resolves through the client without a screen change.

### Step 2 — Implement `openTableSession`

Files: `src/api/session.ts`

```ts
export function openTableSession(qrToken: string): Promise<OpenSessionResponse> {
  return client.post(`/public/tables/${encodeURIComponent(qrToken)}/sessions`)
}
```

- No `X-Session-Token` header on this call.
- `404 NOT_FOUND` means the table is unknown or deactivated.

Verify: `demo-meja` from the seed data returns `session_token` and `table_number`.

### Step 3 — Implement `getPublicMenu`

Files: `src/api/publicMenu.ts`

```ts
export function getPublicMenu(): Promise<PublicMenu> {
  return client.get('/public/menu')
}
```

- The session token travels in the header, not in the path; the function takes no argument.
- Filter empty categories client-side; the server already omits them, so this is a guard only.
- Do not sort or recompute prices.

Verify: the seeded menu returns categories with `cafe_name`, `service_rate`, `tax_rate`, and `is_open`.

### Step 4 — Implement `createPublicOrder`

Files: `src/api/publicOrders.ts`

- `POST /public/orders` with `{ order_type: 'DINE_IN', customer_name, customer_phone, payment_method, items: [{ menu_id, qty, note }] }`.
- Map the response to `OrderStatusResponse` unchanged, including `order_number`, the four money figures, and `payment_url`.
- Never send prices, totals, or stock.

Verify: an order created here appears on the dashboard order board.

### Step 5 — Implement `getPublicOrders`

Files: `src/api/publicOrders.ts`

- `GET /public/orders` returns every order in the session, newest first, each with its items.
- Return `PublicOrderList` unchanged.

Verify: polling observes a dashboard status change within 5 seconds.

### Step 6 — Implement `cancelPublicOrder`

Files: `src/api/publicOrders.ts`

- `POST /public/orders/:id/cancel` with `{ reason }` (reason may be an empty string).
- Return the full order so the card updates without a second call.
- `409 INVALID_TRANSITION` for any order that is not `MENUNGGU` with `payment_status` `BELUM`.

Verify: cancelling an unpaid order returns `DIBATALKAN` with every item `CANCELLED`.

### Step 7 — Flip the switch

Files: `.env`, `src/api/index.ts`

- Set `VITE_USE_MOCKS=false`.
- Confirm the switch picks the HTTP modules and no component changed.

Verify: `git diff --stat` shows changes limited to `src/api/` and `.env`.

### Step 8 — Verify error codes end-to-end

Files: none (manual)

- `UNAUTHORIZED`: clear `sessionToken` in devtools; the client re-opens the session once and the screen keeps working.
- `STORE_CLOSED`: close the store from the dashboard settings, then submit.
- `STOCK_NOT_ENOUGH`: lower an ingredient so a recipe cannot be consumed.
- `NOT_FOUND`: open `/` with a deactivated table token.
- `VALIDATION_ERROR`: submit with an empty `customer_name` through a temporary devtools call.
- `INVALID_TRANSITION`: cancel an already `DIBATALKAN` or `DIPROSES` order from devtools.
- Each error must toast the server `message` and branch on `code`, not text.

Verify: all six behave as in the mock phase.

### Step 9 — Verify the rate limits

Files: none (manual)

- Watch the network log: one `GET /public/orders` per 5 seconds while an order is unfinished (12/minute, limit 30).
- Submit twice inside a minute and confirm the third is rejected with `429` (limit 5/minute) and the UI backs off.
- Confirm polling stops when every stored order is terminal.

Verify: the request rate stays inside both limits with several stored orders.

### Step 10 — Keep the mock, disabled

Files: `src/mocks/`, `docs/tech-stack.md`

- Leave `src/mocks/` in the repo.
- Confirm `VITE_USE_MOCKS=true npm run build` still fails.
- Update `docs/tech-stack.md` if any response shape differed from the mock.

Verify: flipping the flag back to `true` restores the mock experience.

## Phase Checklist

- [ ] `src/api/client.ts` unwraps the envelope, maps errors, and attaches `X-Session-Token`.
- [ ] All five endpoints implemented and typed.
- [ ] `VITE_USE_MOCKS=false` switches to HTTP with no component change.
- [ ] `UNAUTHORIZED`, `STORE_CLOSED`, `STOCK_NOT_ENOUGH`, `NOT_FOUND`, `VALIDATION_ERROR`, and `INVALID_TRANSITION` behave end-to-end.
- [ ] List polling stays at one request per 5 seconds and stops when all orders are terminal.
- [ ] `429` backs off on both the orders list and submit.
- [ ] Mocks remain in the repo and the production guard still fails.
- [ ] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [ ] The full flow runs against `fnb-server` on `:8081`.
- [ ] No component file was modified for integration.
- [ ] Phase 4 can add tests against a stable API surface.

## Gotchas

- The session open call is the only public endpoint without `X-Session-Token`; the interceptor must exempt it.
- Do not store the access token or any cookie; this app is public.
- Do not retry a `429` immediately; the limiter is keyed by session token.

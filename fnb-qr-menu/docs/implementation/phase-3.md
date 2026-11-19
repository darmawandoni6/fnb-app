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
- A response interceptor unwraps `{ success: true, data }` to `data`.
- A response interceptor maps `{ success: false, error }` to `ApiError { code, message }`.
- Network failure maps to `ApiError` with `code: 'NETWORK_ERROR'`.

Verify: a request to `/health` resolves through the client without a screen change.

### Step 2 — Implement `getPublicMenu`

Files: `src/api/publicMenu.ts`

```ts
export function getPublicMenu(qrToken: string): Promise<PublicMenu> {
  return client.get(`/public/tables/${encodeURIComponent(qrToken)}/menu`)
}
```

- Filter empty categories client-side; the server already omits them, so this is a guard only.
- Do not sort or recompute prices.

Verify: `demo-meja` from the seed data returns categories.

### Step 3 — Implement `createPublicOrder`

Files: `src/api/publicOrders.ts`

- `POST /public/tables/:qr_token/orders` with `{ items: [{ menu_id, qty, note }] }`.
- Map the response to `CreatePublicOrderResponse` unchanged.
- Never send prices, totals, or stock.

Verify: an order created here appears on the dashboard order board.

### Step 4 — Implement `getPublicOrder`

Files: `src/api/publicOrders.ts`

- `GET /public/orders/:tracking_token`.
- Return `OrderStatusResponse` unchanged, including `payment_status` and item statuses.

Verify: polling observes a dashboard status change within 5 seconds.

### Step 5 — Implement `cancelOrderItem`

Files: `src/api/publicOrders.ts`

- `POST /public/orders/:tracking_token/cancel` with `{ item_id }`.
- Return the full order response so the card updates without a second call.

Verify: cancelling a `PENDING` item updates totals from the response.

### Step 6 — Flip the switch

Files: `.env`, `src/api/index.ts`

- Set `VITE_USE_MOCKS=false`.
- Confirm the switch picks the HTTP modules and no component changed.

Verify: `git diff --stat` shows changes limited to `src/api/` and `.env`.

### Step 7 — Verify error codes end-to-end

Files: none (manual)

- `STORE_CLOSED`: close the store from the dashboard settings, then submit.
- `STOCK_NOT_ENOUGH`: lower an ingredient so a recipe cannot be consumed.
- `NOT_FOUND`: open `/` with a deactivated table token.
- `VALIDATION_ERROR`: submit an item with `qty: 0` through a temporary devtools call.
- Each error must toast the server `message` and branch on `code`, not text.

Verify: all four behave as in the mock phase.

### Step 8 — Verify the rate limit

Files: none (manual)

- With several orders stored, confirm only the open card polls.
- Watch the network log for one request per 5 seconds.
- A `429` triggers backoff and does not loop.

Verify: the request rate stays at roughly 12/minute.

### Step 9 — Keep the mock, disabled

Files: `src/mocks/`, `docs/tech-stack.md`

- Leave `src/mocks/` in the repo.
- Confirm `VITE_USE_MOCKS=true npm run build` still fails.
- Update `docs/tech-stack.md` if any response shape differed from the mock.

Verify: flipping the flag back to `true` restores the mock experience.

## Phase Checklist

- [ ] `src/api/client.ts` unwraps the envelope and maps errors.
- [ ] All four endpoints implemented and typed.
- [ ] `VITE_USE_MOCKS=false` switches to HTTP with no component change.
- [ ] `STORE_CLOSED`, `STOCK_NOT_ENOUGH`, `NOT_FOUND`, and `VALIDATION_ERROR` behave end-to-end.
- [ ] Polling stays at one request per 5 seconds for the open card.
- [ ] `429` backs off.
- [ ] Mocks remain in the repo and the production guard still fails.
- [ ] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [ ] The full flow runs against `fnb-server` on `:8081`.
- [ ] No component file was modified for integration.
- [ ] Phase 4 can add tests against a stable API surface.

## Gotchas

- `docs/api.md` mentions `GET /public/tables/:code` accepting a `table_number`; the server only exposes `/public/tables/:qr_token/menu`. Use the `qr_token`.
- Do not store the access token or any cookie; this app is public.
- Do not retry a `429` immediately; the limiter is per IP.

# Phase 3 — API Integration

Granular plan for executing phase 3 from `../implementation-plan.md`.

## Scope

Replace the mock with the live `fnb-server` public API by changing `src/api/` and one env flag. Components, hooks, and screens stay untouched.

## Status

DONE — HTTP client, mappers, endpoints, and the env flag are live.

## Depends on

- Phase 2.8 complete.
- `fnb-server` running at `http://localhost:8081`.
- `docs/api.md` (Public — customer), `docs/api-response.md`.

## Files

- `src/api/client.ts` (new), `src/api/session.ts`, `src/api/publicMenu.ts`, `src/api/publicOrders.ts`, `src/api/index.ts`
- `.env`

## Tasks

- [x] Axios instance with `baseURL` from `VITE_API_URL`; no credentials, no cookies.
- [x] Request interceptor attaches `X-Session-Token` from the session store for every path except `POST /public/tables/:qr_token/sessions`.
- [x] Response interceptor unwraps `{ success: true, data }`; maps `{ success: false, error }` to `ApiError { code, message, status }`; maps network failure to `NETWORK_ERROR`.
- [x] `openTableSession(qrToken)` posts the encoded token with no session header; `404 NOT_FOUND` means unknown or inactive table.
- [x] `getPublicMenu()` takes no argument, reads the header from the interceptor, and does not filter, sort, or recompute prices.
- [x] `createPublicOrder` sends `order_type`, `customer_name`, `customer_phone`, `payment_method`, and `items: [{ menu_id, qty, note }]`; never prices, totals, or stock.
- [x] Map the create response unchanged, including `order_number`, four money figures, and nullable `payment_url`.
- [x] Map the list response unchanged; merge and discovery live in `features/orders`.
- [x] `cancelPublicOrder` posts `{ reason }` and returns the full order; `409 INVALID_TRANSITION` means it is no longer `MENUNGGU` + `BELUM`.
- [x] Flip the switch: `VITE_USE_MOCKS=false`; confirm no component changed (`git diff --stat` limited to `src/api/` and `.env`).
- [x] Keep `src/mocks/` in the repo; confirm `VITE_USE_MOCKS=true npm run build` still fails.
- [x] Update `docs/tech-stack.md` if any response shape differs from the mock.

## Verification

- `demo-meja` seed returns `session_token` and `table_number`; the menu loads with `X-Session-Token`.
- Order submit returns `order_number`, totals, and `order_id`, and appears on the dashboard.
- Status changes on the dashboard reach the customer card in under 1 second over the WebSocket; killing the socket falls back to polling within 5 seconds.
- A list poll stays under 30/minute and submit under 5/minute; the sixth submit inside a minute returns `429` and the UI backs off.
- A `NON_CASH` order with `payment_url: null` (Snap failure) is still created, lands on `/status`, and shows no dead payment link.
- Cancelling `MENUNGGU` + `BELUM` restores stock and returns `DIBATALKAN` with updated totals; cancelling while the store is closed succeeds.
- A paid or in-progress order rejects cancel with `409 INVALID_TRANSITION`.
- `UNAUTHORIZED`: clearing the token re-opens the session once; a closed session token returns `401` and recovers the same way.
- `STORE_CLOSED`, `STOCK_NOT_ENOUGH`, `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_TRANSITION`, and `INTERNAL_ERROR` branch on `code`, not text.
- `npm run lint && npm run format:check && npm run build && npm test` pass.

## Notes

- The session open is the only public endpoint without `X-Session-Token`.
- Do not store an access token or cookie; this app is public.
- Do not retry `429` immediately; the limiter is keyed by session token.
- If the socket URL is unreachable, the app must behave exactly like phase 2.8 with polling only.

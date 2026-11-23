# Phase 2.8 — Realtime and Session Sync

Granular plan for executing section 2.8 from `../implementation-plan.md`.

## Scope

Close the customer-app gaps opened by the current contract: the WebSocket `session:{token}` topic, discovery of orders already in the table session, and removing the dead "resume payment" link now that `payment_url` is create-response only. Runs before phase 3; polling stays the fallback.

## Status

DONE — WebSocket, discovery, payment copy, and mock parity shipped.

## Depends on

- Phase 2.6 complete.
- `fnb-server` WebSocket hub on `GET /ws?session=<session_token>` and `subscribe` with `session:<token>`.
- `docs/api.md` §11.4, PRD §7.1, EC-05, EC-14, EC-19, EC-20.

## Files

- `src/api/socket.ts` (new), `src/api/index.ts`
- `src/mocks/socket.ts` (new)
- `src/features/orders/status.ts`
- `src/features/orders/pages/StatusPage.tsx`
- `src/features/orders/components/OrderCard.tsx`
- `src/mocks/handlers/publicOrders.ts`, `src/mocks/data/orders.ts`

## Tasks

### WebSocket

- [x] `sessionSocketUrl(token)` derives `ws://` or `wss://` from `VITE_API_URL` and appends `/ws?session=<token>`; no new env variable.
- [x] `subscribeSessionEvents(token, onEvent): () => void` uses native `WebSocket`; sends `{ "action": "subscribe", "topic": "session:<token>" }` on open.
- [x] Reconnect with exponential backoff 1 s → 2 s → 4 s → 30 s cap; reset on open; stop on cleanup, token change, or all orders terminal.
- [x] `order.created`, `order.updated`, and `item.updated` call `onEvent`; `session.closed` closes the socket and leaves recovery to polling plus the `401` re-open.
- [x] Do not map socket payloads into DTOs; the handler invalidates `ordersQuery(token)` and lets the list fetch the canonical order.
- [x] Mock implementation is a no-op; `src/api/index.ts` remains the only mock/HTTP switch.
- [x] Subscribe only on `/status`, while a session token exists and at least one stored order is unfinished. No socket on `/`.

### Order discovery and merge

- [x] Merge becomes a union: returned orders not yet in `session.orders` are appended; stored entries missing from the response keep their snapshot.
- [x] `useOrderList` runs whenever `sessionToken` exists, not only when a local order is stored.
- [x] `/status` redirects to `/` only after the list query has settled and both the store and the response are empty.
- [x] A second tab or a cleared store opens an existing session and shows its orders (EC-14, EC-20).

### Payment copy

- [x] Remove the "Lanjutkan Pembayaran" link from `OrderCard`; `payment_url` is not persisted and the list returns `null`.
- [x] For `payment_status` `BELUM`, show "Menunggu konfirmasi pembayaran. Tunjukkan pesanan ke kasir." No refund warning.
- [x] Keep the submit branch: navigate to Snap only when the create response carries a non-null `payment_url`; otherwise store the order and go to `/status` with an info toast.

### Mock parity

- [x] `createPublicOrder` returns `paymentUrl` for `NON_CASH`; `getPublicOrders` always returns `paymentUrl: null`.
- [x] Order numbers use `DI-YYYYMMDD-SSS` to match `api.md`; keep the daily sequence in the mock store.

### Docs

- [x] Update `docs/implementation-plan.md`, `phase-2.5`, `phase-2.6`, `phase-3`, `phase-4`, `tech-stack.md`, `qr-menu-structure.md`, `ai-rules.md`, and `AGENTS.md` to match this phase.
- [x] Add a note to `../../docs/api.md`: `payment_url` is meaningful only in the create response and is not persisted.
- [x] Mark `../../docs/prd-v1.1.md` as superseded by `PRD.md`.

## Verification

- Store has orders from a previous tab or after `localStorage` is cleared for `orders` only: opening `/status` lists them.
- A dashboard item change reaches the card in under 1 second; killing the socket resumes 5-second polling without user action.
- `session.closed` does not crash or loop; the next request re-opens the session if possible.
- `NON_CASH` with a null `payment_url` stores the order, lands on `/status`, and shows no dead link.
- Mock order numbers match `DI-YYYYMMDD-SSS`; mock list `paymentUrl` is `null`.
- `npm run lint && npm run format:check && npm run build && npm test` pass.

## Notes

- No new dependency; native `WebSocket`.
- Keep polling at 5 seconds; the socket is an accelerator, not a replacement.
- Do not parse partial socket payloads as orders; the list response is authoritative.
- If the socket is opened by a mock build, the no-op keeps the polling path identical.

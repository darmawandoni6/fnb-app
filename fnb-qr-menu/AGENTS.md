# AGENTS

## Read first

Project docs live in `docs/` and are the source of truth:

- `docs/tech-stack.md` — selected stack, screens, session store, public API, polling, error codes, reference gaps.
- `docs/ai-rules.md` — coding rules for AI (no `any`, API layer boundaries, session/cart rules, money rules).
- `docs/conventions.md` — naming: `SCREAMING_SNAKE_CASE` constants in `src/constants/`, `camelCase` variables, `as const` object maps instead of TS `enum`.
- `docs/qr-menu-structure.md` — routes, search params, folder layout, session store shape, cart rules.
- `docs/implementation-plan.md` + `docs/implementation/phase-*.md` — per-phase, per-screen plan; the plan file is the index.
- Sibling docs in `../docs/`: `PRD.md` (§2.3, §4.7, §5, §7.1), `api.md` (Public — customer), `api-response.md` (envelope), `flow.md`, `doc-naming.md` + `doc-language.md`.

Screen slicing is adapted from `/home/doni/me/iul-fnb/apps/qr-menu`. Keep the six screens and the session store model; do not copy its TanStack Start/SSR setup or its `pl-*` CSS.

The checklist gates every commit.

## Status

Phases 0–3 and 5 are shipped against the current `../docs/api.md` contract: table session token, order-level cancel, checkout form, list polling, menu polling, the `session:{token}` WebSocket, order discovery, and the HTTP layer behind `@/api`. The status card also shows a "Tunjukkan QR" dialog encoding `${VITE_DASHBOARD_URL}/orders?q=<order_number>`, so a cashier scan opens the dashboard board already filtered. `VITE_USE_MOCKS=false` in local `.env`; the mock layer stays in the repo and `.env.example` keeps mocks on. Phase 4 tracks the remaining manual device and keyboard passes.

## Plan conventions

- Phase 2 files slice one screen or feature each; phase 2.8 covers the WebSocket `session:{token}` topic, order discovery, and the removal of the non-persisted payment link.
- Phase 3 changes `src/api/` and the env flag only; components and hooks stay untouched.
- `src/api/index.ts` is the only mock/HTTP switch; components import from `@/api` only.
- Mock scenarios are picked by `qr_token` (`demo-meja`, `demo-tutup`, `demo-habis`, `demo-invalid`).
- A production build with `VITE_USE_MOCKS=true` fails in `vite.config.ts`.

## Commands

Commands, matching `fnb-dashboard`:

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build (`tsc -b && vite build`)
- `npm run lint` — `oxlint src`
- `npm run format` / `npm run format:check` — Prettier
- `npm run test` — Vitest
- `npm run preview` — serve production build

Verification order before commit: `npm run lint && npm run format:check && npm run build && npm run test`.

## Environment

- Backend API at `http://localhost:8081` (see `../fnb-server/AGENTS.md` for how to run it). The dev server proxies `/public` and `/ws` there, so `VITE_API_URL` stays empty locally; the server has no CORS middleware by design.
- `VITE_API_URL` and `VITE_USE_MOCKS` in `.env` / `.env.example`; only `VITE_*` vars reach the client bundle. Never put secrets in `VITE_*`.
- No `VITE_QR_MENU_URL` here; the dashboard owns that variable and encodes `${VITE_QR_MENU_URL}/?meja=<qr_token>`.
- Ports 8080/5432 may be occupied by other local projects; the API uses 8081.

## Architecture

- Public SPA for customers. No login, no roles, no auth guards. `react-router-dom` only — no SSR, no `@tanstack/react-router`, no nitro.
- Routes: `/`, `/menu/:menuId`, `/keranjang`, `/status`, `/tidak-valid`, `/tutup`. Search params: `?meja` (table `qr_token`) on `/`, `?edit` (cart line key) on `/menu/:menuId`.
- Customer state is one versioned `localStorage` record (`fnb-qr-menu:session`, `v: 1`) read with `useSyncExternalStore`: `qr`, `sessionToken`, `cart`, `orders[]`, `browseOnly`, `invalidTable`. Each order keeps `{ id, snapshot }`; `orders` has no size cap and no clear action. A different `qr` resets the cart, orders, and `sessionToken`.
- The session token comes from `POST /public/tables/:qr_token/sessions` and travels as `X-Session-Token` on every public call except the open itself. On `401` the client re-opens the session from the stored `qr` once; `404` routes to `/tidak-valid`.
- Dependency direction: `features → api → server`. Components import from `@/api` only; no direct `fetch`/axios outside `src/api/`.
- The client sends `order_type`, `customer_name`, `customer_phone`, `payment_method`, and `items: [{ menu_id, qty, note }]`. Prices, service, tax, totals, stock, and order status are server-owned. The cart shows unit prices only and never an aggregate total. `NON_CASH` submit stores the order, then navigates to `payment_url` only when the create response carries it; a `null` URL (Snap failure) leaves the order unpaid and routes to `/status`. `payment_url` is not persisted, so there is no resume-payment link.
- Cart rules: merge by `menuId|note.trim().toLowerCase()`, `MAX_QTY` 50, `NOTE_MAX` 120.
- Polling: TanStack Query `refetchInterval: 5_000` on `/status`, one `GET /public/orders` list request for all cards. Stops when every stored order is `SELESAI`/`DIBATALKAN` or on unmount. Phase 2.8 adds the `session:{token}` WebSocket as an accelerator; polling stays the fallback.
- Cancellation is order-level: `POST /public/orders/:id/cancel` with `{ reason }`, only while the order is `MENUNGGU` with `payment_status` `BELUM`. No item-level cancel, no refund warning in v1.
- API errors use envelope codes (`UNAUTHORIZED`, `STORE_CLOSED`, `STOCK_NOT_ENOUGH`, `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_TRANSITION`). Branch on `code`, display `message`. See `../docs/api-response.md`.
- Ordering is disabled while `is_open` is `false`.
- The menu response returns no `table_number` (only the session open does), no opening hours, and no order timeline; the header shows `cafe_name` plus optional leading/trailing slots, and the stepper derives from item statuses.
- Unit tests are Vitest only (`cart`, `session`, `status`, plus socket/merge cases in phase 4 per PRD §15).

## Tooling quirks

- Before installing or configuring any external package, check its latest registry version with `npm view <package> version` and fetch current API/configuration docs through Context7 MCP (`resolve-library-id` then `query-docs`).
- Prettier runs two plugins: `@trivago/prettier-plugin-sort-imports` first, `prettier-plugin-tailwindcss` last. Import order is copied from `../fnb-dashboard/.prettierrc`.
- This machine's npm enforces `allow-scripts`; keep project `.npmrc` to the dashboard's `allow-scripts=9router` list.
- shadcn components are source-owned in `src/components/ui/`; check for a stray `@/` folder after `npx shadcn add`.
- Alias `@/` → `src/` must be configured in both `tsconfig.json` (paths, no `baseUrl`) and `vite.config.ts` (`import.meta.dirname`).

## Docs

- All docs are English; UI copy is Indonesian. Domain values stay literal: `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN`, `PENDING`, `COOKING`, `READY`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `BELUM`, `LUNAS`, `CASH`, `NON_CASH`. Customer labels "siap" and "dalam pengantaran" are derived from item statuses, never stored.
- File naming `kebab-case.md`; see `../docs/doc-naming.md`.

## Git

- Conventional Commits: `type(scope): summary` — see `../docs/git.md`.
- Always propose the commit message and wait for user confirmation before committing or pushing. Never auto-commit.
- `.env` is gitignored. Never commit it, `node_modules/`, or tokens.

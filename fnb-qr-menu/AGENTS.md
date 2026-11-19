# AGENTS

## Read first

Project docs live in `docs/` and are the source of truth:

- `docs/tech-stack.md` — selected stack, screens, session store, public API, polling, error codes, reference gaps.
- `docs/ai-rules.md` — coding rules for AI (no `any`, API layer boundaries, session/cart rules, money rules).
- `docs/conventions.md` — naming: `SCREAMING_SNAKE_CASE` constants in `src/constants/`, `camelCase` variables, `as const` object maps instead of TS `enum`.
- `docs/qr-menu-structure.md` — routes, search params, folder layout, session store shape, cart rules.
- `docs/implementation-plan.md` + `docs/implementation/phase-0.md` … `phase-4.md` — phased plan; the plan file is the index.
- Sibling docs in `../docs/`: `PRD.md` (§2.3, §6.1), `api.md` (Public — customer), `api-response.md` (envelope), `flow.md`, `doc-naming.md` + `doc-language.md`.

Screen slicing is adapted from `/home/doni/me/iul-fnb/apps/qr-menu`. Keep the six screens and the session store model; do not copy its TanStack Start/SSR setup or its `pl-*` CSS.

The checklist gates every commit.

## Status

Planned only — no code scaffolded yet. `fnb-qr-menu/` contains documentation. Next step: `docs/implementation/phase-0.md`; after each phase, the next file in the index table.

## Plan conventions

- Phase 2 steps are tagged `[MOCK]` (buildable against `src/mocks/`) or untagged (UI-only).
- `[TODO-API]` steps belong to Phase 3 and never leak into Phase 2.
- `src/api/index.ts` is the only mock/HTTP switch; components import from `@/api` only.
- Mock scenarios are picked by `qr_token` (`demo-meja`, `demo-tutup`, `demo-habis`, `demo-invalid`).
- A production build with `VITE_USE_MOCKS=true` fails in `vite.config.ts`.

## Commands

Planned, matching `fnb-dashboard`:

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build (`tsc -b && vite build`)
- `npm run lint` — `oxlint src`
- `npm run format` / `npm run format:check` — Prettier
- `npm run preview` — serve production build

Verification order before commit: `npm run lint && npm run format:check && npm run build`.

## Environment

- Backend API at `http://localhost:8081` (see `../fnb-server/AGENTS.md` for how to run it).
- `VITE_API_URL` and `VITE_USE_MOCKS` in `.env` / `.env.example`; only `VITE_*` vars reach the client bundle. Never put secrets in `VITE_*`.
- No `VITE_QR_MENU_URL` here; the dashboard owns that variable and encodes `${VITE_QR_MENU_URL}/?meja=<qr_token>`.
- Ports 8080/5432 may be occupied by other local projects; the API uses 8081.

## Architecture

- Public SPA for customers. No login, no roles, no auth guards. `react-router-dom` only — no SSR, no `@tanstack/react-router`, no nitro.
- Routes: `/`, `/menu/:menuId`, `/keranjang`, `/status`, `/tidak-valid`, `/tutup`. Search params: `?meja` (table `qr_token`) on `/`, `?edit` (cart line key) on `/menu/:menuId`.
- Customer state is one versioned `localStorage` record (`fnb-qr-menu:session`, `v: 1`) read with `useSyncExternalStore`: `qr`, `cart`, `orders[]`, `browseOnly`, `invalidTable`. Each order keeps `{ id, trackingToken, snapshot }`; `orders` has no size cap and no clear action. A different `qr` resets the cart and orders.
- Dependency direction: `features → api → server`. Components import from `@/api` only; no direct `fetch`/axios outside `src/api/`.
- The client sends `menu_id`, `qty`, and `note` only. Prices, tax, totals, stock, and order status are server-owned. The cart shows unit prices only and never an aggregate total.
- Cart rules: merge by `menuId|note.trim().toLowerCase()`, `MAX_QTY` 50, `NOTE_MAX` 120.
- Polling: TanStack Query `refetchInterval: 5_000` on `/status`, and only for the open accordion card; collapsed cards render from `snapshot`. Stops when that order is `SELESAI`/`DIBATALKAN` or on unmount.
- API errors use envelope codes (`STORE_CLOSED`, `STOCK_NOT_ENOUGH`, `NOT_FOUND`, `VALIDATION_ERROR`). Branch on `code`, display `message`. See `../docs/api-response.md`.
- Ordering is disabled while `is_open` is `false`.
- The API returns no `table_number`, no opening hours, and no order timeline; the header shows `cafe_name` only and the stepper derives from the aggregate `status`.
- Unit tests are Vitest only (`cart`, `session`, `status`), delivered in Phase 4 per PRD §12.

## Tooling quirks

- Before installing or configuring any external package, check its latest registry version with `npm view <package> version` and fetch current API/configuration docs through Context7 MCP (`resolve-library-id` then `query-docs`).
- Prettier runs two plugins: `@trivago/prettier-plugin-sort-imports` first, `prettier-plugin-tailwindcss` last. Import order is copied from `../fnb-dashboard/.prettierrc`.
- This machine's npm enforces `allow-scripts`; keep project `.npmrc` to the dashboard's `allow-scripts=9router` list.
- shadcn components are source-owned in `src/components/ui/`; check for a stray `@/` folder after `npx shadcn add`.
- Alias `@/` → `src/` must be configured in both `tsconfig.json` (paths, no `baseUrl`) and `vite.config.ts` (`import.meta.dirname`).

## Docs

- All docs are English; UI copy is Indonesian. Domain values stay literal: `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, `SELESAI`, `DIBATALKAN`, `PENDING`, `COOKING`, `READY`, `DELIVERED`, `CANCELLED`, `BELUM`, `LUNAS`, `CASH`, `NON_CASH`.
- File naming `kebab-case.md`; see `../docs/doc-naming.md`.

## Git

- Conventional Commits: `type(scope): summary` — see `../docs/git.md`.
- Always propose the commit message and wait for user confirmation before committing or pushing. Never auto-commit.
- `.env` is gitignored. Never commit it, `node_modules/`, or tokens.

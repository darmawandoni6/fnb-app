# Phase 1 — Setup

Granular plan for executing Phase 1 from `../implementation-plan.md`.

Goal: a working Vite + React + TypeScript shell with tooling, shared constants and types, and an in-memory mock backend so Phase 2 slices UI without a running `fnb-server`.

## Status

DONE — all tasks complete. Verified against the code, not just claimed:
`src/constants/` holds 10 modules, `src/types/` 10 modules, `src/mocks/` 8 fixture modules and 12 handler modules, `src/api/index.ts` re-exports the mock module, and the self check is wired in `src/main.tsx` behind `VITE_RUN_MOCK_SELFCHECK=true`.

## Tasks

### Scaffold and tooling

- [x] Scaffold Vite + React + TypeScript into `fnb-dashboard/` (scaffolded in a temp dir, then copied). Vite 8, TypeScript 7, React 19.
- [x] Strict type checking. TypeScript 7 enables it by default; no explicit `strict` key needed. Verified with probes: assigning `null` to `string` gives `TS2322`, and an untyped parameter gives `TS7006`.
- [x] Tailwind CSS v4 through `@tailwindcss/vite`.
- [x] shadcn/ui source-owned components in `src/components/ui/`.
- [x] Alias `@/*` in `tsconfig.app.json` (`paths`) and `vite.config.ts` (`resolve.alias`); the root `tsconfig.json` only holds project references. No `baseUrl` (TypeScript 7 dropped it).
- [x] Prettier with `@trivago/prettier-plugin-sort-imports` first and `prettier-plugin-tailwindcss` last.
- [x] Lint with `oxlint src`.
- [x] Scripts `dev`, `build`, `lint`, `format`, `format:check`, `preview`.

### Environment

- [x] `.env.example` with `VITE_API_URL`, `VITE_USE_MOCKS`, `VITE_QR_MENU_URL`.
- [x] `src/lib/mode.ts` reads `VITE_USE_MOCKS` (defaults to mock mode).

### Constants

- [x] `src/constants/`: `roles.ts`, `orderStatus.ts`, `itemStatus.ts`, `paymentStatus.ts`, `orderType.ts`, `paymentMethod.ts`, `stockMovementType.ts`, `routes.ts`, `errors.ts`, `index.ts` — ten modules.
- [x] All values use `as const` maps; no TypeScript `enum`.
- [x] `TERMINAL_ITEM_STATUS` covers `COMPLETED` and `CANCELLED` only.

### Domain types

- [x] `src/types/`: `api.ts` (success and error envelope, `ApiError`), `order.ts`, `menu.ts`, `table.ts`, `user.ts`, `stock.ts`, `settings.ts`, `report.ts`, `navigation.ts`.
- [x] Types mirror `../../docs/api.md` field names; money is `number` in integer rupiah.

### App shell

- [x] `src/main.tsx` renders `App.tsx`.
- [x] `App.tsx` wires `QueryClientProvider`, `AuthProvider`, `TooltipProvider`, `RouterProvider`, `Toaster`.
- [x] Routes and role guards declared in `App.tsx`; sidebar groups in `src/auth/guards.tsx` (`dashboardNavGroups`).
- [x] `RoleHome` sends `KITCHEN` to `/kitchen` and the other roles to `/orders`.

### Mock harness

- [x] `src/mocks/db.ts` in-memory store shared by all handlers.
- [x] `src/mocks/data/` fixtures for orders, menus, tables, users, ingredients, stock movements, settings, reports.
- [x] `src/mocks/handlers/` one module per resource, all exporting async functions with production signatures.
- [x] `src/mocks/handlers/shared.ts`: `requireRole`, `fail`, `findOrThrow`, `audit`, `delay` (200–500 ms).
- [x] `src/mocks/handlers/deriveStatus.ts` mirrors PRD §5.3 order status derivation.
- [x] `src/mocks/selfcheck.ts` contract assertions behind `VITE_RUN_MOCK_SELFCHECK=true`.
- [x] `src/api/index.ts` re-exports the mock module so components never import `src/mocks/` directly.

## Verification

- Manual: `npm run lint`, `npm run format:check`, `npm run build`, `VITE_RUN_MOCK_SELFCHECK=true npm run dev`.
- Covered by `phase-4-verification.md`.

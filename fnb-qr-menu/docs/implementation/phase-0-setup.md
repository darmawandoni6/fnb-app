# Phase 0 — Setup

Granular plan for executing phase 0 from `../implementation-plan.md`.

## Scope

Running Vite React TypeScript SPA with the iul design tokens, the tooling baseline, shared constants, types, lib helpers, the single mock/HTTP switch, and the session-store skeleton. No screens yet.

## Status

DONE — scaffold and foundation shipped.

## Files

- `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`
- `src/index.css`, `src/constants/`, `src/types/`, `src/lib/`
- `src/api/index.ts`, `src/api/session.ts`, `src/api/publicMenu.ts`, `src/api/publicOrders.ts`, `src/api/notImplemented.ts`
- `src/features/session/store.ts`

## Tasks

- [x] Scaffold Vite React TypeScript using a workdir-relative temp directory (`npm create vite` is interactive under the agent shell).
- [x] Install runtime dependencies: `react-router-dom`, `@tanstack/react-query`, `axios`, `zod`, `react-hook-form`, `@hookform/resolvers`.
- [x] Install tooling: Prettier plus both plugins, Oxlint, Tailwind CSS v4, shadcn/ui.
- [x] Port the iul design tokens into `@theme`; fonts load locally through `@fontsource` packages.
- [x] Configure `@/*` → `src/` in both `tsconfig.app.json` (`paths`, no `baseUrl`) and `vite.config.ts` (`import.meta.dirname`).
- [x] Copy the tooling baseline from `../fnb-dashboard`: `.prettierrc`, `.prettierignore`, `.oxlintrc.json`, `.npmrc`.
- [x] Add scripts: `dev`, `build`, `lint`, `format`, `format:check`, `preview`, `test`.
- [x] Add `.env.example` with `VITE_API_URL=http://localhost:8081` and `VITE_USE_MOCKS=true`; `.env` stays gitignored.
- [x] Create constants maps with `as const`: order status, item status, payment status, payment method, cart limits, storage key, query keys, routes, error codes, mock tokens.
- [x] Create envelope and domain types in `src/types/`, plus `isApiError`, `formatRupiah`, `useNow`, and `useMocks`.
- [x] Create `src/api/index.ts` as the only mock/HTTP switch; both sides throw `NOT_IMPLEMENTED` until phases 1 and 3.
- [x] Create the versioned session store skeleton: `v: 1`, `qr`, `sessionToken`, `cart`, `orders`, `browseOnly`, `invalidTable`, `updatedAt`.
- [x] Use `useSyncExternalStore`, storage-event sync, in-memory fallback, and empty state for corrupt or unknown versions.

## Verification

- `npm run dev` serves the shell.
- `npm run lint && npm run format:check && npm run build` pass.
- Tokens render (`bg-canvas`, `text-text`, `font-ui`).
- `VITE_USE_MOCKS=true` fails a production build; the guard lives in `vite.config.ts`.
- A throwaway component can add a cart line and survive a reload.

## Notes

- No `VITE_QR_MENU_URL` here; the dashboard produces the QR link.
- The session open returns `table_number`; the menu response repeats neither the table number nor opening hours.
- Rate limits are keyed by session token: create 5/minute, list 30/minute. One 5-second poll is 12/minute.

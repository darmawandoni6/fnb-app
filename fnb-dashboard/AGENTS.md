# AGENTS

## Read first

Project docs live in `docs/` and are the source of truth:

- `docs/tech-stack.md` — selected stack, auth flow, polling rules, error-code handling.
- `docs/ai-rules.md` — coding rules for AI (no `any`, API layer boundaries, polling cleanup, money rules).
- `docs/conventions.md` — naming: `SCREAMING_SNAKE_CASE` constants in `src/constants/`, `camelCase` variables, `as const` object maps instead of TS `enum`.
- `docs/dashboard-structure.md` — folder layout.
- `docs/implementation-plan.md` + `docs/implementation/phase-0.md` — phased implementation plan.
- Sibling docs in `../docs/`: `PRD.md` (§5 status matrices), `api.md` (endpoints), `api-response.md` (envelope), `flow.md`, `doc-naming.md` + `doc-language.md` (documentation standards).

The checklist gates every commit.

## Status

Phase 2 complete: mock UI slicing done. App shell, auth (mock role login), cashier order board, kitchen board, manual order dialog, owner stub pages. Next phase: API integration per `docs/implementation-plan.md` Phase 3.

Environment gotchas learned during Phase 0:

- `npm create vite` is interactive under the agent shell; scaffold to a temp dir under the workdir then `cp -R` (a `/tmp` path gets created inside the workdir by npm, so use a workdir-relative temp path and clean up).
- This machine's npm enforces `allow-scripts` (`~/.npmrc` has `allow-scripts=9router`). The shadcn CLI shells out to `npm install` and trips `EALLOWSCRIPTS`. Workaround: pre-install the packages yourself (`npm install cn sonner next-themes class-variance-authority radix-ui lucide-react tw-animate-css`), then run `npx shadcn@latest add ...`; the CLI's own install becomes a no-op. Keep project `.npmrc` to `allow-scripts=9router` only.
- shadcn CLI may write components into a literal `@/` directory instead of `src/` when resolution misbehaves — after `add`, check for a stray `@/` folder and move files into `src/`.
- TypeScript 7 removed `baseUrl`; use `paths` alone: `"paths": {"@/*": ["./src/*"]}`.
- Vite 8 warns on `__dirname` in config; use `import.meta.dirname`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build (`tsc -b && vite build`)
- `npm run lint` — `oxlint src`
- `npm run format` / `npm run format:check` — Prettier
- `npm run preview` — serve production build

Verification order before commit: `npm run lint && npm run format:check && npm run build`.

## Environment

- Backend API at `http://localhost:8081` (see `../fnb-server/AGENTS.md` for how to run it). Start the server before manual testing.
- `VITE_API_URL` in `.env` / `.env.example`; only `VITE_*` vars reach the client bundle. Never put secrets in `VITE_*`.
- Ports 8080/5432 may be occupied by other local projects; the API uses 8081.

## Architecture

- SPA for three roles in one build: `OWNER`, `CASHIER`, `KITCHEN`. Role guards live in `src/auth/`; UI hiding is never a substitute for server authorization.
- Dependency direction: `components/features → api → server`. No direct `fetch`/axios outside `src/api/`.
- Status order (`MENUNGGU…SELESAI`) and item status (`PENDING → COOKING → READY → DELIVERED`) transitions are computed by the backend. The client reads aggregates and sends transitions; it never recalculates status or money (integer rupiah only).
- Polling: TanStack Query `refetchInterval: 5_000` per PRD; kitchen board queries `?status=DIPROSES`. Stop polling on unmount (Query does this automatically).
- Auth: access token in memory only; refresh via httpOnly cookie (`POST /auth/refresh` on load and on 401, retry once). Never store tokens in `localStorage`.
- API errors use envelope codes (`PAYMENT_REQUIRED`, `INVALID_TRANSITION`, `STOCK_NOT_ENOUGH`, `STORE_CLOSED`). Branch on `code`, display `message`. See `../docs/api-response.md`.

## Tooling quirks

- Before installing or configuring any external package, check its latest registry version with `npm view <package> version` and fetch current API/configuration docs through Context7 MCP (`resolve-library-id` then `query-docs`). Context7 supplies documentation; npm registry supplies package versions.
- Prettier runs two plugins: `@trivago/prettier-plugin-sort-imports` first, `prettier-plugin-tailwindcss` last. Import group order is defined in `.prettierrc` `importOrder` and matches `docs/conventions.md`.
- shadcn components are source-owned in `src/components/ui/`; edit them in place, check `components.json` aliases before adding new ones.
- Alias `@/` → `src/` must be configured in both `tsconfig.json` (paths) and `vite.config.ts` (resolve.alias).

## Git

- Conventional Commits: `type(scope): summary` — see `../docs/git.md`.
- Branch `master`, remote `origin`.
- Always propose the commit message and wait for user confirmation before committing or pushing. Never auto-commit.
- `.env` is gitignored. Never commit it, `node_modules/`, or tokens.

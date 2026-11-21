# Phase 0 — Scaffold and Foundation

Granular plan for Phase 0 of `../implementation-plan.md`.

Goal: a running Vite React TypeScript SPA with the iul design tokens, the tooling baseline, the shared constants/types/lib helpers, and the single mock/HTTP switch. No screens yet.

## Prerequisites

None.

## Steps

### Step 1 — Scaffold Vite React TypeScript

Files: `fnb-qr-menu/*`

```bash
npm create vite@latest tmp-scaffold -- --template react-ts
cp -R tmp-scaffold/. .
rm -rf tmp-scaffold
```

`npm create vite` is interactive under the agent shell, so scaffold into a workdir-relative temp directory. A `/tmp` path gets created inside the workdir by npm.

Verify: `npm run dev` serves the default Vite page.

### Step 2 — Install runtime dependencies

Files: `package.json`

```bash
npm view react-router-dom version
npm install react-router-dom @tanstack/react-query axios zod react-hook-form @hookform/resolvers
```

Check each version with `npm view <package> version` before installing.

Verify: `npm run dev` still starts.

### Step 3 — Install tooling dependencies

Files: `package.json`

```bash
npm install -D prettier @trivago/prettier-plugin-sort-imports prettier-plugin-tailwindcss oxlint
```

Verify: `npx prettier --version`.

### Step 4 — Set up Tailwind CSS v4 and shadcn/ui

Files: `src/index.css`, `vite.config.ts`, `components.json`

```bash
npm install tailwindcss @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge radix-ui lucide-react tw-animate-css
npx shadcn@latest init
npx shadcn@latest add button card badge dialog sheet skeleton input label textarea \
  alert-dialog separator sonner tabs empty
```

The shadcn CLI shells out to `npm install` and trips `EALLOWSCRIPTS` on this machine. Pre-install the packages first so the CLI's own install becomes a no-op.

After `add`, check for a literal `@/` directory and move any files into `src/`.

Verify: `npm run build` passes with an empty `src/App.tsx` shell.

### Step 5 — Port the iul design tokens

Files: `src/index.css`

Source: `/home/doni/me/iul-fnb/apps/qr-menu/src/styles/tokens.css`.

```css
@import 'tailwindcss';

@theme {
  --color-canvas: #fbf5f0;
  --color-canvas-warm: #fff8f1;
  --color-surface: #ffffff;
  --color-surface-muted: #f3ebe4;
  --color-text: #1d1e1c;
  --color-text-muted: #6a696a;
  --color-text-faint: #858585;
  --color-border: rgb(29 30 28 / 10%);
  --color-accent: #fa5d00;
  --color-accent-soft: rgb(250 93 0 / 10%);
  --color-accent-text: #c1490b;
  --color-positive: #23a40c;
  --color-warning: #f18d2a;
  --color-danger: #cb5c5b;
  --color-focus-ring: #fa5d00;

  --font-ui: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-editorial: 'IBM Plex Serif', ui-serif, Georgia, serif;

  --radius-compact: 10px;
  --radius-image: 16px;
  --radius-card: 20px;
  --radius-control: 30px;
}
```

Fonts load locally through `@fontsource-variable/inter` and `@fontsource/ibm-plex-serif`; iul loads them from a CDN, which this app must not depend on.

Do not copy `styles/pages/*.css`. Rebuild each screen with Tailwind utilities and shadcn components.

Verify: a page using `bg-canvas text-text font-ui` renders the warm background.

### Step 6 — Configure the `@/*` alias

Files: `tsconfig.json`, `tsconfig.app.json`, `vite.config.ts`

- `tsconfig.app.json`: `"paths": { "@/*": ["./src/*"] }`. Do not use `baseUrl`; TypeScript 7 removed it.
- `vite.config.ts`: `resolve.alias` `@` → `src`.
- Vite 8 warns on `__dirname`; use `import.meta.dirname`.

Verify: `import { cn } from '@/lib/utils'` typechecks.

### Step 7 — Copy the tooling baseline

Files: `.prettierrc`, `.prettierignore`, `.oxlintrc.json`, `.npmrc`

Copy from `../fnb-dashboard`. Keep the same plugin order and `importOrder`; its group order matches `docs/conventions.md`.

`.npmrc` keeps the dashboard's `allow-scripts=9router` list.

Verify: `npx prettier --check src` reports no config error.

### Step 8 — Configure scripts

Files: `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint src",
    "preview": "vite preview",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Verify: `npm run lint && npm run format:check && npm run build` all pass.

### Step 9 — Set up `.env.example`

Files: `.env.example`, `.gitignore`

```env
VITE_API_URL=http://localhost:8081
VITE_USE_MOCKS=true
```

`.gitignore` must cover `.env`, `node_modules/`, and `dist/`.

Verify: `git status --short` shows no `.env`.

### Step 10 — Create constants `[REWORK]`

Files: `src/constants/`

```text
orderStatus.ts     ORDER_STATUS map + OrderStatus type
itemStatus.ts      ITEM_STATUS map + ItemStatus type
paymentStatus.ts   PAYMENT_STATUS map + PaymentStatus type
paymentMethod.ts   PAYMENT_METHOD map (CASH, NON_CASH) + PaymentMethod type
cart.ts            MAX_QTY 50, NOTE_MAX 120
storage.ts         SESSION_STORAGE_KEY, SESSION_VERSION
queryKeys.ts       query key factories
routes.ts          ROUTES map
errors.ts          API_ERROR codes
mockTokens.ts      MOCK_TABLE_TOKEN map
```

All maps use `as const`. Names follow `docs/conventions.md`.

Verify: `npm run build` passes; no magic string remains in a component later.

### Step 11 — Create types and lib helpers `[REWORK]`

Files: `src/types/`, `src/lib/`

- `src/types/api.ts` — success and error envelope types, `ApiError` shape.
- `src/types/menu.ts` — `PublicMenu`, `MenuCategory`, `MenuItem`.
- `src/types/order.ts` — `OpenSessionResponse`, `PublicOrder`, `PublicOrderItem`, `OrderStatusResponse`, `PublicOrderList`, `CreatePublicOrderRequest`, `CancelPublicOrderRequest`.
- `src/lib/apiError.ts` — `isApiError` type guard.
- `src/lib/formatRupiah.ts` — `Intl.NumberFormat('id-ID')`.
- `src/lib/useNow.ts` — ticking clock hook for relative time.
- `src/lib/mode.ts` — `export const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'`.

Types mirror `../docs/api.md`: `session_token` from the session open; `cafe_name`, `service_rate`, `tax_rate`, `is_open` from the menu; the order payload carries `order_type`, `customer_name`, `customer_phone`, `payment_method`, `items[{menu_id, qty, note}]`; the order response carries `id`, `order_number`, `status`, `payment_status`, `subtotal_amount`, `service_amount`, `tax_amount`, `total_amount`, `payment_url`, `items[{id, menu_id, menu_name_snapshot, qty, price, status, note}]`. There is no `tracking_token` anywhere.

Verify: `npm run build` passes.

### Step 12 — Create the mock/HTTP switch `[REWORK]`

Files: `src/api/index.ts`, `src/api/session.ts`, `src/api/publicMenu.ts`, `src/api/publicOrders.ts`

```ts
import * as mocks from '@/mocks'

import { useMocks } from '@/lib/mode'

import * as httpMenu from './publicMenu'
import * as httpOrders from './publicOrders'
import * as httpSession from './session'

export const openTableSession = useMocks ? mocks.openTableSession : httpSession.openTableSession
export const getPublicMenu = useMocks ? mocks.getPublicMenu : httpMenu.getPublicMenu
export const createPublicOrder = useMocks ? mocks.createPublicOrder : httpOrders.createPublicOrder
export const getPublicOrders = useMocks ? mocks.getPublicOrders : httpOrders.getPublicOrders
export const cancelPublicOrder = useMocks ? mocks.cancelPublicOrder : httpOrders.cancelPublicOrder
```

Phase 1 fills the mock modules; Phase 3 fills the HTTP modules. Until then both sides export typed stubs that throw `NOT_IMPLEMENTED`. The old `getPublicOrder` / `cancelOrderItem` exports are removed with the rework.

Verify: importing from `@/api` typechecks with no mock or HTTP detail leaking into a component.

### Step 13 — Create the session store skeleton `[REWORK]`

Files: `src/features/session/store.ts`

- `CustomerSession` with `v: 1`, `qr`, `sessionToken`, `cart`, `orders`, `browseOnly`, `invalidTable`, `updatedAt`.
- `TrackedOrder` is `{ id, snapshot }`; there is no `trackingToken`.
- `read`, `write`, `subscribe` with a `storage` listener.
- `useCustomerSession()` returning `[session, update]` via `useSyncExternalStore`.
- Storage failures fall back to memory; corrupt or unknown versions start empty.

Verify: a throwaway component can add a cart line and survives a reload.

## Phase Checklist

- [x] `npm run dev` serves the shell.
- [x] `npm run lint && npm run format:check && npm run build` pass.
- [x] `@/*` alias works in both `tsconfig` and Vite.
- [x] Tokens render (`bg-canvas`, `text-text`, `font-ui`).
- [x] `.env.example` lists `VITE_API_URL` and `VITE_USE_MOCKS`; no `.env` staged.
- [x] `src/api/index.ts` exists and every later import targets `@/api`.
- [x] Session store round-trips a cart line.

## Exit Criteria

- [x] `npm run lint && npm run format:check && npm run build` pass.
- [x] Phase 1 starts from a green build; screens arrive in Phase 2.

## Gotchas

- Do not commit `.env`, `node_modules/`, or any token.
- `VITE_USE_MOCKS=true` must fail a production build; the guard lands with `src/api/index.ts`.
- QR Menu has no `VITE_QR_MENU_URL`; it is the target of the QR link, not the producer.
- The session open returns `table_number`; the menu response has no opening hours and no order timeline.
- Rate limits are keyed by session token: `POST /public/orders` 5/minute, `GET /public/orders` 30/minute. One list poll every 5 seconds is 12/minute.
- The client must never compute subtotal, tax, or total.

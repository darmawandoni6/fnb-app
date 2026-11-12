# Phase 0 — Scaffold and Foundation

Granular plan for executing Phase 0 from `../implementation-plan.md`.

Each step has its outputs and verification. Run steps in order.

## Step 1 — Scaffold Vite React TypeScript

Interactive scaffolding is unreliable in an agent shell. Scaffold into a temp directory, then move the files.

```bash
rm -rf fnb-dashboard/node_modules
rm -rf /tmp/opencode/fnb-scaffold
npm create vite@latest /tmp/opencode/fnb-scaffold -- --template react-ts
cp -R /tmp/opencode/fnb-scaffold/. fnb-dashboard/
```

Generated files:

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`
- `eslint.config.js` or `.oxlintrc.json` (depends on the template)
- `.gitignore`

Notes:

- Do not overwrite the existing `docs/`, `AGENTS.md`, and `src/assets/`.
- Delete unused template files: `src/App.css`, `public/vite.svg`, demo assets.

Verification:

- `ls fnb-dashboard` shows `package.json` and `src/`.
- Existing docs files remain.

## Step 2 — Install Dependencies

Follow `AGENTS.md`: check registry versions first, then install.

```bash
npm view react version
npm view react-router-dom version
npm view @tanstack/react-query version
npm view axios version
npm view zod version
npm view react-hook-form version
npm view @hookform/resolvers version
```

```bash
npm install react-router-dom @tanstack/react-query axios zod react-hook-form @hookform/resolvers
npm install -D prettier @trivago/prettier-plugin-sort-imports prettier-plugin-tailwindcss
npm install -D tailwindcss @tailwindcss/vite @types/node
```

For each library configuration, fetch current docs via Context7 (`resolve-library-id` → `query-docs`) before writing config.

Verification:

- `npm ls react-router-dom @tanstack/react-query axios zod react-hook-form` shows no errors.
- `package.json` contains all the dependencies above.

## Step 3 — Alias `@/*`

`tsconfig.app.json` or `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Note: TypeScript 7 removed `baseUrl`; use `paths` alone.

`vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
```

Note: Vite 8 warns on `__dirname`; use `import.meta.dirname`.

Verification:

- Importing `@/lib/utils` resolves at build time.

## Step 4 — Tailwind CSS v4

`src/index.css`:

```css
@import 'tailwindcss';
```

The `@tailwindcss/vite` plugin is already registered in Step 3.

Verification:

- Add a temporary Tailwind class to `App.tsx`, run `npm run dev`, confirm styling applies, then revert.

## Step 5 — shadcn/ui Init

```bash
npx shadcn@latest init
```

Answer the prompts per the stack: default style, neutral base color, CSS variables enabled.

Generated files:

- `components.json`
- `src/lib/utils.ts`
- `src/index.css` updated with design tokens
- `tsconfig.json` updated if needed

Gotcha (see `AGENTS.md`): this machine's npm enforces `allow-scripts`. If the CLI fails with `EALLOWSCRIPTS`, pre-install the packages yourself (`npm install cn sonner next-themes class-variance-authority radix-ui lucide-react tw-animate-css`), then re-run the command. If components land in a literal `@/` folder, move them into `src/`.

Verification:

- `components.json` exists and its aliases point to `@/components` and `@/lib/utils`.

## Step 6 — shadcn Components

```bash
npx shadcn@latest add button card badge input label table dialog dropdown-menu sonner skeleton select textarea alert-dialog tabs separator empty
```

Output: `src/components/ui/*.tsx`.

After adding, read the results and confirm:

- Imports follow the `@/` alias.
- No sub-components are missing.

Verification:

- `ls src/components/ui` shows all components above.

## Step 7 — Environment

`.env.example`:

```env
VITE_API_URL=http://localhost:8081
VITE_USE_MOCKS=true
```

`.env` (gitignored, created locally):

```env
VITE_API_URL=http://localhost:8081
VITE_USE_MOCKS=true
```

Make sure `.gitignore` includes `.env`.

## Step 8 — Formatter

`.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all",
  "plugins": ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
  "importOrder": [
    "^react$",
    "^react-dom",
    "^react-router",
    "^@tanstack/(.*)$",
    "<THIRD_PARTY_MODULES>",
    "^@/(api|schemas|types|constants|lib)/(.*)$",
    "^@/(hooks|auth)/(.*)$",
    "^@/(components|features)/(.*)$",
    "^[./]"
  ],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
```

`.prettierignore`:

```text
node_modules
dist
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Verification:

- `npm run format:check` passes (after running `npm run format`).

## Step 9 — Linter

Adjust the template's `eslint.config.js` or `.oxlintrc.json`:

- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unused-vars: error` with `argsIgnorePattern: '^_'`
- `react-hooks/exhaustive-deps: error`
- `no-console: warn` allowing `warn` and `error`
- Disable stylistic rules that conflict with Prettier (use `eslint-config-prettier` if needed).

Verification:

- `npm run lint` passes.

## Step 10 — Constants

Based on `../../docs/PRD.md` §3, §5, and `../../docs/api.md`.

`src/constants/roles.ts`:

```ts
export const USER_ROLE = {
  OWNER: 'OWNER',
  CASHIER: 'CASHIER',
  KITCHEN: 'KITCHEN',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]
```

`src/constants/orderStatus.ts`:

```ts
export const ORDER_STATUS = {
  MENUNGGU: 'MENUNGGU',
  DIPROSES: 'DIPROSES',
  SIAP: 'SIAP',
  DIANTAR: 'DIANTAR',
  SELESAI: 'SELESAI',
  DIBATALKAN: 'DIBATALKAN',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]
```

`src/constants/itemStatus.ts`:

```ts
export const ITEM_STATUS = {
  PENDING: 'PENDING',
  COOKING: 'COOKING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS]
```

`src/constants/paymentStatus.ts`:

```ts
export const PAYMENT_STATUS = {
  BELUM: 'BELUM',
  LUNAS: 'LUNAS',
} as const

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]
```

`src/constants/orderType.ts`:

```ts
export const ORDER_TYPE = {
  QR: 'QR',
  MANUAL: 'MANUAL',
} as const

export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE]
```

`src/constants/paymentMethod.ts`:

```ts
export const PAYMENT_METHOD = {
  CASH: 'CASH',
  NON_CASH: 'NON_CASH',
} as const

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]
```

`src/constants/routes.ts`:

```ts
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  ORDERS: '/orders',
  KITCHEN: '/kitchen',
  MENUS: '/menus',
  TABLES: '/tables',
  STOCK: '/stock',
  USERS: '/users',
  SETTINGS: '/settings',
  REPORTS: '/reports',
} as const
```

`src/constants/errors.ts` — per `../../docs/api.md`:

```ts
export const API_ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  STOCK_NOT_ENOUGH: 'STOCK_NOT_ENOUGH',
  STORE_CLOSED: 'STORE_CLOSED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE]
```

Verification:

- All string values match `api.md` and the PRD exactly (uppercase).

## Step 11 — Domain Types

`src/types/api.ts`:

```ts
import type { ApiErrorCode } from '@/constants/errors'

export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiErrorBody = {
  success: false
  error: {
    code: ApiErrorCode
    message: string
    debug?: string
  }
}

export type ApiError = {
  code: ApiErrorCode
  message: string
}
```

`src/types/order.ts`:

```ts
import type { ItemStatus, OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '@/constants'

export type OrderItem = {
  id: string
  menu_id: string
  menu_name: string
  qty: number
  unit_price: number
  note: string | null
  status: ItemStatus
}

export type Order = {
  id: string
  order_type: OrderType
  table_id: string | null
  table_number: string | null
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  subtotal_amount: number
  tax_amount: number
  tax_percent: number
  total_amount: number
  created_at: string
  items: OrderItem[]
}
```

`src/types/menu.ts`:

```ts
export type Menu = {
  id: string
  name: string
  price: number
  image_url: string | null
  is_available: boolean
}

export type Category = {
  id: string
  name: string
  menus: Menu[]
}
```

`src/types/table.ts`:

```ts
export type Table = {
  id: string
  number: string
  qr_token: string
  is_active: boolean
}
```

`src/types/user.ts`:

```ts
import type { UserRole } from '@/constants/roles'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
}
```

`src/types/stock.ts`:

```ts
export type Ingredient = {
  id: string
  name: string
  unit: string
  stock: number
}

export type RecipeItem = {
  id: string
  menu_id: string
  ingredient_id: string
  qty: number
}
```

`src/types/settings.ts`:

```ts
export type Settings = {
  cafe_name: string
  tax_percent: number
  is_open: boolean
}
```

Field names follow the backend JSON convention (`snake_case`) per `api.md`. The final field shapes are re-verified against API responses in Phase 3 and adjusted in one place: `src/types/`.

Verification:

- `npm run build` passes with no type errors.

## Step 12 — Final Verification

```bash
npm run lint
npm run format:check
npm run build
npm run dev
```

Update `AGENTS.md`:

- Remove the "Scaffold not yet created" note.
- Fill in the actual commands in the Commands section.

## Definition of Done

- [ ] `npm run dev` serves the Vite page with Tailwind styling.
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run format:check` passes.
- [ ] `components.json` and the shadcn components exist.
- [ ] The `@/` alias works at build time.
- [ ] All constants and types files exist and pass typecheck.
- [ ] The `AGENTS.md` status section is updated.

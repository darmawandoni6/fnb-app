# Dashboard Tech Stack

## Scope

`fnb-dashboard` is the internal SPA for `OWNER`, `CASHIER`, and `KITCHEN`. It talks to the Go API in `fnb-server` over HTTP JSON using the envelope in `../api-response.md`.

## Selected Stack

| Area          | Technology                                                                | Reason                                                             |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Build tool    | Vite                                                                      | Fast dev server, native ESM, SPA build                             |
| UI framework  | React                                                                     | Component model, large ecosystem                                   |
| Language      | TypeScript (strict)                                                       | Static typing across API, forms, and UI state                      |
| Routing       | React Router                                                              | SPA routing with protected routes and role guards                  |
| Server state  | TanStack Query                                                            | Polling via `refetchInterval`, caching, mutation invalidation      |
| HTTP client   | Axios                                                                     | Interceptors for bearer token, refresh, and error mapping          |
| Forms         | React Hook Form                                                           | Uncontrolled forms with minimal re-renders                         |
| Validation    | Zod + `@hookform/resolvers`                                               | Schema is the single source for validation and inferred types      |
| UI components | shadcn/ui                                                                 | Source-owned accessible components on Radix primitives             |
| Styling       | Tailwind CSS v4                                                           | Utility styling aligned with shadcn tokens                         |
| Icons         | lucide-react                                                              | Default shadcn icon library                                        |
| Testing       | Vitest + React Testing Library                                            | Unit and component tests without a browser                         |
| Linting       | ESLint + Oxlint config from Vite template                                 | Fast static checks                                                 |
| Formatting    | Prettier + `prettier-plugin-sort-imports` + `prettier-plugin-tailwindcss` | Consistent formatting, sorted imports, and sorted Tailwind classes |

## Runtime

- Local API base URL: `http://localhost:8081` via `VITE_API_URL`.
- All responses follow the `{success, data}` / `{success, error{code, message}}` envelope.
- MVP updates: polling every 5 seconds with TanStack Query; no WebSocket or SSE.
- Polling runs while the tab is active; default TanStack behavior pauses when the tab is hidden.
- Order boards fetch filtered by status (`?status=`), not all orders client-side.
- Money is integer rupiah; dashboard never computes prices, tax, or totals — server does.
- Order status is read from API aggregate; client never recalculates it.

## Package Boundaries

```text
api/ → features/* → components/ui
 └────→ schemas/ (zod)
 └────→ types/
```

- `src/api/client.ts`: single Axios instance, bearer interceptor, 401 refresh flow, envelope unwrapping.
- `src/api/*.ts`: one module per resource (`auth`, `orders`, `menus`, `payments`); no direct `fetch` in components.
- `src/schemas/`: Zod schemas used by React Hook Form and type inference.
- `src/features/*`: domain folders owning pages, components, and hooks.
- `src/components/ui/`: shadcn source-owned components.
- `src/auth/`: `AuthContext`, `ProtectedRoute`, and `RoleGuard`.
- `src/constants/`: status maps, roles, and polling intervals.

## Authentication

- Access token lives in memory only and attaches via Axios request interceptor.
- Refresh token uses the httpOnly cookie set by the server.
- App load calls `POST /auth/refresh` before rendering protected routes.
- A `401 UNAUTHORIZED` triggers silent refresh and one request retry.
- Role comes from access token claims; server remains authorization authority.
- Logout calls `POST /auth/logout` and clears in-memory state.

## Polling Rules

- Order boards use TanStack Query with `refetchInterval: 5_000`.
- Kitchen board queries filtered order statuses such as `?status=DIPROSES`.
- Cashier board queries its required active order statuses.
- Mutations invalidate affected order queries so updates appear immediately.
- No background polling outside authenticated routes.

## Error Handling

- Map envelope error codes to UI behavior; never match message text:
  - `PAYMENT_REQUIRED`, `INVALID_TRANSITION`, `STOCK_NOT_ENOUGH`, `STORE_CLOSED`: toast notification.
  - `UNAUTHORIZED`: silent refresh, then retry once.
  - `FORBIDDEN`: hide or disable action for that role.
- Display server `message`; use `code` for logic branches.
- Never log tokens, passwords, credentials, or sensitive API responses.

## Planned Source Structure

```text
fnb-dashboard/
├── docs/
│   └── tech-stack.md
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── menus.ts
│   │   └── payments.ts
│   ├── auth/
│   │   ├── AuthContext.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── RoleGuard.tsx
│   ├── components/
│   │   └── ui/
│   ├── constants/
│   ├── features/
│   │   ├── auth/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── menus/
│   │   ├── tables/
│   │   ├── stock/
│   │   ├── reports/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   ├── schemas/
│   ├── types/
│   └── styles/
├── .env.example
├── components.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Code Style

### ESLint

Use ESLint for code-quality rules and keep formatting concerns in Prettier.

Recommended rules:

- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unused-vars: error`
- `react-hooks/exhaustive-deps: error`
- `react-refresh/only-export-components: warn`
- `no-console: warn`, allowing `console.warn` and `console.error`

### Prettier

Use Prettier as the single formatting tool. Use `@trivago/prettier-plugin-sort-imports` for import ordering and `prettier-plugin-tailwindcss` for Tailwind class ordering.

Install:

```bash
npm install -D prettier @trivago/prettier-plugin-sort-imports prettier-plugin-tailwindcss
```

Configuration in `.prettierrc`:

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

Keep `prettier-plugin-tailwindcss` last in `plugins` so it can run after other Prettier transformations.

Recommended scripts:

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Rules:

- ESLint checks code quality; Prettier owns formatting.
- Do not use another import-sort ESLint plugin together with `@trivago/prettier-plugin-sort-imports`.
- Run `npm run format:check` in CI.
- Run `npm run lint` before commit.

## Form Validation

- Forms use React Hook Form.
- Zod schemas are passed through `zodResolver`.
- Form types use `z.infer<typeof schema>`.
- API validation errors remain separate from client-side form errors.
- Server remains the source of truth for business rules.

Example:

```ts
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginFormValues = z.infer<typeof loginSchema>

const form = useForm<LoginFormValues>({
  resolver: zodResolver(loginSchema),
})
```

## Implementation Order

1. Scaffold Vite React TypeScript.
2. Setup Tailwind and shadcn/ui.
3. Setup alias `@/*`.
4. Install runtime dependencies.
5. Setup Axios client.
6. Setup TanStack Query provider.
7. Setup React Router.
8. Setup auth context and role guards.
9. Setup constants, types, and schemas.
10. Build dashboard layout.
11. Build cashier and kitchen order boards.
12. Add polling and mutations.
13. Add manual order form with Zod and React Hook Form.
14. Add tests for validation and status transitions.

## Deliberately Excluded

Do not add these for MVP:

- Redux or Zustand: TanStack Query plus AuthContext cover state needs.
- WebSocket or SSE: PRD specifies polling for MVP.
- Chart library: add when reports are implemented.
- Date library: use `Intl.DateTimeFormat` first.
- Storybook.
- Playwright E2E: add after MVP flow is stable.

Add them only when a measured requirement or product decision requires them.

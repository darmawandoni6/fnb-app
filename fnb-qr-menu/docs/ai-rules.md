# AI Coding Rules — FNB QR Menu

## Scope

These rules apply when AI creates or changes code in `fnb-qr-menu`. Sources of truth are `../docs/PRD.md` and `../docs/flow.md`; the stack is defined in `docs/tech-stack.md`, screens in `docs/qr-menu-structure.md`, and naming in `docs/conventions.md`.

## General Rules

- Read existing code before making changes.
- Choose the smallest change that solves the requirement.
- Do not add abstractions, dependencies, or files without a clear need.
- Preserve the existing naming patterns and folder structure.
- Do not change an API contract without updating the related documentation and types.
- Do not remove user changes without confirmation.
- Comments explain a non-obvious "why" only. Do not narrate what the code already says or restate PRD/spec text in code; that belongs in `docs/`.

## TypeScript Rules

- Use strict TypeScript.
- Do not use `any`. Use domain types, `unknown`, type guards, or generics.
- Use `as const` for fixed string value collections.
- Avoid TypeScript `enum` unless there is a clear compatibility reason.
- API types must reflect backend responses.
- Do not hide errors with non-null assertions (`!`) without validation.

## API Rules

- Route all requests through `src/api/`.
- Components and hooks import only from `@/api`, never from a specific implementation module or `@/mocks`.
- Use one HTTP client for the base URL, response parsing, and errors.
- Do not place backend business rules in components.
- Safely display error messages from backend responses.
- Branch on the error `code`, not by matching the `message` text.
- Never send prices, service, tax, totals, or stock from the client; send `order_type`, `customer_name`, `customer_phone`, `payment_method`, and `items: [{ menu_id, qty, note }]`.
- Do not log the session token or full API responses.
- `VITE_API_URL` is the source for the API base URL.
- The list of public endpoints is fixed by `docs/tech-stack.md`; do not invent endpoints that `fnb-server` does not expose.
- `src/api/index.ts` is the only place that chooses between mock and HTTP. Never branch on `VITE_USE_MOCKS` elsewhere.

## Phase Rules

- Phase 2 steps are `[MOCK]`; they must work against `src/mocks/` without a backend.
- `[TODO-API]` work belongs to Phase 3 and must not leak into Phase 2.
- The mock and HTTP implementations must share signatures, so swapping them never touches a component.

## Testing Rules

- Unit tests are Vitest only: `cart.test.ts`, `session.test.ts`, `status.test.ts`.
- Do not add React Testing Library or Playwright.

## Routing Rules

- Routes are `/`, `/menu/:menuId`, `/keranjang`, `/status`, `/tidak-valid`, `/tutup`.
- `?meja` carries the table `qr_token`; apply it to the session, then remove it from the URL.
- `?edit` carries the cart line key on `/menu/:menuId`.
- A missing or invalid table goes to `/tidak-valid`; a closed store goes to `/tutup` unless the customer chose browse-only.
- Do not add route-level data loading abstractions; the SPA renders routes from `react-router-dom` and reads TanStack Query.

## Customer Session Rules

- Customer state lives in one versioned `localStorage` record read through `useSyncExternalStore`.
- Store only `qr`, `sessionToken`, `cart`, `orders`, `browseOnly`, `invalidTable`, `updatedAt`, and `v`.
- Never store credentials or refresh tokens; `qr` and `sessionToken` are table-scoped capability tokens.
- A different `qr` resets the cart, orders, and `sessionToken`.
- Corrupt or unknown versions start from an empty session instead of throwing.
- Storage failures fall back to memory; the app must keep working in private mode.
- `orders` has no size cap and no clear action; do not add pruning or a reset button unless requested.

## Cart Rules

- Merge lines by `menuId|note.trim().toLowerCase()`.
- Keep `MAX_QTY` 50 and `NOTE_MAX` 120 in `src/constants/cart.ts`; do not inline the numbers.
- Never compute subtotal, service, tax, or total. `api.md` forbids the client from determining prices, tax, and totals; the cart shows unit prices only.
- Lines whose menu is missing from the menu response are hidden and dropped from the submit payload.
- Do not enable submission while the cart is empty, fully hidden, or `is_open` is `false`.

## Order and Status Rules

- Order status is the backend aggregate; do not calculate a different status in the UI.
- The status stepper is derived from item statuses (the aggregate has no `SIAP` / `DIANTAR`); there is no timeline in the API.
- `/status` lists one card per order, newest first, with exactly one card open.
- One `GET /public/orders` poll every 5 seconds refreshes every stored card; collapsed cards render their snapshot between polls.
- The client may cancel a whole order only while it is `MENUNGGU` with `payment_status` `BELUM`, through `POST /public/orders/:id/cancel` with `{ reason }`.
- A `LUNAS` or `DIPROSES` order shows no cancel action; there is no refund warning in v1.
- `CANCELLED` items stay visible, crossed out.
- Stop polling when every stored order is `SELESAI`, `DIBATALKAN`, or the screen unmounts.
- An entry missing from the list response keeps its snapshot instead of disappearing.
- `unbounded` order history is a deliberate choice; do not add limits without confirmation.

## Money and Data Rules

- Monetary values are integer rupiah.
- Do not use floating point for money calculations.
- Format rupiah only in the presentation layer.
- Do not recalculate order totals as the source of truth; totals come from the backend.
- Separate API DTOs, UI state, and domain types when their shapes differ.

## React Rules

- Components focus on rendering and user interaction.
- Request and polling logic belongs in hooks or the API layer.
- Do not create global state for local state.
- Do not add `useEffect` when a derived value or event handler is sufficient.
- Use stable backend IDs as keys, not array indexes.
- Every screen must handle loading, empty, error, and success states.
- Interactive elements must support keyboard use and have clear labels.
- Keep touch targets at least 44×44 CSS pixels; the app is used on phones.

## Styling Rules

- Styling is Tailwind CSS v4 with the iul tokens defined in `src/index.css` `@theme`.
- Do not copy iul `pl-*` / `pc-*` classes; rebuild the layout with utilities and shadcn components.
- Use `Intl.NumberFormat('id-ID')` for rupiah and `Intl.DateTimeFormat` for times.

## Dependency Rules

- Prefer native platform features or existing dependencies before adding a package.
- A new dependency must solve a real need and be documented in the change.
- Do not add a library for a one- or two-line helper.
- Do not add SSR, `@tanstack/react-router`, `@tanstack/react-start`, or nitro.

## Documentation Lookup

- Before running `npm install <package>`, check the latest version with `npm view <package> version`.
- Before writing configuration or code that uses an external library, use Context7 MCP: `resolve-library-id`, then `query-docs`.
- This applies to React, Vite, React Router, TanStack Query, Axios, Zod, React Hook Form, shadcn/ui, Tailwind, and every other external package.
- Do not rely on training knowledge for library APIs or version-specific configuration.
- If a new major version is detected, read its migration guide through Context7 before upgrading.

## Testing and Validation

- Non-trivial logic must have at least one runnable check or small test.
- Unit tests: cart merge helpers, session store behaviour, polling predicate.
- Before completion, run typecheck, lint, and available tests.
- Do not claim completion when validation commands fail without explaining why.
- At minimum, manually verify the six screens on a 375px-wide viewport.

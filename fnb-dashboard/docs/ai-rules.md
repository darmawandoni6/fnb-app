# AI Coding Rules — FNB Dashboard

## Scope

These rules apply when AI creates or changes code in `fnb-dashboard`.

## General Rules

- Follow `PRD.md` and `flow.md` as the sources of truth.
- Read existing code before making changes.
- Choose the smallest change that solves the requirement.
- Do not add abstractions, dependencies, or files without a clear need.
- Preserve the existing naming patterns and folder structure.
- Do not change an API contract without updating the related documentation and types.
- Do not remove user changes without confirmation.

## TypeScript Rules

- Use strict TypeScript.
- Do not use `any`. Use domain types, `unknown`, type guards, or generics.
- Use `as const` for fixed string value collections.
- Avoid TypeScript `enum` unless there is a clear compatibility reason.
- API types must reflect backend responses.
- Do not hide errors with non-null assertions (`!`) without validation.

## API Rules

- Route all requests through `src/api/`.
- Components and hooks must not call `fetch` directly.
- Use one HTTP client for the base URL, bearer token, response parsing, and errors.
- Do not place backend business rules in components.
- Safely display error messages from backend responses.
- Branch on the error `code`, not by matching the `message` text.
- Do not log tokens, passwords, credentials, or sensitive data.
- `VITE_API_URL` is the source for the API base URL.

## Authentication and Authorization

- Protect internal routes with an authentication guard.
- Menus and routes must follow the `OWNER`, `CASHIER`, and `KITCHEN` roles.
- A UI role guard does not replace backend authorization.
- Never store passwords.
- Do not store refresh tokens in JavaScript storage when the backend provides an httpOnly cookie.
- Logout must clear access-token state and the user-data cache.

## Order and Status Rules

- Order status is the backend aggregate; do not calculate a different status in the UI.
- The UI only displays status and sends allowed transitions.
- Item transitions follow the PRD:
  - `PENDING` → `COOKING`
  - `COOKING` → `READY`
  - `READY` → `DELIVERED`
  - `PENDING` → `CANCELLED`
- Do not enable transition buttons based on role alone; also check item status.
- Payment must be `LUNAS` before the kitchen starts `COOKING`.
- Completed items cannot be cancelled from the UI.
- Stop polling when a component unmounts or a query is no longer active.

## Money and Data Rules

- Store and send monetary values as integer rupiah.
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
- Data pages must handle loading, empty, error, and success states.
- Interactive elements must support keyboard use and have clear labels.

## Dependency Rules

- Prefer native platform features or existing dependencies before adding a package.
- A new dependency must solve a real need and be documented in the change.
- Do not add a library for a one- or two-line helper.
- Do not create a new wrapper when an existing function is sufficient.

## Documentation Lookup

- Before running `npm install <package>`, check the latest version with `npm view <package> version`.
- Before writing configuration or code that uses an external library, use Context7 MCP: `resolve-library-id`, then `query-docs`.
- This applies to React, Vite, shadcn/ui, Tailwind, React Router, TanStack Query, Axios, Zod, React Hook Form, and every other external package.
- Do not rely on training knowledge for library APIs or version-specific configuration.
- If a new major version is detected, read its migration guide through Context7 before upgrading.
- Context7 provides documentation; the npm registry provides package versions.

## Testing and Validation

- Non-trivial logic must have at least one runnable check or small test.
- Before completion, run typecheck, lint, and available tests.
- Do not claim completion when validation commands fail without explaining why.
- At minimum, manually verify UI changes for every affected role.

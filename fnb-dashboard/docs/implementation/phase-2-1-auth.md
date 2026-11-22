# Phase 2.1 — Auth

Granular plan for executing section 2.1 from `../implementation-plan.md`.

## Scope

Login page, role guards, and the in-memory access token. Mock login accepts any seeded user with password `demo` and lets the operator switch role without a real backend. The real refresh-cookie flow belongs to `phase-3-api.md`.

## Status

DONE — all tasks complete. Verified against the code: `AuthContext` keeps the token in a module variable, `ProtectedRoute` and `RoleGuard` live in `src/auth/guards.tsx`, login and logout are wired through `NavUser`, and the `logout` cache-clear gap is tracked in `phase-3-api.md`.

## Files

- `src/pages/LoginPage.tsx`
- `src/features/auth/loginSchema.ts`
- `src/auth/context.tsx`
- `src/auth/guards.tsx`

## Tasks

- [x] `LoginPage` with React Hook Form and `zodResolver`.
- [x] `loginSchema`: `email` is a valid email, `password` is non-empty.
- [x] Loading and error states; failure surfaces the mock `UNAUTHORIZED` message as a toast.
- [x] Demo role buttons (owner, cashier, kitchen) filling the form and submitting with password `demo`.
- [x] `AuthContext` keeps the access token in a module variable, never in `localStorage`.
- [x] `AuthContext` exposes `user`, `isLoading`, `login`, `logout`.
- [x] `ProtectedRoute` redirects to `/login` when there is no user and renders nothing while loading.
- [x] `RoleGuard` renders a no-access `Empty` state for roles outside its list.
- [x] `dashboardNavGroups(role)` returns the sidebar groups per role.
- [x] Logout clears the access token, the user, and navigates to `/login` (`NavUser`). The React Query cache is **not** cleared yet; that lands with the real 401/logout flow in `phase-3-api.md`.

## Verification

- Wrong password returns `UNAUTHORIZED`.
- Each demo button lands on the correct home route for its role.
- Deep-linking to a guarded route without a session redirects to `/login`.

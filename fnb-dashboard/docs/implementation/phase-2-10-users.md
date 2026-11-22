# Phase 2.10 — Users

Granular plan for executing section 2.10 from `../implementation-plan.md`.

## Scope

`/users` for `OWNER`: staff accounts and role assignment. PRD §7.4, §10.2.

## Status

DONE — all tasks complete.

## Files

- `src/pages/UsersPage.tsx`
- `src/features/users/UserFormDialog.tsx`
- `src/features/users/userSchemas.ts`

## Tasks

- [x] Table of `name`, `email`, `role`, and active state; `OWNER` only.
- [x] Create user with role `CASHIER` or `KITCHEN` only; creating an `OWNER` returns `VALIDATION_ERROR`.
- [x] Edit name, email, and role with the same role restriction.
- [x] Activate and deactivate; a deactivated user cannot log in (`login` filters on `is_active`).
- [x] `email` uniqueness enforced by the mock; no `username` field (PRD §18 point 20).
- [x] No password field in the list; the mock accepts `demo` for every seeded account.

## Verification

- Creating an `OWNER` account is rejected.
- Deactivating a cashier blocks the next login and leaves existing orders untouched.
- Duplicate email is rejected on create and on edit.

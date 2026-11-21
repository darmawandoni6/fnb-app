# Plan 02 — Auth and RBAC

> **Status:** DONE (Completed on 2026-11-21)
> - Verified `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` contracts and cookie security (`Path: "/auth"`).
> - Added `UserRepository.Count` and `SeedUsecase` with idempotent owner seeding on startup.
> - Handled session revocation on user deactivation in `UserAdminUsecase`.
> - Enforced production validation on `JWT_SECRET` and `SEED_OWNER_*`.
> - Updated Bruno API collection in `api-collection/auth/`.
> - Unit tests passing: `seed_usecase_test.go`, `auth_usecase_test.go`, `auth_handler_test.go`.

Verifies and tightens the existing auth slice against PRD §3 and §9. Mostly hardening, no redesign.

Depends on: 01.
Blocks: 04 (needs `created_by`, `updated_by`, `audit_log.actor_id`).

## 1. Scope

In:

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` contract check against `../../../docs/api.md`.
- `JWTMiddleware`, `RequireRoles`, context helpers.
- Owner seed from `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` when `users` is empty.
- User deactivation revokes sessions.

Out:

- Public `X-Session-Token` middleware (plan 03).
- User CRUD (plan 08).

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Keep JWT access token + refresh token in httpOnly cookie, hash in `sessions`. | Already implemented; PRD §2.1 and `api.md` Auth. |
| 2 | Login identity is `email`; no `username`. | PRD §10.2. |
| 3 | Deactivated user cannot log in (`CodeUserInactive`, `403`) and every session is revoked on deactivation. | PRD §11.6 error table; `auth_usecase` already returns inactive; add revoke in the user usecase. |
| 4 | `POST /auth/logout` revokes the current session and clears the cookie. | `api.md` Auth table. |
| 5 | Refresh rotation: a refresh issues a new refresh token and revokes the presented one. | Limits replay after theft; the table is already there. |
| 6 | Owner seed runs in `cmd/api/main.go` before the router starts, not in a migration. | PRD §3 "first owner is created through an environment seed"; migrations must not read env secrets. |
| 7 | Seed is idempotent: returns early when `users` has any row. | Same. |
| 8 | Missing `SEED_OWNER_*` in production is a startup error; in development it logs a warning and skips. | Avoid running prod with no owner and no obvious cause. |
| 9 | `JWT_SECRET` empty means startup failure in production and a development default with a warning. | Security; currently `getEnv("JWT_SECRET", "")` silently signs with an empty key. |
| 10 | Role constants stay `OWNER`, `CASHIER`, `KITCHEN`. | PRD §9 matrix columns. |
| 11 | Access token claims carry `user_id` and `role`; no email, no name. | Smallest surface; role changes invalidate on next login, documented in §6. |

## 3. Schema

None new. Uses `users` and `sessions` from `000001`.

Add a repository method `UserRepository.Count(ctx)` (or `IsEmpty`) for the seed.

## 4. Domain

`internal/domain/user.go`: confirm `Name`, `Email`, `PasswordHash`, `Role`, `IsActive`. Add `ValidatePassword(password string) error` in the usecase layer, not domain.

`internal/config/config.go`:

```go
SeedOwnerEmail    string
SeedOwnerPassword string
```

## 5. Repository

- `internal/repository/user_repository.go`: add `Count(ctx) (int64, error)`.
- `internal/repository/session_repository.go`: already has `Revoke` and `RevokeByUserID`; confirm both are used.

## 6. Usecase

### 6.1 `AuthUsecase` (existing)

- `Login` — unchanged contract; confirm `expires_at` is set from `RefreshTTL`.
- `Refresh` — add rotation: revoke the presented session before issuing a new one.
- `Logout` — revoke by token hash; idempotent (unknown token returns `200`).

### 6.2 `SeedOwner(ctx)` — new, `internal/usecase/seed_usecase.go`

```go
func (u *SeedUsecase) SeedOwner(ctx context.Context) error
```

Steps: `users.Count() > 0` → return nil. Validate email and password non-empty; hash with bcrypt cost 12; insert `OWNER`. Log an info line with the email but never the password.

### 6.3 Role change and deactivation

`UpdateUser` in `users_settings_usecase.go`: when `is_active` flips to `false`, call `sessionRepo.RevokeByUserID`. Role change takes effect on the next access token; document it in `docs/rules.md` checklist? No — it stays in this plan.

## 7. Delivery

No route changes. `router.go` auth group untouched.

Handler behavior to confirm:

- `Login` sets the refresh cookie with `HttpOnly`, `SameSite=Lax`, `Secure` when not development, path `/auth`.
- `Logout` returns the success envelope and clears the cookie.

## 8. Tests

- `auth_usecase_test.go`: login success, wrong password, inactive user, refresh rotation (old token rejected), logout idempotency, expired access token rejected by `ValidateAccessToken`.
- `seed_usecase_test.go`: empty table creates one owner; non-empty table creates nothing; missing config returns an error in production mode.
- `auth_handler_test.go`: cookie flags, `401` body shape via `api-response.md`.

## 9. Verification

```bash
go test ./internal/usecase/... ./internal/delivery/http/...
```

Manual:

- Fresh DB, `SEED_OWNER_EMAIL`/`PASSWORD` set → `make run`, login returns an access token.
- Restart → still one owner row.
- Deactivate the owner in SQL → login returns `403 USER_INACTIVE`.

## 10. Docs to update

- `docs/rules.md` — add the seed env vars to the environment gotchas if missing.
- `AGENTS.md` — add `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` under environment gotchas.
- `../../../docs/api.md` — only if the refresh rotation changes the documented behavior. It does not; no change.

# Plan: Internal — Users and Settings

Source: `docs/api.md` (Internal — users and settings), `docs/PRD.md` §3/§8/§9, `docs/flow.md`.

## Scope

Implement 5 OWNER-only endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | List users |
| `POST` | `/users` | Create `CASHIER` or `KITCHEN` user |
| `PATCH` | `/users/:id` | Update user or active state |
| `GET` | `/settings` | Get cafe settings |
| `PATCH` | `/settings` | Update cafe settings |

Existing domain types: `User`, `Setting`. Existing repositories: `UserRepository`, `SettingRepository`. Existing migrations support required tables.

## Decisions

- API cannot create `OWNER`; owner comes from environment seed.
- User create requires non-empty name, valid unique email, password length at least 8, and role `CASHIER` or `KITCHEN`.
- Duplicate email returns `409 VALIDATION_ERROR`.
- User update changes `name`, optional `role`, optional password, and optional `is_active`.
- Email is immutable in this pass.
- Password hash never appears in API responses.
- Deactivating a user does not revoke existing sessions in this pass; sessions expire naturally.
- Settings has one row. Missing settings return defaults: empty cafe name, tax `0`, `is_open = true`.
- Settings update creates the row when missing.
- `tax_percent` must be between `0` and `100`.
- `is_open` controls `STORE_CLOSED` behavior in existing order creation flows.
- No explicit concurrency: all operations are single-record CRUD. Keep sequential.

## Domain

Extend `internal/domain/user.go` repository interface:

```go
type UserRepository interface {
    GetByID(ctx context.Context, id uuid.UUID) (*User, error)
    GetByEmail(ctx context.Context, email string) (*User, error)
    List(ctx context.Context) ([]User, error)
    Create(ctx context.Context, user *User) error
    Update(ctx context.Context, user *User) error
}
```

Extend the existing settings repository interface:

```go
type SettingRepository interface {
    GetFirst(ctx context.Context) (*Setting, error)
    Update(ctx context.Context, setting *Setting) error
}
```

Keep dependency direction:

```text
delivery → usecase → repository → domain
```

## Repository

Update `internal/repository/user_repository.go`:

- Add `List`, ordered by name.
- Add `Update` using `Save`.
- Keep password fields hidden by domain JSON tags.

Update `internal/repository/setting_repository.go`:

- Add `Update` using `Save` for the single settings row.

## Usecases

Add `internal/usecase/users_settings_usecase.go`.

### User admin usecase

- List all users.
- Create user:
  - validate name, email, password, and role;
  - accept only `CASHIER` and `KITCHEN`;
  - hash password with bcrypt;
  - map duplicate email to `409 VALIDATION_ERROR`.
- Update user:
  - return `NOT_FOUND` when missing;
  - validate optional role and password;
  - re-hash password when supplied;
  - persist `name`, role, password hash, and active state;
  - reject `OWNER` role.

### Settings usecase

- Get settings.
- Return defaults when no row exists:
  - `cafe_name = ""`
  - `tax_percent = 0`
  - `is_open = true`
- Update settings:
  - validate cafe name when supplied;
  - validate tax range `0..100`;
  - preserve omitted fields;
  - create row when missing;
  - update existing row otherwise.

## Delivery

Add:

- `internal/delivery/http/dto/users_settings.go`
- `internal/delivery/http/users_settings_handler.go`

DTOs:

```go
type CreateUserRequest struct {
    Name     string `json:"name" validate:"required"`
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
    Role     string `json:"role" validate:"required,oneof=CASHIER KITCHEN"`
}

type UpdateUserRequest struct {
    Name     *string `json:"name" validate:"omitempty,min=1"`
    Role     *string `json:"role" validate:"omitempty,oneof=CASHIER KITCHEN"`
    Password *string `json:"password" validate:"omitempty,min=8"`
    IsActive *bool   `json:"is_active"`
}

type UpdateSettingsRequest struct {
    CafeName   *string  `json:"cafe_name" validate:"omitempty,min=1"`
    TaxPercent *float64 `json:"tax_percent" validate:"omitempty,gte=0,lte=100"`
    IsOpen     *bool    `json:"is_open"`
}
```

Handlers must:

- parse UUID path parameters;
- bind with the standard binder;
- call usecases;
- use `httpDelivery.Success` for responses;
- never expose password hashes.

Register in OWNER-only JWT group:

```text
GET    /users
POST   /users
PATCH  /users/:id
GET    /settings
PATCH  /settings
```

## Wiring

Update `cmd/api/wiring.go`:

- construct user repository and settings repository;
- construct user/settings usecases;
- add users/settings handler to HTTP handlers;
- register handler routes.

Reuse bcrypt configuration and patterns from existing auth usecase.

## Bruno collection

Add `api-collection/users/`:

```text
01-list-users.bru
02-create-user.bru
03-update-user.bru
04-get-settings.bru
05-update-settings.bru
folder.bru
```

Add `userId` to `api-collection/environments/local.bru`.

## Tests

Add focused usecase tests:

- Empty name rejected.
- Invalid email rejected at delivery boundary.
- Short password rejected.
- `OWNER` role rejected.
- Duplicate email returns `VALIDATION_ERROR` with HTTP 409.
- Password is hashed and never stored as plaintext.
- Missing user returns `NOT_FOUND`.
- User update rejects `OWNER` role.
- User update re-hashes password.
- User deactivation persists `is_active = false`.
- Invalid tax percentage rejected.
- Settings update creates missing settings row.
- Settings get returns defaults when no row exists.

## Verification

```bash
go test ./...
go build ./...
```

## Error behavior

- Invalid input: `400 VALIDATION_ERROR`.
- Duplicate email: `409 VALIDATION_ERROR`.
- Missing user: `404 NOT_FOUND`.
- Non-OWNER JWT: `403 FORBIDDEN`.
- Unexpected failures: `500 INTERNAL_ERROR`.

## Open questions

- Self-deactivation: plan allows it; add protection if product requires it.
- Session revocation after deactivation remains out of scope.
- Email update remains out of scope.

## Sequence

1. Extend domain interfaces.
2. Implement repositories.
3. Implement usecases and tests.
4. Add DTOs and handlers.
5. Wire OWNER-only routes.
6. Add Bruno requests.
7. Run tests and build.

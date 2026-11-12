# Plan: Internal — Menus and Tables

Source: `../../docs/api.md`, `../../docs/PRD.md`, `../../docs/flow.md`

## Scope

Implement 12 OWNER-only endpoints:

### Menu categories

- `GET /menu-categories`
- `POST /menu-categories`
- `PATCH /menu-categories/:id`
- `DELETE /menu-categories/:id`

### Menus

- `GET /menus`
- `POST /menus`
- `PATCH /menus/:id`
- `DELETE /menus/:id`

### Tables

- `GET /tables`
- `POST /tables`
- `PATCH /tables/:id`
- `DELETE /tables/:id`

Reuse existing domain structs: `Menu`, `MenuCategory`, and `Table`.

## Decisions

- Delete operations soft-deactivate records:
  - Menus: `is_available = false`
  - Tables: `is_active = false`
- Hard delete only when a record has no references and the endpoint implementation needs it.
- Category deletion returns `409` when menus still reference the category.
- `qr_token` is supplied by the client in the create-table request. Unique index handles collisions.
- Menu photos use multipart upload and local disk storage.
- Upload directory comes from `cfg.UploadDir`, default `./uploads`.
- Static files are served through `/static`.
- Menu `image_url` stores a relative URL such as `/static/uploads/<uuid>.<ext>`.
- Menu validation:
  - non-empty name
  - existing category
  - `price > 0`
- Menu changes are not gated by `settings.is_open`; PRD gates recipe changes, not menu changes.
- Duplicate `table_number` or `qr_token` returns `409 VALIDATION_ERROR` with a clear message.
- Tests focus on usecase logic. No DB integration harness exists currently.

## 1. Domain

Extend repository interfaces:

### Menu repository

- `List(ctx)`
- `GetByID(ctx, id)`
- `Create(ctx, menu)`
- `Update(ctx, menu)`
- `Delete(ctx, id)`
- `CountByCategory(ctx, categoryID)`

### Table repository

- `List(ctx)`
- `GetByID(ctx, id)`
- `Create(ctx, table)`
- `Update(ctx, table)`
- `Delete(ctx, id)`

### Menu category repository

Create a new interface with:

- `List(ctx)`
- `GetByID(ctx, id)`
- `Create(ctx, category)`
- `Update(ctx, category)`
- `Delete(ctx, id)`
- `CountMenus(ctx, categoryID)`

Keep dependency direction:

```text
delivery → usecase → repository → domain
```

## 2. Repository

Implement CRUD using GORM:

- Extend `internal/repository/menu_repository.go`
- Extend `internal/repository/table_repository.go`
- Add `internal/repository/menu_category_repository.go`

Behavior:

- List active records by default unless endpoint needs an explicit inactive view.
- `DELETE /menus/:id` updates `is_available = false`.
- `DELETE /tables/:id` updates `is_active = false`.
- Category delete checks menu references before deleting.
- Translate missing records to `NOT_FOUND` in usecase.
- Translate unique constraint conflicts to `409 VALIDATION_ERROR`.

## 3. Usecases

Add admin usecases:

- `MenuCategoryUsecase`
- `MenuUsecase`
- `TableUsecase`

### Category usecase

- List categories.
- Validate non-empty category name.
- Create category.
- Update category.
- Before delete, count menus using category.
- Return `409` when referenced by one or more menus.

### Menu usecase

- List menus.
- Validate non-empty name.
- Validate `price > 0` integer rupiah.
- Verify `category_id` exists.
- Create menu.
- Update menu.
- Soft-deactivate menu.
- Preserve order price snapshots; menu edits must not modify existing order items.

### Table usecase

- List tables.
- Validate non-empty `table_number`.
- Validate non-empty client-provided `qr_token`.
- Create table.
- Update table.
- Soft-deactivate table.
- Return `409 VALIDATION_ERROR` for duplicate `table_number` or `qr_token`.

## 4. Photo upload

Implement local multipart handling for menu create/update:

- Accept JPEG, PNG, and WebP.
- Enforce a maximum size around 5 MB.
- Generate filename with UUID; never trust client filename.
- Write to `cfg.UploadDir`.
- Store relative URL in `image_url`.
- Keep upload and menu persistence failure-safe: remove newly written file when DB write fails.
- Do not log credentials, tokens, or uploaded file contents.

Add:

- `UPLOAD_DIR` configuration value.
- Default `./uploads`.
- Static serving through `e.Static("/static", cfg.UploadDir)`.
- Gitignore rule for local uploads.

## 5. Delivery

Add OWNER-only route group using existing JWT middleware and `RequireRoles`:

```text
GET    /menu-categories
POST   /menu-categories
PATCH  /menu-categories/:id
DELETE /menu-categories/:id

GET    /menus
POST   /menus
PATCH  /menus/:id
DELETE /menus/:id

GET    /tables
POST   /tables
PATCH  /tables/:id
DELETE /tables/:id
```

Handlers must:

- Parse and validate UUID path parameters.
- Use the standard binder and validation tags.
- Bind JSON for category/table requests.
- Bind multipart form data for menu photo upload.
- Call usecases; keep business rules out of handlers.
- Return responses through `httpDelivery.Success`.
- Return errors using existing domain error codes and standard error envelope.

## 6. DTOs

Add request/response DTOs under `internal/delivery/http/dto`.

Expected fields:

### Category

```json
{
  "name": "Coffee",
  "sort_order": 1
}
```

### Menu JSON fields

```json
{
  "category_id": "uuid",
  "name": "Latte",
  "price": 25000,
  "image_url": null,
  "is_available": true
}
```

Multipart requests use form fields for menu values and an optional photo file.

### Table

```json
{
  "table_number": "T01",
  "qr_token": "public-token"
}
```

## 7. Tests

Usecase unit tests:

- Category create/update validation.
- Category delete rejected when menus reference it.
- Menu create rejected for missing category.
- Menu create/update rejected for empty name.
- Menu create/update rejected for `price <= 0`.
- Menu delete sets `is_available = false`.
- Table create/update validation.
- Duplicate table number returns `VALIDATION_ERROR`.
- Duplicate QR token returns `VALIDATION_ERROR`.
- Table delete sets `is_active = false`.
- Missing records return `NOT_FOUND`.

Photo tests, if upload logic is isolated:

- Reject unsupported content type.
- Reject oversized file.
- Generate safe UUID filename.
- Remove file when persistence fails.

## 8. Sequence

1. Add `UploadDir` config and upload ignore rule.
2. Extend domain repository interfaces.
3. Implement category, menu, and table repositories.
4. Implement usecases and unit tests.
5. Add DTOs and handlers.
6. Register OWNER-only routes.
7. Add multipart upload and static serving.
8. Run verification:

```bash
go test ./...
go build ./...
```

## 9. Error behavior

- Invalid input: `400 VALIDATION_ERROR`
- Missing record: `404 NOT_FOUND`
- Non-OWNER JWT: `403 FORBIDDEN`
- Duplicate table number or QR token: `409 VALIDATION_ERROR`
- Category with menus cannot be deleted: `409 INVALID_TRANSITION`
- Unexpected failures: `500 INTERNAL_ERROR`

All responses use the envelope documented in `../../docs/api-response.md`.

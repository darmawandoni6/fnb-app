# Constants Standard

Constants prevent typos in values shared across packages and keep application behavior consistent.

## Rules

1. Use constants for environment names, error codes, HTTP-independent domain codes, event names, and other stable protocol values.
2. Put constants in the package that owns their meaning.
3. Keep configuration constants in `internal/config`.
4. Keep domain error codes in `internal/domain`.
5. Use exported names when another package needs the value.
6. Use unexported names for package-local defaults and implementation details.
7. Do not compare application state against repeated string literals.
8. Do not create constants for one-use values with no shared meaning.
9. Constants must not contain secrets or mutable runtime configuration.
10. Rename or remove constants when their documented behavior changes.

## Current Constants

### `internal/config`

- `EnvDevelopment` — enables development error details.
- `EnvProduction` — safe default environment.
- `defaultDSN` — local PostgreSQL fallback DSN.
- `defaultPort` — local API port fallback.

### `internal/domain`

- `CodeInternalError` — stable code for unexpected failures.

## Usage

```go
if cfg.IsDevelopment() {
    // development-only behavior
}
```

```go
const CodeUserNotFound = "USER_NOT_FOUND"

return domain.NewError(
    CodeUserNotFound,
    "user not found",
    http.StatusNotFound,
    err,
)
```

If a new error code is used by more than one package, add it to `internal/domain/error_codes.go` and document it in `../../docs/api-response.md`.

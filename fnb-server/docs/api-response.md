# API Response Standard

All REST endpoints use one JSON envelope.

## Success

```json
{
  "success": true,
  "data": {
    "id": "user-1"
  }
}
```

Use the real HTTP success status (`200`, `201`, `204`). For JSON responses, use `httpDelivery.Success`.

## Health Endpoint

`GET /health` returns service status using the standard success envelope:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "time": "2026-11-07T16:00:00Z"
  }
}
```

Use `/health` for local checks and container probes.

## Error

Production response:

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "user not found"
  }
}
```

Development response adds internal detail:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "internal server error",
    "debug": "repository: relation does not exist"
  }
}
```

Enable development details with:

```env
APP_ENV=development
```

Any other value uses production-safe errors.

## Error Codes

- `INTERNAL_ERROR` — unexpected server failure
- Domain errors use stable uppercase codes, for example `USER_NOT_FOUND`
- `message` is safe for clients and must not contain SQL, credentials, stack traces, or internal paths
- `debug` is emitted only when `APP_ENV=development`

## Echo Rules

- Configure `e.HTTPErrorHandler` once in `cmd/api/main.go`.
- Handlers return errors; do not manually format error envelopes.
- Use `domain.AppError` for known application failures.
- Use `httpDelivery.Success` for successful JSON responses.
- Do not expose raw `error.Error()` in production.

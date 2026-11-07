# Logging Standard

## Design

Application uses one injected `*slog.Logger` per process. `cmd/*/main.go` creates it and passes it to components that log.

- Development: human-readable text on stderr.
- Production: JSON on stderr.
- Level comes from `LOG_LEVEL`.
- Echo request logs use the same logger.

## Rules

1. Use Go standard library `log/slog`.
2. Do not use `fmt.Println`, `fmt.Printf`, or package `log` for application logs.
3. Create logger once in each process entry point.
4. Pass logger as a dependency. Do not create package-level mutable loggers.
5. Use structured attributes:

```go
log.Info("user created", "user_id", userID)
log.Error("database query failed", "error", err)
```

6. Use levels consistently:
   - `DEBUG` — development diagnostics
   - `INFO` — normal lifecycle and request events
   - `WARN` — recoverable abnormal conditions
   - `ERROR` — failed operations requiring attention
7. Log errors at the boundary that handles them. Avoid logging the same error at every layer.
8. Never log passwords, tokens, JWT secrets, database credentials, or sensitive request bodies.
9. Add operation context to errors before logging.
10. Keep stable attribute names: `error`, `request_id`, `method`, `uri`, `status`, `latency`.
11. Production error responses stay safe even when server logs contain internal details.

## Request Logs

HTTP requests emit one structured event with:

- `method`
- `uri`
- `status`
- `latency`
- `remote_ip`
- `request_id`
- `error` when request fails

## Validation

Before commit:

```bash
grep -R 'fmt\.Print\|log\.Print' --include='*.go' .
go test ./...
```

Any application logging exception needs documentation in the change.

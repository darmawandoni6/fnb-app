# Validation Standard

## Library

Request validation uses `github.com/go-playground/validator/v10` at HTTP delivery boundary.

## Rules

1. Add `validate` tags to request DTO fields.
2. Bind and validate request bodies through `http.Binder`.
3. Return `VALIDATION_ERROR` with HTTP `400` for invalid input.
4. Keep validation messages safe and client-oriented.
5. Keep business rules such as uniqueness, permissions, and state transitions in usecases.
6. Do not manually decode JSON in handlers.
7. Do not validate request formatting in repositories.
8. Never include passwords, tokens, or raw request bodies in validation errors.

## Example

```go
type CreateUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

var request CreateUserRequest
if err := binder.Bind(&request, c); err != nil {
	return err
}
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email is invalid",
    "fields": {
      "email": "invalid"
    }
  }
}
```

package http

import (
	"encoding/json"
	"errors"
	"io"
	"strings"

	"fnb-server/internal/domain"
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

type Binder struct {
	validator *validator.Validate
}

func NewBinder() *Binder {
	return &Binder{validator: validator.New()}
}

func (b *Binder) Bind(i interface{}, c echo.Context) error {
	if err := json.NewDecoder(c.Request().Body).Decode(i); err != nil {
		if errors.Is(err, io.EOF) {
			return domain.NewError(domain.CodeValidationError, "request body is required", 400, err)
		}
		return domain.NewError(domain.CodeValidationError, "invalid request body", 400, err)
	}
	if err := b.validator.Struct(i); err != nil {
		var validationErrors validator.ValidationErrors
		if errors.As(err, &validationErrors) {
			return domain.NewError(domain.CodeValidationError, formatValidationErrors(validationErrors), 400, err)
		}
		return domain.NewError(domain.CodeValidationError, "validation failed", 400, err)
	}
	return nil
}

func formatValidationErrors(errs validator.ValidationErrors) string {
	messages := make([]string, 0, len(errs))
	for _, err := range errs {
		messages = append(messages, strings.ToLower(err.Field())+" is invalid")
	}
	return strings.Join(messages, ", ")
}

package http

import (
	"errors"
	"log/slog"
	"net/http"

	"fnb-server/internal/domain"
	"github.com/labstack/echo/v4"
)

type response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *errorBody  `json:"error,omitempty"`
}

type errorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
	Debug   string            `json:"debug,omitempty"`
}

func Success(c echo.Context, status int, data interface{}) error {
	return c.JSON(status, response{Success: true, Data: data})
}

func ErrorHandler(isDevelopment bool, log *slog.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}

		log.Error("HTTP request failed", "error", err, "path", c.Path(), "method", c.Request().Method)
		body := errorBody{Code: domain.CodeInternalError, Message: "internal server error"}
		status := http.StatusInternalServerError
		var appErr *domain.AppError
		if errors.As(err, &appErr) {
			body.Code = appErr.Code
			body.Message = appErr.Message
			body.Fields = appErr.Fields
			status = appErr.HTTPStatus
		} else if httpErr, ok := err.(*echo.HTTPError); ok {
			status = httpErr.Code
			body.Code = http.StatusText(status)
			body.Message = http.StatusText(status)
		}
		if isDevelopment {
			body.Debug = err.Error()
		}
		_ = c.JSON(status, response{Success: false, Error: &body})
	}
}

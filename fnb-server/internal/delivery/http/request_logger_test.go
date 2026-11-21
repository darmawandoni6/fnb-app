package http

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestRequestLogger_MasksSessionToken(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))

	e := echo.New()
	e.Use(RequestLogger(logger))

	e.GET("/test", func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	rawToken := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	req := httptest.NewRequest(http.MethodGet, "/test?session_token="+rawToken, nil)
	req.Header.Set("X-Session-Token", rawToken)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	logOutput := buf.String()

	// The full rawToken must NOT appear in the log output
	if strings.Contains(logOutput, rawToken) {
		t.Fatalf("security violation: raw session token found in log output: %s", logOutput)
	}

	// It must contain masked representation or REDACTED
	if !strings.Contains(logOutput, "[REDACTED]") && !strings.Contains(logOutput, "abcd...") {
		t.Errorf("expected masked token in log, got: %s", logOutput)
	}
}

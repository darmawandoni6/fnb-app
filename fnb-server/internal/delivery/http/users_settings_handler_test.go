package http

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"fnb-server/internal/domain"
	"github.com/labstack/echo/v4"
)

func TestUpdateSettings_RejectsClosing(t *testing.T) {
	h := NewUsersSettingsHandler(nil, nil)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPatch, "/settings", bytes.NewBufferString(`{"is_open":false}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	err := h.UpdateSettings(e.NewContext(req, rec))
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION, got %v", err)
	}
}

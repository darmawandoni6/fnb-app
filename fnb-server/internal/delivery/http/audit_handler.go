package http

import (
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type AuditHandler struct {
	audit *usecase.AuditUsecase
}

func NewAuditHandler(a *usecase.AuditUsecase) *AuditHandler {
	return &AuditHandler{audit: a}
}

func (h *AuditHandler) List(c echo.Context) error {
	filter := domain.AuditFilter{}
	if v := c.QueryParam("entity"); v != "" {
		filter.Entity = &v
	}
	if v := c.QueryParam("entity_id"); v != "" {
		parsed, err := uuid.Parse(v)
		if err != nil {
			return domain.NewError(domain.CodeValidationError, "invalid entity_id", http.StatusBadRequest, err)
		}
		filter.EntityID = &parsed
	}
	if v := c.QueryParam("actor_id"); v != "" {
		parsed, err := uuid.Parse(v)
		if err != nil {
			return domain.NewError(domain.CodeValidationError, "invalid actor_id", http.StatusBadRequest, err)
		}
		filter.ActorID = &parsed
	}
	if d := c.QueryParam("from"); d != "" {
		t, err := time.Parse("2006-01-02", d)
		if err != nil {
			return domain.NewError(domain.CodeValidationError, "invalid from date (expected YYYY-MM-DD)", http.StatusBadRequest, nil)
		}
		filter.From = &t
	}
	if d := c.QueryParam("to"); d != "" {
		t, err := time.Parse("2006-01-02", d)
		if err != nil {
			return domain.NewError(domain.CodeValidationError, "invalid to date (expected YYYY-MM-DD)", http.StatusBadRequest, nil)
		}
		end := t.Add(24*time.Hour - time.Nanosecond)
		filter.To = &end
	}
	logs, err := h.audit.List(c.Request().Context(), filter)
	if err != nil {
		return err
	}
	return Success(c, 200, logs)
}

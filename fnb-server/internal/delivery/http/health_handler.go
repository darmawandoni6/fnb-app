package http

import (
	"net/http"
	"time"

	"fnb-server/internal/delivery/http/dto"
	"github.com/labstack/echo/v4"
)

func Health(c echo.Context) error {
	return Success(c, http.StatusOK, dto.HealthResponse{
		Status: "ok",
		Time:   time.Now().UTC().Format(time.RFC3339),
	})
}

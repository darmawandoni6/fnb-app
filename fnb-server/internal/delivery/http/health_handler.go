package http

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

type healthResponse struct {
	Status string `json:"status"`
	Time   string `json:"time"`
}

func Health(c echo.Context) error {
	return Success(c, http.StatusOK, healthResponse{
		Status: "ok",
		Time:   time.Now().UTC().Format(time.RFC3339),
	})
}

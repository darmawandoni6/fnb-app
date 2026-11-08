package http

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

func publicRateLimit(perSecond rate.Limit, burst int, identifier middleware.Extractor) echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store:               middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{Rate: perSecond, Burst: burst}),
		IdentifierExtractor: identifier,
		DenyHandler: func(c echo.Context, id string, err error) error {
			return echo.NewHTTPError(http.StatusTooManyRequests, fmt.Sprintf("rate limit exceeded for %s", id)).SetInternal(err)
		},
	})
}

func qrRateLimit(ratePerMinute float64, burst int) echo.MiddlewareFunc {
	return publicRateLimit(rate.Limit(ratePerMinute/60), burst, func(c echo.Context) (string, error) { return "qr:" + c.Param("qr_token"), nil })
}

func statusRateLimit(ratePerMinute float64, burst int) echo.MiddlewareFunc {
	return publicRateLimit(rate.Limit(ratePerMinute/60), burst, func(c echo.Context) (string, error) { return "ip:" + c.RealIP(), nil })
}

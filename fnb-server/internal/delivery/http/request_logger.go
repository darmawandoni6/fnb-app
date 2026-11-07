package http

import (
	"context"
	"log/slog"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func RequestLogger(log *slog.Logger) echo.MiddlewareFunc {
	return middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogLatency:   true,
		LogRemoteIP:  true,
		LogMethod:    true,
		LogURI:       true,
		LogRequestID: true,
		LogStatus:    true,
		HandleError:  true,
		LogValuesFunc: func(c echo.Context, values middleware.RequestLoggerValues) error {
			attrs := []slog.Attr{
				slog.String("method", values.Method),
				slog.String("uri", values.URI),
				slog.Int("status", values.Status),
				slog.Duration("latency", values.Latency),
				slog.String("remote_ip", values.RemoteIP),
				slog.String("request_id", values.RequestID),
			}
			if values.Error != nil {
				attrs = append(attrs, slog.String("error", values.Error.Error()))
				log.LogAttrs(context.Background(), slog.LevelError, "http request failed", attrs...)
				return nil
			}
			log.LogAttrs(context.Background(), slog.LevelInfo, "http request", attrs...)
			return nil
		},
	})
}

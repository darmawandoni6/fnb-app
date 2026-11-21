package http

import (
	"context"
	"log/slog"
	"strings"

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
				slog.String("uri", sanitizeURI(values.URI)),
				slog.Int("status", values.Status),
				slog.Duration("latency", values.Latency),
				slog.String("remote_ip", values.RemoteIP),
				slog.String("request_id", values.RequestID),
			}

			if token := c.Request().Header.Get(HeaderSessionToken); token != "" {
				attrs = append(attrs, slog.String("session_token", MaskSessionToken(token)))
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

func MaskSessionToken(token string) string {
	if token == "" {
		return ""
	}
	if len(token) <= 8 {
		return "[REDACTED]"
	}
	return token[:4] + "..." + token[len(token)-4:]
}

func sanitizeURI(uri string) string {
	if !strings.Contains(uri, "session_token=") && !strings.Contains(uri, "token=") {
		return uri
	}
	// Simple sanitization for query params if any
	parts := strings.SplitN(uri, "?", 2)
	if len(parts) < 2 {
		return uri
	}
	params := strings.Split(parts[1], "&")
	for i, p := range params {
		kv := strings.SplitN(p, "=", 2)
		if strings.EqualFold(kv[0], "session_token") || strings.EqualFold(kv[0], "token") {
			params[i] = kv[0] + "=[REDACTED]"
		}
	}
	return parts[0] + "?" + strings.Join(params, "&")
}

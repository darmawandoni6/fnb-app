package http

import (
	"net/http"
	"strings"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/labstack/echo/v4"
)

const (
	ContextSessionKey  = "table_session"
	HeaderSessionToken = "X-Session-Token"
)

func SessionMiddleware(u *usecase.TableSessionUsecase) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := c.Request().Header.Get(HeaderSessionToken)
			if strings.TrimSpace(token) == "" {
				return domain.NewError(domain.CodeUnauthorized, "session token is required", http.StatusUnauthorized, nil)
			}

			session, err := u.RequireOpen(c.Request().Context(), token)
			if err != nil {
				return err
			}

			c.Set(ContextSessionKey, session)
			return next(c)
		}
	}
}

func GetTableSession(c echo.Context) (*domain.TableSession, bool) {
	val := c.Get(ContextSessionKey)
	session, ok := val.(*domain.TableSession)
	return session, ok
}

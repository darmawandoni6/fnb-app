package http

import (
	"net/http"
	"strings"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

const (
	ContextUserIDKey = "user_id"
	ContextRoleKey   = "role"
)

func JWTMiddleware(authUsecase *usecase.AuthUsecase) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return domain.NewError(domain.CodeUnauthorized, "missing authorization header", http.StatusUnauthorized, nil)
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				return domain.NewError(domain.CodeUnauthorized, "invalid authorization header format", http.StatusUnauthorized, nil)
			}

			claims, err := authUsecase.ValidateAccessToken(parts[1])
			if err != nil {
				return domain.NewError(domain.CodeUnauthorized, "invalid or expired access token", http.StatusUnauthorized, err)
			}

			c.Set(ContextUserIDKey, claims.UserID)
			c.Set(ContextRoleKey, claims.Role)

			return next(c)
		}
	}
}

func RequireRoles(roles ...domain.UserRole) echo.MiddlewareFunc {
	allowedRoles := make(map[domain.UserRole]bool, len(roles))
	for _, r := range roles {
		allowedRoles[r] = true
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			roleVal := c.Get(ContextRoleKey)
			userRole, ok := roleVal.(domain.UserRole)
			if !ok || !allowedRoles[userRole] {
				return domain.NewError(domain.CodeForbidden, "insufficient permissions", http.StatusForbidden, nil)
			}
			return next(c)
		}
	}
}

func GetCurrentUserID(c echo.Context) (uuid.UUID, bool) {
	val := c.Get(ContextUserIDKey)
	id, ok := val.(uuid.UUID)
	return id, ok
}

func GetCurrentUserRole(c echo.Context) (domain.UserRole, bool) {
	val := c.Get(ContextRoleKey)
	role, ok := val.(domain.UserRole)
	return role, ok
}

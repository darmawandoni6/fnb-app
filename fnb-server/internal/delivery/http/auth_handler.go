package http

import (
	"net/http"
	"time"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/labstack/echo/v4"
)

const RefreshCookieName = "refresh_token"

type AuthHandler struct {
	authUsecase  *usecase.AuthUsecase
	isProduction bool
}

func NewAuthHandler(authUsecase *usecase.AuthUsecase, isProduction bool) *AuthHandler {
	return &AuthHandler{
		authUsecase:  authUsecase,
		isProduction: isProduction,
	}
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req dto.LoginRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	result, err := h.authUsecase.Login(c.Request().Context(), req.Email, req.Password)
	if err != nil {
		return err
	}

	h.setRefreshCookie(c, result.RefreshToken, result.RefreshExpiresAt)

	return Success(c, http.StatusOK, dto.LoginResponse{
		AccessToken: result.AccessToken,
		User:        result.User,
	})
}

func (h *AuthHandler) Refresh(c echo.Context) error {
	cookie, err := c.Cookie(RefreshCookieName)
	if err != nil || cookie.Value == "" {
		return domain.NewError(domain.CodeUnauthorized, "refresh token is required", http.StatusUnauthorized, nil)
	}

	result, err := h.authUsecase.RefreshToken(c.Request().Context(), cookie.Value)
	if err != nil {
		return err
	}

	h.setRefreshCookie(c, result.RefreshToken, result.RefreshExpiresAt)

	return Success(c, http.StatusOK, dto.RefreshTokenResponse{
		AccessToken: result.AccessToken,
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	cookie, err := c.Cookie(RefreshCookieName)
	if err == nil && cookie.Value != "" {
		_ = h.authUsecase.Logout(c.Request().Context(), cookie.Value)
	}

	h.clearRefreshCookie(c)

	return Success(c, http.StatusOK, dto.MessageResponse{
		Message: "logged out successfully",
	})
}

func (h *AuthHandler) setRefreshCookie(c echo.Context, token string, expiresAt time.Time) {
	c.SetCookie(&http.Cookie{
		Name:     RefreshCookieName,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   h.isProduction,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *AuthHandler) clearRefreshCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     RefreshCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.isProduction,
		SameSite: http.SameSiteLaxMode,
	})
}

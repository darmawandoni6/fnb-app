package dto

import "fnb-server/internal/domain"

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	AccessToken string       `json:"access_token"`
	User        *domain.User `json:"user"`
}

type RefreshTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type MessageResponse struct {
	Message string `json:"message"`
}

package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type JWTClaims struct {
	UserID uuid.UUID       `json:"user_id"`
	Role   domain.UserRole `json:"role"`
	jwt.RegisteredClaims
}

type AuthResult struct {
	AccessToken      string       `json:"access_token"`
	RefreshToken     string       `json:"-"`
	RefreshExpiresAt time.Time    `json:"-"`
	User             *domain.User `json:"user"`
}

type RefreshResult struct {
	AccessToken      string    `json:"access_token"`
	RefreshToken     string    `json:"-"`
	RefreshExpiresAt time.Time `json:"-"`
}

type AuthUsecase struct {
	userRepo    domain.UserRepository
	sessionRepo domain.SessionRepository
	jwtSecret   []byte
	accessTTL   time.Duration
	refreshTTL  time.Duration
}

func NewAuthUsecase(
	userRepo domain.UserRepository,
	sessionRepo domain.SessionRepository,
	jwtSecret string,
	accessTTL time.Duration,
	refreshTTL time.Duration,
) *AuthUsecase {
	return &AuthUsecase{
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		jwtSecret:   []byte(jwtSecret),
		accessTTL:   accessTTL,
		refreshTTL:  refreshTTL,
	}
}

func (u *AuthUsecase) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	user, err := u.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to query user", http.StatusInternalServerError, err)
	}
	if user == nil {
		return nil, domain.NewError(domain.CodeInvalidCredentials, "invalid email or password", http.StatusUnauthorized, nil)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, domain.NewError(domain.CodeInvalidCredentials, "invalid email or password", http.StatusUnauthorized, nil)
	}

	if !user.IsActive {
		return nil, domain.NewError(domain.CodeUserInactive, "user account is deactivated", http.StatusForbidden, nil)
	}

	accessToken, err := u.generateAccessToken(user.ID, user.Role)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to generate access token", http.StatusInternalServerError, err)
	}

	rawRefreshToken, tokenHash, err := u.generateRefreshToken()
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to generate refresh token", http.StatusInternalServerError, err)
	}

	refreshExpiresAt := time.Now().UTC().Add(u.refreshTTL)
	session := &domain.Session{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: refreshExpiresAt,
	}
	if err := u.sessionRepo.Create(ctx, session); err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to create session", http.StatusInternalServerError, err)
	}

	return &AuthResult{
		AccessToken:      accessToken,
		RefreshToken:     rawRefreshToken,
		RefreshExpiresAt: refreshExpiresAt,
		User:             user,
	}, nil
}

func (u *AuthUsecase) RefreshToken(ctx context.Context, rawRefreshToken string) (*RefreshResult, error) {
	if rawRefreshToken == "" {
		return nil, domain.NewError(domain.CodeUnauthorized, "missing refresh token", http.StatusUnauthorized, nil)
	}

	tokenHash := u.hashToken(rawRefreshToken)
	session, err := u.sessionRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to query session", http.StatusInternalServerError, err)
	}
	if session == nil || session.RevokedAt != nil || time.Now().UTC().After(session.ExpiresAt) {
		return nil, domain.NewError(domain.CodeUnauthorized, "invalid or expired refresh token", http.StatusUnauthorized, nil)
	}

	if !session.User.IsActive {
		return nil, domain.NewError(domain.CodeUserInactive, "user account is deactivated", http.StatusForbidden, nil)
	}

	// Revoke old session (refresh token rotation)
	if err := u.sessionRepo.Revoke(ctx, session.ID); err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to revoke old session", http.StatusInternalServerError, err)
	}

	newAccessToken, err := u.generateAccessToken(session.User.ID, session.User.Role)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to generate access token", http.StatusInternalServerError, err)
	}

	newRawRefreshToken, newTokenHash, err := u.generateRefreshToken()
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to generate refresh token", http.StatusInternalServerError, err)
	}

	newRefreshExpiresAt := time.Now().UTC().Add(u.refreshTTL)
	newSession := &domain.Session{
		UserID:    session.User.ID,
		TokenHash: newTokenHash,
		ExpiresAt: newRefreshExpiresAt,
	}
	if err := u.sessionRepo.Create(ctx, newSession); err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to create new session", http.StatusInternalServerError, err)
	}

	return &RefreshResult{
		AccessToken:      newAccessToken,
		RefreshToken:     newRawRefreshToken,
		RefreshExpiresAt: newRefreshExpiresAt,
	}, nil
}

func (u *AuthUsecase) Logout(ctx context.Context, rawRefreshToken string) error {
	if rawRefreshToken == "" {
		return nil
	}

	tokenHash := u.hashToken(rawRefreshToken)
	session, err := u.sessionRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		return domain.NewError(domain.CodeInternalError, "failed to query session", http.StatusInternalServerError, err)
	}
	if session != nil && session.RevokedAt == nil {
		if err := u.sessionRepo.Revoke(ctx, session.ID); err != nil {
			return domain.NewError(domain.CodeInternalError, "failed to revoke session", http.StatusInternalServerError, err)
		}
	}
	return nil
}

func (u *AuthUsecase) ValidateAccessToken(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return u.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

func (u *AuthUsecase) generateAccessToken(userID uuid.UUID, role domain.UserRole) (string, error) {
	now := time.Now().UTC()
	claims := &JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(u.accessTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(u.jwtSecret)
}

func (u *AuthUsecase) generateRefreshToken() (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	rawToken := hex.EncodeToString(b)
	return rawToken, u.hashToken(rawToken), nil
}

func (u *AuthUsecase) hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

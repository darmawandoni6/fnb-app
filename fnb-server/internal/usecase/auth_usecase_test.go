package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type mockUserRepo struct {
	users map[string]*domain.User
}

func (m *mockUserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockUserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	return m.users[email], nil
}

func (m *mockUserRepo) Create(ctx context.Context, user *domain.User) error {
	m.users[user.Email] = user
	return nil
}

type mockSessionRepo struct {
	sessions map[string]*domain.Session
}

func (m *mockSessionRepo) Create(ctx context.Context, session *domain.Session) error {
	m.sessions[session.TokenHash] = session
	return nil
}

func (m *mockSessionRepo) GetByTokenHash(ctx context.Context, tokenHash string) (*domain.Session, error) {
	return m.sessions[tokenHash], nil
}

func (m *mockSessionRepo) Revoke(ctx context.Context, id uuid.UUID) error {
	for _, s := range m.sessions {
		if s.ID == id {
			now := time.Now().UTC()
			s.RevokedAt = &now
			return nil
		}
	}
	return nil
}

func (m *mockSessionRepo) RevokeByUserID(ctx context.Context, userID uuid.UUID) error {
	for _, s := range m.sessions {
		if s.UserID == userID {
			now := time.Now().UTC()
			s.RevokedAt = &now
		}
	}
	return nil
}

func TestAuthUsecase_Login_Success(t *testing.T) {
	password := "secret123"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	userID := uuid.New()
	user := &domain.User{
		ID:           userID,
		Name:         "Admin Owner",
		Email:        "owner@fnb.com",
		PasswordHash: string(hash),
		Role:         domain.UserRoleOwner,
		IsActive:     true,
	}

	userRepo := &mockUserRepo{users: map[string]*domain.User{user.Email: user}}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}

	u := NewAuthUsecase(userRepo, sessionRepo, "super-secret-key-12345", 15*time.Minute, 24*time.Hour)

	ctx := context.Background()
	res, err := u.Login(ctx, "owner@fnb.com", "secret123")
	if err != nil {
		t.Fatalf("expected login success, got error: %v", err)
	}

	if res.AccessToken == "" {
		t.Errorf("expected access token to be non-empty")
	}
	if res.RefreshToken == "" {
		t.Errorf("expected refresh token to be non-empty")
	}
	if res.User.Email != "owner@fnb.com" {
		t.Errorf("expected user email owner@fnb.com, got %s", res.User.Email)
	}

	claims, err := u.ValidateAccessToken(res.AccessToken)
	if err != nil {
		t.Fatalf("failed to validate generated access token: %v", err)
	}
	if claims.UserID != userID || claims.Role != domain.UserRoleOwner {
		t.Errorf("claims mismatch: %+v", claims)
	}
}

func TestAuthUsecase_Login_InvalidPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.DefaultCost)
	user := &domain.User{
		ID:           uuid.New(),
		Email:        "owner@fnb.com",
		PasswordHash: string(hash),
		Role:         domain.UserRoleOwner,
		IsActive:     true,
	}

	userRepo := &mockUserRepo{users: map[string]*domain.User{user.Email: user}}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}

	u := NewAuthUsecase(userRepo, sessionRepo, "secret", 15*time.Minute, 24*time.Hour)

	_, err := u.Login(context.Background(), "owner@fnb.com", "wrong-password")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidCredentials {
		t.Fatalf("expected INVALID_CREDENTIALS error, got %v", err)
	}
}

func TestAuthUsecase_RefreshToken_Rotation(t *testing.T) {
	userID := uuid.New()
	user := &domain.User{
		ID:       userID,
		Email:    "cashier@fnb.com",
		Role:     domain.UserRoleCashier,
		IsActive: true,
	}

	userRepo := &mockUserRepo{users: map[string]*domain.User{user.Email: user}}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}

	u := NewAuthUsecase(userRepo, sessionRepo, "secret", 15*time.Minute, 24*time.Hour)

	rawToken, tokenHash, _ := u.generateRefreshToken()
	sessionID := uuid.New()
	sessionRepo.sessions[tokenHash] = &domain.Session{
		ID:        sessionID,
		UserID:    userID,
		User:      *user,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
	}

	res, err := u.RefreshToken(context.Background(), rawToken)
	if err != nil {
		t.Fatalf("expected refresh success, got: %v", err)
	}

	if res.AccessToken == "" || res.RefreshToken == "" {
		t.Errorf("expected non-empty tokens in refresh result")
	}

	// Verify old session revoked
	if sessionRepo.sessions[tokenHash].RevokedAt == nil {
		t.Errorf("expected old session to be revoked")
	}

	// Trying to use old refresh token again should fail
	_, err = u.RefreshToken(context.Background(), rawToken)
	if err == nil {
		t.Fatal("expected refresh with revoked token to fail")
	}
}

func TestAuthUsecase_Login_InactiveUser(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
	user := &domain.User{
		ID:           uuid.New(),
		Email:        "inactive@fnb.com",
		PasswordHash: string(hash),
		Role:         domain.UserRoleCashier,
		IsActive:     false,
	}

	userRepo := &mockUserRepo{users: map[string]*domain.User{user.Email: user}}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}

	u := NewAuthUsecase(userRepo, sessionRepo, "secret", 15*time.Minute, 24*time.Hour)

	_, err := u.Login(context.Background(), "inactive@fnb.com", "password")
	if err == nil {
		t.Fatal("expected error for inactive user, got nil")
	}

	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeUserInactive {
		t.Fatalf("expected USER_INACTIVE code, got: %v", err)
	}
}

func TestAuthUsecase_Logout_Idempotent(t *testing.T) {
	userRepo := &mockUserRepo{users: make(map[string]*domain.User)}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}

	u := NewAuthUsecase(userRepo, sessionRepo, "secret", 15*time.Minute, 24*time.Hour)

	// Logging out with empty token succeeds
	if err := u.Logout(context.Background(), ""); err != nil {
		t.Errorf("expected nil on empty logout, got: %v", err)
	}

	// Logging out with non-existent token succeeds
	if err := u.Logout(context.Background(), "random-non-existent-token"); err != nil {
		t.Errorf("expected nil on unknown token logout, got: %v", err)
	}

	// Logging out with valid token revokes it and second call also succeeds
	rawToken, tokenHash, _ := u.generateRefreshToken()
	sessionID := uuid.New()
	sessionRepo.sessions[tokenHash] = &domain.Session{
		ID:        sessionID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
	}

	if err := u.Logout(context.Background(), rawToken); err != nil {
		t.Errorf("expected logout to succeed, got: %v", err)
	}
	if sessionRepo.sessions[tokenHash].RevokedAt == nil {
		t.Errorf("expected session to be revoked")
	}

	// Second logout with already revoked token
	if err := u.Logout(context.Background(), rawToken); err != nil {
		t.Errorf("expected repeated logout to be idempotent, got: %v", err)
	}
}

func TestAuthUsecase_ValidateAccessToken_Expired(t *testing.T) {
	userRepo := &mockUserRepo{users: make(map[string]*domain.User)}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}

	// Negative TTL to produce an already expired token
	u := NewAuthUsecase(userRepo, sessionRepo, "secret", -1*time.Minute, 24*time.Hour)

	token, err := u.generateAccessToken(uuid.New(), domain.UserRoleOwner)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	_, err = u.ValidateAccessToken(token)
	if err == nil {
		t.Fatal("expected expired token to be rejected, got nil error")
	}
}

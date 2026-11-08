package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
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

func setupAuthRouter() (*echo.Echo, *usecase.AuthUsecase, *domain.User) {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(true, nil)

	password := "password123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	testUser := &domain.User{
		ID:           uuid.New(),
		Name:         "Test Owner",
		Email:        "owner@test.com",
		PasswordHash: string(hash),
		Role:         domain.UserRoleOwner,
		IsActive:     true,
	}

	userRepo := &mockUserRepo{users: map[string]*domain.User{testUser.Email: testUser}}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}
	authUsecase := usecase.NewAuthUsecase(userRepo, sessionRepo, "test-secret-key-12345", 15*time.Minute, 24*time.Hour)
	handler := NewAuthHandler(authUsecase, false)

	e.POST("/auth/login", handler.Login)
	e.POST("/auth/refresh", handler.Refresh)
	e.POST("/auth/logout", handler.Logout)

	protected := e.Group("/protected", JWTMiddleware(authUsecase))
	protected.GET("/me", func(c echo.Context) error {
		userID, _ := GetCurrentUserID(c)
		role, _ := GetCurrentUserRole(c)
		return Success(c, http.StatusOK, map[string]interface{}{
			"user_id": userID,
			"role":    role,
		})
	})
	protected.GET("/admin-only", func(c echo.Context) error {
		return Success(c, http.StatusOK, map[string]string{"status": "ok"})
	}, RequireRoles(domain.UserRoleOwner))

	return e, authUsecase, testUser
}

func TestAuthHandler_Login_Success(t *testing.T) {
	e, _, _ := setupAuthRouter()

	body := `{"email":"owner@test.com","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewBufferString(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !res.Success || res.Data.AccessToken == "" {
		t.Errorf("expected success=true and non-empty access_token")
	}

	// Verify cookie
	cookies := rec.Result().Cookies()
	var foundRefreshCookie bool
	for _, c := range cookies {
		if c.Name == RefreshCookieName && c.Value != "" && c.HttpOnly {
			foundRefreshCookie = true
			break
		}
	}
	if !foundRefreshCookie {
		t.Errorf("expected httpOnly refresh_token cookie")
	}
}

func TestAuthHandler_Login_ValidationFailed(t *testing.T) {
	e, _, _ := setupAuthRouter()

	body := `{"email":"not-an-email","password":""}`
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewBufferString(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}

	var res struct {
		Success bool `json:"success"`
		Error   struct {
			Code   string            `json:"code"`
			Fields map[string]string `json:"fields"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res.Success || res.Error.Code != domain.CodeValidationError {
		t.Errorf("expected VALIDATION_ERROR code, got %s", res.Error.Code)
	}
}

func TestAuthHandler_ProtectedAndMiddleware(t *testing.T) {
	e, authUsecase, user := setupAuthRouter()

	// 1. Unauthenticated request to /protected/me
	req := httptest.NewRequest(http.MethodGet, "/protected/me", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d", rec.Code)
	}

	// 2. Login to get token
	loginRes, err := authUsecase.Login(context.Background(), user.Email, "password123")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	// 3. Authenticated request with Bearer token
	req = httptest.NewRequest(http.MethodGet, "/protected/me", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+loginRes.AccessToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d. Body: %s", rec.Code, rec.Body.String())
	}
}

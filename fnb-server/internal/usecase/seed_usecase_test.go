package usecase

import (
	"context"
	"testing"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func (m *mockUserRepo) Count(ctx context.Context) (int64, error) {
	return int64(len(m.users)), nil
}

func TestSeedUsecase_EmptyTableCreatesOwner(t *testing.T) {
	userRepo := &mockUserRepo{users: make(map[string]*domain.User)}
	u := NewSeedUsecase(userRepo, "owner@example.com", "password123", nil)

	ctx := context.Background()
	if err := u.SeedOwner(ctx); err != nil {
		t.Fatalf("expected seed success, got: %v", err)
	}

	if len(userRepo.users) != 1 {
		t.Fatalf("expected 1 user seeded, got %d", len(userRepo.users))
	}

	owner := userRepo.users["owner@example.com"]
	if owner == nil {
		t.Fatal("expected owner@example.com to exist")
	}
	if owner.Role != domain.UserRoleOwner {
		t.Errorf("expected role OWNER, got %s", owner.Role)
	}
	if !owner.IsActive {
		t.Errorf("expected owner to be active")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(owner.PasswordHash), []byte("password123")); err != nil {
		t.Errorf("password verification failed: %v", err)
	}
}

func TestSeedUsecase_NonEmptyTableCreatesNothing(t *testing.T) {
	existingUser := &domain.User{
		ID:       uuid.New(),
		Email:    "existing@example.com",
		Role:     domain.UserRoleCashier,
		IsActive: true,
	}
	userRepo := &mockUserRepo{users: map[string]*domain.User{existingUser.Email: existingUser}}
	u := NewSeedUsecase(userRepo, "owner@example.com", "password123", nil)

	ctx := context.Background()
	if err := u.SeedOwner(ctx); err != nil {
		t.Fatalf("expected seed success, got: %v", err)
	}

	if len(userRepo.users) != 1 {
		t.Fatalf("expected still 1 user, got %d", len(userRepo.users))
	}
	if userRepo.users["owner@example.com"] != nil {
		t.Errorf("expected owner not to be seeded when users already exist")
	}
}

func TestSeedUsecase_EmptyCredentialsSkipsWithoutError(t *testing.T) {
	userRepo := &mockUserRepo{users: make(map[string]*domain.User)}
	u := NewSeedUsecase(userRepo, "", "", nil)

	ctx := context.Background()
	if err := u.SeedOwner(ctx); err != nil {
		t.Fatalf("expected no error when credentials empty, got: %v", err)
	}
	if len(userRepo.users) != 0 {
		t.Errorf("expected no users seeded, got %d", len(userRepo.users))
	}
}

func TestSeedUsecase_InvalidEmailReturnsError(t *testing.T) {
	userRepo := &mockUserRepo{users: make(map[string]*domain.User)}
	u := NewSeedUsecase(userRepo, "invalid-email-format", "password123", nil)

	ctx := context.Background()
	if err := u.SeedOwner(ctx); err == nil {
		t.Fatal("expected error for invalid email, got nil")
	}
}

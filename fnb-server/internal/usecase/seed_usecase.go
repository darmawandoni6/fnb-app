package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"net/mail"
	"strings"

	"fnb-server/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type SeedUsecase struct {
	userRepo domain.UserRepository
	email    string
	password string
	log      *slog.Logger
}

func NewSeedUsecase(userRepo domain.UserRepository, email, password string, log *slog.Logger) *SeedUsecase {
	return &SeedUsecase{
		userRepo: userRepo,
		email:    strings.TrimSpace(email),
		password: password,
		log:      log,
	}
}

func (u *SeedUsecase) SeedOwner(ctx context.Context) error {
	count, err := u.userRepo.Count(ctx)
	if err != nil {
		return fmt.Errorf("seed owner count: %w", err)
	}
	if count > 0 {
		return nil
	}

	if u.email == "" || u.password == "" {
		if u.log != nil {
			u.log.Warn("skipping owner seed: SEED_OWNER_EMAIL or SEED_OWNER_PASSWORD not set")
		}
		return nil
	}

	if _, err := mail.ParseAddress(u.email); err != nil {
		return fmt.Errorf("seed owner: invalid email address %q: %w", u.email, err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(u.password), 12)
	if err != nil {
		return fmt.Errorf("seed owner hash password: %w", err)
	}

	owner := &domain.User{
		Name:         "Owner",
		Email:        u.email,
		PasswordHash: string(hash),
		Role:         domain.UserRoleOwner,
		IsActive:     true,
	}

	if err := u.userRepo.Create(ctx, owner); err != nil {
		return fmt.Errorf("seed owner create: %w", err)
	}

	if u.log != nil {
		u.log.Info("owner seeded successfully", "email", u.email)
	}

	return nil
}

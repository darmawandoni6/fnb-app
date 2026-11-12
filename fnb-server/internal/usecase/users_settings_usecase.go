package usecase

import (
	"context"
	"net/http"
	"net/mail"
	"strings"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserAdminUsecase struct{ repo domain.AdminUserRepository }

func NewUserAdminUsecase(repo domain.AdminUserRepository) *UserAdminUsecase {
	return &UserAdminUsecase{repo: repo}
}
func (u *UserAdminUsecase) List(ctx context.Context) ([]domain.User, error) { return u.repo.List(ctx) }
func validStaffRole(role domain.UserRole) bool {
	return role == domain.UserRoleCashier || role == domain.UserRoleKitchen
}
func validateStaff(name, email, password string, role domain.UserRole, requirePassword bool) error {
	if strings.TrimSpace(name) == "" {
		return validation("user name is required")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return validation("email is invalid")
	}
	if requirePassword && len(password) < 8 {
		return validation("password must be at least 8 characters")
	}
	if !validStaffRole(role) {
		return validation("role must be CASHIER or KITCHEN")
	}
	return nil
}
func (u *UserAdminUsecase) Create(ctx context.Context, name, email, password string, role domain.UserRole) error {
	if err := validateStaff(name, email, password, role, true); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user := &domain.User{Name: name, Email: email, PasswordHash: string(hash), Role: role, IsActive: true}
	if err = u.repo.Create(ctx, user); err != nil {
		if isUnique(err) {
			return domain.NewError(domain.CodeValidationError, "email already exists", http.StatusConflict, err)
		}
		return err
	}
	return nil
}
func (u *UserAdminUsecase) Update(ctx context.Context, id uuid.UUID, name *string, role *domain.UserRole, password *string, active *bool) (*domain.User, error) {
	user, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, notFound("user")
	}
	if name != nil {
		if strings.TrimSpace(*name) == "" {
			return nil, validation("user name is required")
		}
		user.Name = *name
	}
	if role != nil {
		if !validStaffRole(*role) {
			return nil, validation("role must be CASHIER or KITCHEN")
		}
		user.Role = *role
	}
	if password != nil {
		if len(*password) < 8 {
			return nil, validation("password must be at least 8 characters")
		}
		hash, e := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
		if e != nil {
			return nil, e
		}
		user.PasswordHash = string(hash)
	}
	if active != nil {
		user.IsActive = *active
	}
	if err = u.repo.Update(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

type SettingsUsecase struct{ repo domain.AdminSettingRepository }

func NewSettingsUsecase(repo domain.AdminSettingRepository) *SettingsUsecase {
	return &SettingsUsecase{repo: repo}
}
func defaultSetting() *domain.Setting {
	return &domain.Setting{CafeName: "", TaxPercent: 0, IsOpen: true}
}
func (u *SettingsUsecase) Get(ctx context.Context) (*domain.Setting, error) {
	s, e := u.repo.GetFirst(ctx)
	if e != nil {
		return nil, e
	}
	if s == nil {
		return defaultSetting(), nil
	}
	return s, nil
}
func (u *SettingsUsecase) Update(ctx context.Context, cafe string, tax float64, open bool) (*domain.Setting, error) {
	if strings.TrimSpace(cafe) == "" {
		return nil, validation("cafe name is required")
	}
	if tax < 0 || tax > 100 {
		return nil, validation("tax percent must be between 0 and 100")
	}
	s, e := u.repo.GetFirst(ctx)
	if e != nil {
		return nil, e
	}
	if s == nil {
		s = defaultSetting()
	}
	s.CafeName = cafe
	s.TaxPercent = tax
	s.IsOpen = open
	if e = u.repo.Update(ctx, s); e != nil {
		return nil, e
	}
	return s, nil
}

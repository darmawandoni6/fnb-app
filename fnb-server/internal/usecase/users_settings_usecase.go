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

type UserAdminUsecase struct {
	repo        domain.AdminUserRepository
	sessionRepo domain.SessionRepository
}

func NewUserAdminUsecase(repo domain.AdminUserRepository, sessionRepo domain.SessionRepository) *UserAdminUsecase {
	return &UserAdminUsecase{repo: repo, sessionRepo: sessionRepo}
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
		wasActive := user.IsActive
		user.IsActive = *active
		if wasActive && !*active && u.sessionRepo != nil {
			if err := u.sessionRepo.RevokeByUserID(ctx, user.ID); err != nil {
				return nil, err
			}
		}
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
	return &domain.Setting{CafeName: "", TaxRate: 0, ServiceRate: 5, IsOpen: true}
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
func (u *SettingsUsecase) Update(ctx context.Context, in *domain.Setting) (*domain.Setting, error) {
	if strings.TrimSpace(in.CafeName) == "" {
		return nil, validation("cafe name is required")
	}
	if in.TaxRate < 0 || in.TaxRate > 100 {
		return nil, validation("tax rate must be between 0 and 100")
	}
	if in.ServiceRate < 0 || in.ServiceRate > 100 {
		return nil, validation("service rate must be between 0 and 100")
	}
	if in.CashTimeoutMinutes < 1 {
		return nil, validation("cash timeout must be at least 1 minute")
	}
	if in.DeliveredAutoCompleteMinutes < 1 {
		return nil, validation("delivered auto complete must be at least 1 minute")
	}
	if in.ReadyAutoDeliverMinutes < 1 {
		return nil, validation("ready auto deliver must be at least 1 minute")
	}
	if in.ReadyAutoDeliverWarningMinutes < 0 {
		return nil, validation("ready auto deliver warning cannot be negative")
	}
	if in.ReadyAutoDeliverWarningMinutes >= in.ReadyAutoDeliverMinutes {
		return nil, validation("ready auto deliver warning must be less than ready auto deliver")
	}
	s, e := u.repo.GetFirst(ctx)
	if e != nil {
		return nil, e
	}
	if s == nil {
		s = defaultSetting()
	}
	s.CafeName = in.CafeName
	s.TaxRate = in.TaxRate
	s.ServiceRate = in.ServiceRate
	s.IsOpen = in.IsOpen
	s.CashTimeoutMinutes = in.CashTimeoutMinutes
	s.DeliveredAutoCompleteMinutes = in.DeliveredAutoCompleteMinutes
	s.ReadyAutoDeliverMinutes = in.ReadyAutoDeliverMinutes
	s.ReadyAutoDeliverWarningMinutes = in.ReadyAutoDeliverWarningMinutes
	if e = u.repo.Update(ctx, s); e != nil {
		return nil, e
	}
	return s, nil
}

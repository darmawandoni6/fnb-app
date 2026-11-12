package dto

type CreateUserRequest struct {
	Name     string `json:"name" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	Role     string `json:"role" validate:"required,oneof=CASHIER KITCHEN"`
}
type UpdateUserRequest struct {
	Name     *string `json:"name" validate:"omitempty,min=1"`
	Role     *string `json:"role" validate:"omitempty,oneof=CASHIER KITCHEN"`
	Password *string `json:"password" validate:"omitempty,min=8"`
	IsActive *bool   `json:"is_active"`
}
type UpdateSettingsRequest struct {
	CafeName   *string  `json:"cafe_name" validate:"omitempty,min=1"`
	TaxPercent *float64 `json:"tax_percent" validate:"omitempty,gte=0,lte=100"`
	IsOpen     *bool    `json:"is_open"`
}

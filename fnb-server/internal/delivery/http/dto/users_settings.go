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
	CafeName                       *string  `json:"cafe_name" validate:"omitempty,min=1"`
	ServiceRate                    *float64 `json:"service_rate" validate:"omitempty,gte=0,lte=100"`
	TaxRate                        *float64 `json:"tax_rate" validate:"omitempty,gte=0,lte=100"`
	IsOpen                         *bool    `json:"is_open"`
	CashTimeoutMinutes             *int     `json:"cash_timeout_minutes" validate:"omitempty,min=1"`
	DeliveredAutoCompleteMinutes   *int     `json:"delivered_auto_complete_minutes" validate:"omitempty,min=1"`
	ReadyAutoDeliverMinutes        *int     `json:"ready_auto_deliver_minutes" validate:"omitempty,min=1"`
	ReadyAutoDeliverWarningMinutes *int     `json:"ready_auto_deliver_warning_minutes" validate:"omitempty,min=0"`
}

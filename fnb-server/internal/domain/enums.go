package domain

type OrderStatus string

const (
	OrderStatusWaiting    OrderStatus = "MENUNGGU"
	OrderStatusProcessing OrderStatus = "DIPROSES"
	OrderStatusCompleted  OrderStatus = "SELESAI"
	OrderStatusCancelled  OrderStatus = "DIBATALKAN"
)

func (s OrderStatus) Valid() bool {
	switch s {
	case OrderStatusWaiting, OrderStatusProcessing, OrderStatusCompleted, OrderStatusCancelled:
		return true
	default:
		return false
	}
}

type OrderItemStatus string

const (
	OrderItemStatusPending   OrderItemStatus = "PENDING"
	OrderItemStatusCooking   OrderItemStatus = "COOKING"
	OrderItemStatusReady     OrderItemStatus = "READY"
	OrderItemStatusDelivered OrderItemStatus = "DELIVERED"
	OrderItemStatusCompleted OrderItemStatus = "COMPLETED"
	OrderItemStatusCancelled OrderItemStatus = "CANCELLED"
)

func (s OrderItemStatus) Valid() bool {
	switch s {
	case OrderItemStatusPending, OrderItemStatusCooking, OrderItemStatusReady, OrderItemStatusDelivered, OrderItemStatusCompleted, OrderItemStatusCancelled:
		return true
	default:
		return false
	}
}

type PaymentStatus string

const (
	PaymentStatusUnpaid PaymentStatus = "BELUM"
	PaymentStatusPaid   PaymentStatus = "LUNAS"
)

func (s PaymentStatus) Valid() bool { return s == PaymentStatusUnpaid || s == PaymentStatusPaid }

type PaymentMethod string

const (
	PaymentMethodCash    PaymentMethod = "CASH"
	PaymentMethodNonCash PaymentMethod = "NON_CASH"
)

func (s PaymentMethod) Valid() bool { return s == PaymentMethodCash || s == PaymentMethodNonCash }

type OrderType string

const (
	OrderTypeDineIn   OrderType = "DINE_IN"
	OrderTypeTakeAway OrderType = "TAKE_AWAY"
)

func (s OrderType) Valid() bool { return s == OrderTypeDineIn || s == OrderTypeTakeAway }

type UserRole string

const (
	UserRoleOwner   UserRole = "OWNER"
	UserRoleCashier UserRole = "CASHIER"
	UserRoleKitchen UserRole = "KITCHEN"
)

func (s UserRole) Valid() bool {
	return s == UserRoleOwner || s == UserRoleCashier || s == UserRoleKitchen
}

type StockMovementType string

const (
	StockMovementTypeIn         StockMovementType = "IN"
	StockMovementTypeOut        StockMovementType = "OUT"
	StockMovementTypeRestore    StockMovementType = "RESTORE"
	StockMovementTypeAdjustment StockMovementType = "ADJUSTMENT"
)

func (s StockMovementType) Valid() bool {
	switch s {
	case StockMovementTypeIn, StockMovementTypeOut, StockMovementTypeRestore, StockMovementTypeAdjustment:
		return true
	default:
		return false
	}
}

type TableSessionStatus string

const (
	TableSessionStatusOpen   TableSessionStatus = "OPEN"
	TableSessionStatusClosed TableSessionStatus = "CLOSED"
)

func (s TableSessionStatus) Valid() bool {
	return s == TableSessionStatusOpen || s == TableSessionStatusClosed
}

type PaymentGateway string

const (
	PaymentGatewayMidtrans PaymentGateway = "MIDTRANS"
)

func (s PaymentGateway) Valid() bool {
	return s == PaymentGatewayMidtrans
}

type PaymentLogStatus string

const (
	PaymentLogStatusPending PaymentLogStatus = "PENDING"
	PaymentLogStatusSettled PaymentLogStatus = "SETTLED"
	PaymentLogStatusExpired PaymentLogStatus = "EXPIRED"
	PaymentLogStatusFailed  PaymentLogStatus = "FAILED"
)

func (s PaymentLogStatus) Valid() bool {
	switch s {
	case PaymentLogStatusPending, PaymentLogStatusSettled, PaymentLogStatusExpired, PaymentLogStatusFailed:
		return true
	default:
		return false
	}
}

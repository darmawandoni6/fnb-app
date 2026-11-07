package domain

type OrderStatus string

const (
	OrderStatusWaiting    OrderStatus = "MENUNGGU"
	OrderStatusProcessing OrderStatus = "DIPROSES"
	OrderStatusReady      OrderStatus = "SIAP"
	OrderStatusDelivering OrderStatus = "DIANTAR"
	OrderStatusCompleted  OrderStatus = "SELESAI"
	OrderStatusCancelled  OrderStatus = "DIBATALKAN"
)

func (s OrderStatus) Valid() bool {
	switch s {
	case OrderStatusWaiting, OrderStatusProcessing, OrderStatusReady, OrderStatusDelivering, OrderStatusCompleted, OrderStatusCancelled:
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
	OrderItemStatusCancelled OrderItemStatus = "CANCELLED"
)

func (s OrderItemStatus) Valid() bool {
	switch s {
	case OrderItemStatusPending, OrderItemStatusCooking, OrderItemStatusReady, OrderItemStatusDelivered, OrderItemStatusCancelled:
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
	OrderTypeQR     OrderType = "QR"
	OrderTypeManual OrderType = "MANUAL"
)

func (s OrderType) Valid() bool { return s == OrderTypeQR || s == OrderTypeManual }

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
	StockMovementIn         StockMovementType = "IN"
	StockMovementOut        StockMovementType = "OUT"
	StockMovementRestore    StockMovementType = "RESTORE"
	StockMovementAdjustment StockMovementType = "ADJUSTMENT"
)

func (s StockMovementType) Valid() bool {
	return s == StockMovementIn || s == StockMovementOut || s == StockMovementRestore || s == StockMovementAdjustment
}

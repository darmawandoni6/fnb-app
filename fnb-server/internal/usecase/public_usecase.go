package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"math"
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type OrderTx interface {
	CreateOrder(context.Context, *domain.Order) error
	CreateItems(context.Context, []domain.OrderItem) error
	ConsumeStock(context.Context, []domain.OrderItem) error
	PersistCancel(context.Context, *domain.Order, uuid.UUID, *domain.Refund) error
}
type TxRunner func(context.Context, func(OrderTx) error) error

type PublicUsecase struct {
	tableRepo   domain.TableRepository
	menuRepo    domain.MenuRepository
	settingRepo domain.SettingRepository
	orderRepo   domain.OrderRepository
	withTx      TxRunner
}

func NewPublicUsecase(t domain.TableRepository, m domain.MenuRepository, s domain.SettingRepository, o domain.OrderRepository, tx TxRunner) *PublicUsecase {
	return &PublicUsecase{t, m, s, o, tx}
}

type MenuResult struct {
	CafeName   string
	TaxPercent float64
	IsOpen     bool
	Categories []MenuCategoryResult
}
type MenuCategoryResult struct {
	ID    uuid.UUID
	Name  string
	Menus []MenuItemResult
}
type MenuItemResult struct {
	ID       uuid.UUID
	Name     string
	Price    int64
	ImageURL *string
}
type CreateOrderItem struct {
	MenuID uuid.UUID
	Qty    int
	Note   *string
}
type OrderItemResult struct {
	ID       uuid.UUID
	MenuName string
	Qty      int
	Price    int64
	Status   domain.OrderItemStatus
	Note     *string
}
type CreateOrderResult struct {
	Order         *domain.Order
	TrackingToken string
	Items         []OrderItemResult
}
type OrderStatusResult struct {
	Order *domain.Order
	Items []OrderItemResult
}

func (u *PublicUsecase) Menu(ctx context.Context, token string) (*MenuResult, error) {
	t, e := u.tableRepo.GetByQRToken(ctx, token)
	if e != nil {
		return nil, e
	}
	if t == nil || !t.IsActive {
		return nil, domain.NewError(domain.CodeNotFound, "table not found", 404, nil)
	}
	s, e := u.settingRepo.GetFirst(ctx)
	if e != nil {
		return nil, e
	}
	r := &MenuResult{IsOpen: true}
	if s != nil {
		r.CafeName = s.CafeName
		r.TaxPercent = s.TaxPercent
		r.IsOpen = s.IsOpen
	}
	cats, e := u.menuRepo.ListAvailableGroupedByCategory(ctx)
	if e != nil {
		return nil, e
	}
	for _, c := range cats {
		if len(c.Menus) == 0 {
			continue
		}
		x := MenuCategoryResult{ID: c.ID, Name: c.Name}
		for _, m := range c.Menus {
			x.Menus = append(x.Menus, MenuItemResult{m.ID, m.Name, m.Price, m.ImageURL})
		}
		r.Categories = append(r.Categories, x)
	}
	return r, nil
}
func (u *PublicUsecase) CreateOrder(ctx context.Context, token string, input []CreateOrderItem) (*CreateOrderResult, error) {
	t, e := u.tableRepo.GetByQRToken(ctx, token)
	if e != nil {
		return nil, e
	}
	if t == nil || !t.IsActive {
		return nil, domain.NewError(domain.CodeNotFound, "table not found", 404, nil)
	}
	s, e := u.settingRepo.GetFirst(ctx)
	if e != nil {
		return nil, e
	}
	if s != nil && !s.IsOpen {
		return nil, domain.NewError(domain.CodeStoreClosed, "store is currently closed", 409, nil)
	}
	if len(input) == 0 {
		return nil, domain.NewError(domain.CodeValidationError, "items is required", 400, nil)
	}
	ids := make([]uuid.UUID, len(input))
	for i := range input {
		ids[i] = input[i].MenuID
	}
	menus, e := u.menuRepo.ListAvailableByIDs(ctx, ids)
	if e != nil {
		return nil, e
	}
	byID := map[uuid.UUID]domain.Menu{}
	for _, m := range menus {
		byID[m.ID] = m
	}
	var sub int64
	items := make([]domain.OrderItem, len(input))
	for i, v := range input {
		m, ok := byID[v.MenuID]
		if !ok {
			return nil, domain.NewError(domain.CodeNotFound, "menu not found or unavailable", 404, nil)
		}
		sub += m.Price * int64(v.Qty)
		items[i] = domain.OrderItem{MenuID: m.ID, Qty: v.Qty, Note: v.Note, Price: m.Price, Status: domain.OrderItemStatusPending}
	}
	tax := float64(0)
	if s != nil {
		tax = s.TaxPercent
	}
	taxAmt := int64(math.Round(float64(sub) * tax / 100))
	raw := make([]byte, 32)
	if _, e = rand.Read(raw); e != nil {
		return nil, e
	}
	plain := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(plain))
	hash := hex.EncodeToString(sum[:])
	order := &domain.Order{TableID: &t.ID, OrderType: domain.OrderTypeQR, TrackingTokenHash: &hash, Status: domain.OrderStatusWaiting, SubtotalAmount: sub, TaxPercent: tax, TaxAmount: taxAmt, TotalAmount: sub + taxAmt, PaymentStatus: domain.PaymentStatusUnpaid}
	for i := range items {
		items[i].OrderID = order.ID
	}
	e = u.withTx(ctx, func(tx OrderTx) error {
		if e := tx.CreateOrder(ctx, order); e != nil {
			return e
		}
		for i := range items {
			items[i].OrderID = order.ID
		}
		if e := tx.CreateItems(ctx, items); e != nil {
			return e
		}
		return tx.ConsumeStock(ctx, items)
	})
	if e != nil {
		return nil, e
	}
	return &CreateOrderResult{Order: order, TrackingToken: plain, Items: mapItems(items)}, nil
}
func (u *PublicUsecase) OrderStatus(ctx context.Context, token string) (*OrderStatusResult, error) {
	sum := sha256.Sum256([]byte(token))
	o, e := u.orderRepo.GetByTrackingTokenHash(ctx, hex.EncodeToString(sum[:]))
	if e != nil {
		return nil, e
	}
	if o == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", 404, nil)
	}
	return &OrderStatusResult{o, mapItems(o.Items)}, nil
}
func mapItems(items []domain.OrderItem) []OrderItemResult {
	r := make([]OrderItemResult, 0, len(items))
	for _, i := range items {
		r = append(r, OrderItemResult{i.ID, i.Menu.Name, i.Qty, i.Price, i.Status, i.Note})
	}
	return r
}
func (u *PublicUsecase) CancelItem(ctx context.Context, token string, itemID uuid.UUID) (*OrderStatusResult, error) {
	sum := sha256.Sum256([]byte(token))
	order, err := u.orderRepo.GetByTrackingTokenHash(ctx, hex.EncodeToString(sum[:]))
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}
	var target *domain.OrderItem
	for i := range order.Items {
		if order.Items[i].ID == itemID {
			target = &order.Items[i]
			break
		}
	}
	if target == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order item not found", http.StatusNotFound, nil)
	}
	if target.Status != domain.OrderItemStatusPending {
		return nil, domain.NewError(domain.CodeInvalidTransition, "item cannot be cancelled", http.StatusConflict, nil)
	}
	refund := (*domain.Refund)(nil)
	if order.PaymentStatus == domain.PaymentStatusPaid {
		paymentMethod := domain.PaymentMethodCash
		if order.PaymentMethod != nil {
			paymentMethod = *order.PaymentMethod
		}
		subtotal := target.Price * int64(target.Qty)
		tax := int64(math.Round(float64(subtotal) * order.TaxPercent / 100))
		refund = &domain.Refund{Reason: "customer cancelled item", SubtotalAmount: subtotal, TaxAmount: tax, TotalAmount: subtotal + tax, PaymentMethod: paymentMethod}
		order.SubtotalAmount = maxInt64(0, order.SubtotalAmount-subtotal)
		order.TaxAmount = maxInt64(0, order.TaxAmount-tax)
		order.TotalAmount = maxInt64(0, order.TotalAmount-(subtotal+tax))
	}
	target.Status = domain.OrderItemStatusCancelled
	target.CancelledAt = timePtr(time.Now().UTC())
	active := false
	for _, item := range order.Items {
		if item.ID != itemID && item.Status != domain.OrderItemStatusCancelled {
			active = true
		}
	}
	if !active {
		order.Status = domain.OrderStatusCancelled
		order.SubtotalAmount, order.TaxAmount, order.TotalAmount = 0, 0, 0
	}
	if err := u.withTx(ctx, func(tx OrderTx) error { return tx.PersistCancel(ctx, order, itemID, refund) }); err != nil {
		return nil, err
	}
	return &OrderStatusResult{Order: order, Items: mapItems(order.Items)}, nil
}

func timePtr(v time.Time) *time.Time { return &v }
func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

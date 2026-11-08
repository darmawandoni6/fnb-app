package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

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

	order, items, err := buildOrder(ctx, u.menuRepo, u.settingRepo, input, domain.OrderTypeQR, &t.ID, nil)
	if err != nil {
		return nil, err
	}

	raw := make([]byte, 32)
	if _, e = rand.Read(raw); e != nil {
		return nil, e
	}
	plain := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(plain))
	hash := hex.EncodeToString(sum[:])
	order.TrackingTokenHash = &hash

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

	updated, err := cancelOrderItem(ctx, order, itemID, nil, "customer cancelled item", u.withTx)
	if err != nil {
		return nil, err
	}
	return &OrderStatusResult{Order: updated, Items: mapItems(updated.Items)}, nil
}

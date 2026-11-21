package usecase

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type PublicUsecase struct {
	tableRepo   domain.TableRepository
	menuRepo    domain.MenuRepository
	settingRepo domain.SettingRepository
	orderRepo   domain.OrderQueryRepository
	withTx      TxRunner
	publisher   domain.Publisher
	gateway     domain.SnapGateway
	logger      *slog.Logger
	loc         *time.Location
}

func NewPublicUsecase(
	t domain.TableRepository,
	m domain.MenuRepository,
	s domain.SettingRepository,
	o domain.OrderQueryRepository,
	withTx TxRunner,
	p domain.Publisher,
	gateway domain.SnapGateway,
	logger *slog.Logger,
	loc *time.Location,
) *PublicUsecase {
	if loc == nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	return &PublicUsecase{
		tableRepo:   t,
		menuRepo:    m,
		settingRepo: s,
		orderRepo:   o,
		withTx:      withTx,
		publisher:   p,
		gateway:     gateway,
		logger:      logger,
		loc:         loc,
	}
}

type MenuResult struct {
	CafeName    string
	ServiceRate float64
	TaxRate     float64
	IsOpen      bool
	Categories  []MenuCategoryResult
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

func (u *PublicUsecase) Menu(ctx context.Context, s *domain.TableSession) (*MenuResult, error) {
	setting, err := u.settingRepo.GetFirst(ctx)
	if err != nil {
		return nil, err
	}
	r := &MenuResult{IsOpen: true, ServiceRate: 5, TaxRate: 10}
	if setting != nil {
		r.CafeName = setting.CafeName
		r.ServiceRate = setting.ServiceRate
		r.TaxRate = setting.TaxRate
		r.IsOpen = setting.IsOpen
	}
	cats, err := u.menuRepo.ListAvailableGroupedByCategory(ctx)
	if err != nil {
		return nil, err
	}
	for _, c := range cats {
		if len(c.Menus) == 0 {
			continue
		}
		catResult := MenuCategoryResult{ID: c.ID, Name: c.Name}
		for _, m := range c.Menus {
			catResult.Menus = append(catResult.Menus, MenuItemResult{m.ID, m.Name, m.Price, m.ImageURL})
		}
		r.Categories = append(r.Categories, catResult)
	}
	return r, nil
}

func (u *PublicUsecase) CreateOrder(ctx context.Context, session *domain.TableSession, in OrderInput) (*domain.Order, error) {
	order, items, err := buildOrder(ctx, u.menuRepo, u.settingRepo, in, domain.OrderTypeDineIn, &session.TableID, &session.ID, nil)
	if err != nil {
		return nil, err
	}

	day := time.Now().In(u.loc)
	statusStr := string(order.Status)

	err = u.withTx(ctx, func(tx OrderTx) error {
		num, err := tx.NextOrderNumber(ctx, order.OrderType, day)
		if err != nil {
			return err
		}
		order.OrderNumber = num

		if err := tx.CreateOrder(ctx, order); err != nil {
			return err
		}
		for i := range items {
			items[i].OrderID = order.ID
		}
		if err := tx.CreateItems(ctx, items); err != nil {
			return err
		}
		if err := tx.ConsumeStock(ctx, order, items); err != nil {
			return err
		}
		if err := tx.UpdateAggregate(ctx, order.ID, domain.OrderStatusWaiting); err != nil {
			return err
		}
		audit := &domain.AuditLog{
			Entity:   "order",
			EntityID: order.ID,
			Action:   "order_created",
			ToValue:  &statusStr,
		}
		if err := tx.Audit(ctx, audit); err != nil {
			return err
		}
		if log := pendingPaymentLog(order); log != nil {
			return tx.CreatePaymentLog(ctx, log)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	order.Items = items
	order.Table = &session.Table
	order.TableSession = session
	attachSnap(ctx, u.gateway, order, items, u.logger)

	if u.publisher != nil {
		u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: "order.created", Order: order})
		if session.SessionToken != "" {
			u.publisher.PublishSession(ctx, session.SessionToken, domain.OrderEvent{Event: "order.created", Order: order})
		}
	}

	return order, nil
}

func (u *PublicUsecase) ListOrders(ctx context.Context, session *domain.TableSession) ([]domain.Order, error) {
	filter := domain.OrderFilter{
		SessionID: &session.ID,
	}
	return u.orderRepo.List(ctx, filter)
}

func (u *PublicUsecase) GetOrder(ctx context.Context, session *domain.TableSession, id uuid.UUID) (*domain.Order, error) {
	order, err := u.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order == nil || order.TableSessionID == nil || *order.TableSessionID != session.ID {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}
	return order, nil
}

func (u *PublicUsecase) CancelOrder(ctx context.Context, session *domain.TableSession, id uuid.UUID, reason string) (*domain.Order, error) {
	order, err := u.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order == nil || order.TableSessionID == nil || *order.TableSessionID != session.ID {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}

	return cancelOrderHelper(ctx, u.orderRepo, u.withTx, u.publisher, id, reason, nil, nil)
}

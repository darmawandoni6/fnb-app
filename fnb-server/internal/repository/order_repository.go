package repository

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrderRepository struct{ db *gorm.DB }

func NewOrderRepository(db *gorm.DB) *OrderRepository { return &OrderRepository{db: db} }

func (r *OrderRepository) NextOrderNumber(ctx context.Context, t domain.OrderType, day time.Time) (string, error) {
	var seq int
	err := r.db.WithContext(ctx).Raw(`
		INSERT INTO order_sequence (order_type, date, last_seq)
		VALUES (?, ?, 1)
		ON CONFLICT (order_type, date)
		DO UPDATE SET last_seq = order_sequence.last_seq + 1
		RETURNING last_seq`, t, day.Format("2006-01-02")).Scan(&seq).Error
	if err != nil {
		return "", fmt.Errorf("next order sequence: %w", err)
	}
	return domain.FormatOrderNumber(t, day, seq), nil
}

func (r *OrderRepository) CreateOrder(ctx context.Context, order *domain.Order) error {
	return r.db.WithContext(ctx).Create(order).Error
}

func (r *OrderRepository) CreateItems(ctx context.Context, items []domain.OrderItem) error {
	return r.db.WithContext(ctx).Create(&items).Error
}

func (r *OrderRepository) ConsumeStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error {
	orderNote := "order " + order.OrderNumber
	for _, item := range items {
		var recipes []domain.RecipeItem
		if err := r.db.WithContext(ctx).Where("menu_id = ?", item.MenuID).Find(&recipes).Error; err != nil {
			return err
		}
		for _, recipe := range recipes {
			var ingredient domain.Ingredient
			if err := r.db.WithContext(ctx).Clauses(clauseLocking()).First(&ingredient, "id = ?", recipe.IngredientID).Error; err != nil {
				return err
			}
			demand := recipe.QtyUsed * float64(item.Qty)
			if ingredient.StockQty < demand {
				return domain.NewError(domain.CodeStockNotEnough, "insufficient stock", http.StatusConflict, nil)
			}
			if err := r.db.WithContext(ctx).Model(&ingredient).Update("stock_qty", ingredient.StockQty-demand).Error; err != nil {
				return err
			}
			orderID, itemID := order.ID, item.ID
			movement := domain.StockMovement{
				IngredientID: ingredient.ID,
				OrderID:      &orderID,
				OrderItemID:  &itemID,
				Qty:          -demand,
				Type:         domain.StockMovementOut,
				Note:         &orderNote,
			}
			if err := r.db.WithContext(ctx).Create(&movement).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *OrderRepository) RestoreStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error {
	cancelNote := "cancel order " + order.OrderNumber
	for _, item := range items {
		var recipes []domain.RecipeItem
		if err := r.db.WithContext(ctx).Where("menu_id = ?", item.MenuID).Find(&recipes).Error; err != nil {
			return err
		}
		for _, recipe := range recipes {
			var ingredient domain.Ingredient
			if err := r.db.WithContext(ctx).Clauses(clauseLocking()).First(&ingredient, "id = ?", recipe.IngredientID).Error; err != nil {
				return err
			}
			demand := recipe.QtyUsed * float64(item.Qty)
			if err := r.db.WithContext(ctx).Model(&ingredient).Update("stock_qty", ingredient.StockQty+demand).Error; err != nil {
				return err
			}
			orderID, itemID := order.ID, item.ID
			movement := domain.StockMovement{
				IngredientID: recipe.IngredientID,
				OrderID:      &orderID,
				OrderItemID:  &itemID,
				Qty:          demand,
				Type:         domain.StockMovementRestore,
				Note:         &cancelNote,
			}
			if err := r.db.WithContext(ctx).Create(&movement).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *OrderRepository) SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus, actor *uuid.UUID) error {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"status":     to,
		"updated_by": actor,
	}
	if to == domain.OrderItemStatusReady {
		updates["ready_at"] = now
	}
	if to == domain.OrderItemStatusDelivered {
		updates["delivered_at"] = now
	}
	if to == domain.OrderItemStatusCompleted {
		updates["completed_at"] = now
	}

	res := r.db.WithContext(ctx).Model(&domain.OrderItem{}).
		Where("id = ? AND order_id = ? AND status = ?", itemID, orderID, from).
		Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		var current domain.OrderItem
		if err := r.db.WithContext(ctx).First(&current, "id = ? AND order_id = ?", itemID, orderID).Error; err != nil {
			return err
		}
		if current.Status == to {
			return nil
		}
		return domain.NewError(domain.CodeInvalidTransition, "invalid item transition", http.StatusConflict, nil)
	}
	return nil
}

func (r *OrderRepository) CancelOrder(ctx context.Context, orderID uuid.UUID, reason string, actor *uuid.UUID) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Model(&domain.OrderItem{}).
		Where("order_id = ?", orderID).
		Updates(map[string]interface{}{
			"status":       domain.OrderItemStatusCancelled,
			"cancelled_at": now,
			"updated_by":   actor,
		}).Error; err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&domain.Order{}).
		Where("id = ?", orderID).
		Updates(map[string]interface{}{
			"status":        domain.OrderStatusCancelled,
			"cancel_reason": reason,
			"canceled_at":   now,
			"updated_at":    now,
		}).Error
}

func (r *OrderRepository) UpdateAggregate(ctx context.Context, orderID uuid.UUID, status domain.OrderStatus) error {
	return r.db.WithContext(ctx).Model(&domain.Order{}).Where("id = ?", orderID).Updates(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now().UTC(),
	}).Error
}

func (r *OrderRepository) Audit(ctx context.Context, entry *domain.AuditLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}

func (r *OrderRepository) SaveSetting(ctx context.Context, setting *domain.Setting) error {
	return r.db.WithContext(ctx).Save(setting).Error
}

func (r *OrderRepository) List(ctx context.Context, filter domain.OrderFilter) ([]domain.Order, error) {
	query := r.db.WithContext(ctx).Model(&domain.Order{}).
		Preload("Items.Menu").
		Preload("Table").
		Preload("TableSession")

	if filter.PaidOnly {
		query = query.Where("payment_status = ?", domain.PaymentStatusPaid)
	}
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}
	if filter.TableID != nil {
		query = query.Where("table_id = ?", *filter.TableID)
	}
	if filter.SessionID != nil {
		query = query.Where("table_session_id = ?", *filter.SessionID)
	}
	if filter.OrderType != nil {
		query = query.Where("order_type = ?", *filter.OrderType)
	}
	if filter.PaymentMethod != nil {
		query = query.Where("payment_method = ?", *filter.PaymentMethod)
	}
	if filter.From != nil {
		query = query.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("created_at < ?", *filter.To)
	}
	if filter.Date != nil {
		loc := filter.DateLoc
		if loc == nil {
			loc = time.UTC
		}
		d := filter.Date.In(loc)
		start := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, loc)
		end := start.Add(24 * time.Hour)
		query = query.Where("created_at >= ? AND created_at < ?", start, end)
	}

	var orders []domain.Order
	if err := query.Order("created_at DESC").Limit(200).Find(&orders).Error; err != nil {
		return nil, fmt.Errorf("list orders: %w", err)
	}
	return orders, nil
}

func (r *OrderRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	var order domain.Order
	err := r.db.WithContext(ctx).
		Preload("Items.Menu").
		Preload("Table").
		Preload("TableSession").
		First(&order, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get order by id: %w", err)
	}
	return &order, nil
}

func (r *OrderRepository) GetByOrderNumber(ctx context.Context, orderNumber string) (*domain.Order, error) {
	var order domain.Order
	err := r.db.WithContext(ctx).
		Preload("Items.Menu").
		Preload("Table").
		Preload("TableSession").
		First(&order, "order_number = ?", orderNumber).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get order by order number: %w", err)
	}
	return &order, nil
}

func (r *OrderRepository) SetPaid(ctx context.Context, orderID uuid.UUID, method domain.PaymentMethod, ref *string, paidAt time.Time, amountReceived, changeAmount *int64) error {
	updates := map[string]interface{}{
		"payment_status":  domain.PaymentStatusPaid,
		"payment_method":  method,
		"payment_ref":     ref,
		"paid_at":         paidAt,
		"amount_received": amountReceived,
		"change_amount":   changeAmount,
		"updated_at":      time.Now().UTC(),
	}
	return r.db.WithContext(ctx).Model(&domain.Order{}).Where("id = ?", orderID).Updates(updates).Error
}

func (r *OrderRepository) CreatePaymentLog(ctx context.Context, log *domain.PaymentLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *OrderRepository) GetPendingPaymentLog(ctx context.Context, orderID uuid.UUID) (*domain.PaymentLog, error) {
	var log domain.PaymentLog
	err := r.db.WithContext(ctx).First(&log, "order_id = ? AND status = ?", orderID, domain.PaymentLogStatusPending).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *OrderRepository) GetPaymentLogByGatewayRef(ctx context.Context, ref string) (*domain.PaymentLog, error) {
	var log domain.PaymentLog
	err := r.db.WithContext(ctx).First(&log, "gateway_ref = ?", ref).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *OrderRepository) UpdatePaymentLogStatus(ctx context.Context, id uuid.UUID, status domain.PaymentLogStatus, gatewayStatus *string, gatewayRef *string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if gatewayStatus != nil {
		updates["gateway_status"] = *gatewayStatus
	}
	if gatewayRef != nil {
		updates["gateway_ref"] = *gatewayRef
	}
	return r.db.WithContext(ctx).Model(&domain.PaymentLog{}).Where("id = ?", id).Updates(updates).Error
}

func clauseLocking() clause.Expression { return clause.Locking{Strength: "UPDATE"} }

func (r *OrderRepository) ListCashTimeoutIDs(ctx context.Context, q domain.CashTimeoutQuery) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.WithContext(ctx).Model(&domain.Order{}).
		Where("payment_status = ? AND canceled_at IS NULL AND payment_method = ? AND created_at < ?",
			domain.PaymentStatusUnpaid, domain.PaymentMethodCash, q.Cutoff).
		Order("created_at").
		Limit(q.Limit).
		Pluck("id", &ids).Error
	if err != nil {
		return nil, fmt.Errorf("list cash timeout orders: %w", err)
	}
	return ids, nil
}

func (r *OrderRepository) ListItemMoves(ctx context.Context, q domain.ItemMoveQuery) ([]domain.ItemMove, error) {
	column := "ready_at"
	if q.From == domain.OrderItemStatusDelivered {
		column = "delivered_at"
	}

	query := r.db.WithContext(ctx).Model(&domain.OrderItem{}).Where("status = ? AND "+column+" IS NOT NULL", q.From)
	if q.Since != nil {
		query = query.Where(column+" >= ?", *q.Since)
	}
	if q.Until != nil {
		query = query.Where(column+" < ?", *q.Until)
	}

	var items []domain.OrderItem
	if err := query.Order(column).Limit(q.Limit).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list item moves: %w", err)
	}

	moves := make([]domain.ItemMove, 0, len(items))
	for _, it := range items {
		moves = append(moves, domain.ItemMove{
			OrderID: it.OrderID,
			ItemID:  it.ID,
			From:    it.Status,
		})
	}
	return moves, nil
}

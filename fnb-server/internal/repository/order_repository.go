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

func (r *OrderRepository) GetByTrackingTokenHash(ctx context.Context, hash string) (*domain.Order, error) {
	var order domain.Order
	err := r.db.WithContext(ctx).Preload("Items.Menu").Preload("Table").First(&order, "tracking_token_hash = ?", hash).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get order by tracking token: %w", err)
	}
	return &order, nil
}

func (r *OrderRepository) CreateOrder(ctx context.Context, order *domain.Order) error {
	return r.db.WithContext(ctx).Create(order).Error
}
func (r *OrderRepository) CreateItems(ctx context.Context, items []domain.OrderItem) error {
	return r.db.WithContext(ctx).Create(&items).Error
}

func (r *OrderRepository) ConsumeStock(ctx context.Context, items []domain.OrderItem) error {
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
			id, orderID := item.ID, item.OrderID
			movement := domain.StockMovement{IngredientID: ingredient.ID, OrderID: &orderID, OrderItemID: &id, Qty: -demand, Type: domain.StockMovementOut}
			if err := r.db.WithContext(ctx).Create(&movement).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *OrderRepository) PersistCancel(ctx context.Context, order *domain.Order, itemID uuid.UUID, refund *domain.Refund) error {
	var item domain.OrderItem
	if err := r.db.WithContext(ctx).Clauses(clauseLocking()).First(&item, "id = ? AND order_id = ?", itemID, order.ID).Error; err != nil {
		return err
	}
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Model(&item).Updates(map[string]interface{}{"status": domain.OrderItemStatusCancelled, "cancelled_at": now}).Error; err != nil {
		return err
	}
	var recipes []domain.RecipeItem
	if err := r.db.WithContext(ctx).Where("menu_id = ?", item.MenuID).Find(&recipes).Error; err != nil {
		return err
	}
	for _, recipe := range recipes {
		demand := recipe.QtyUsed * float64(item.Qty)
		if err := r.db.WithContext(ctx).Model(&domain.Ingredient{}).Where("id = ?", recipe.IngredientID).UpdateColumn("stock_qty", gorm.Expr("stock_qty + ?", demand)).Error; err != nil {
			return err
		}
		orderID, itemID := item.OrderID, item.ID
		movement := domain.StockMovement{IngredientID: recipe.IngredientID, OrderID: &orderID, OrderItemID: &itemID, Qty: demand, Type: domain.StockMovementRestore}
		if err := r.db.WithContext(ctx).Create(&movement).Error; err != nil {
			return err
		}
	}
	if refund != nil {
		refund.OrderID = order.ID
		if err := r.db.WithContext(ctx).Create(refund).Error; err != nil {
			return err
		}
		refundItem := domain.RefundItem{RefundID: refund.ID, OrderItemID: item.ID, Qty: item.Qty, SubtotalAmount: refund.SubtotalAmount, TaxAmount: refund.TaxAmount, TotalAmount: refund.TotalAmount}
		if err := r.db.WithContext(ctx).Create(&refundItem).Error; err != nil {
			return err
		}
	}
	updates := map[string]interface{}{"status": order.Status, "subtotal_amount": order.SubtotalAmount, "tax_amount": order.TaxAmount, "total_amount": order.TotalAmount}
	return r.db.WithContext(ctx).Model(&domain.Order{}).Where("id = ?", order.ID).Updates(updates).Error
}

func clauseLocking() clause.Expression { return clause.Locking{Strength: "UPDATE"} }

package repository

import (
	"context"
	"fmt"

	"fnb-server/internal/domain"
	"gorm.io/gorm"
)

type ReportRepository struct{ db *gorm.DB }

func NewReportRepository(db *gorm.DB) *ReportRepository { return &ReportRepository{db: db} }

// paidOnly is the aggregate scope: paid orders that were not canceled.
const paidOnly = `o.payment_status = 'LUNAS' AND o.status <> 'DIBATALKAN'`

// inRange narrows to the half-open [from, to) window; two placeholders.
const inRange = `o.created_at >= ? AND o.created_at < ?`

func (r *ReportRepository) ListSummary(ctx context.Context, f domain.ReportFilter) (*domain.SalesReportSummary, error) {
	var s domain.SalesReportSummary
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			COALESCE(SUM(o.total_amount), 0) AS total_revenue,
			COUNT(*) AS total_orders,
			COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_method = 'CASH'), 0) AS cash_revenue,
			COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_method = 'NON_CASH'), 0) AS non_cash_revenue,
			COUNT(*) FILTER (WHERE o.order_type = 'DINE_IN') AS dine_in_orders_count,
			COUNT(*) FILTER (WHERE o.order_type = 'TAKE_AWAY') AS take_away_orders_count,
			(
				SELECT COALESCE(SUM(oi.qty), 0)
				FROM order_items oi JOIN orders o ON o.id = oi.order_id
				WHERE `+paidOnly+` AND `+inRange+`
			) AS total_items_sold
		FROM orders o
		WHERE `+paidOnly+` AND `+inRange,
		f.From, f.To, f.From, f.To).Scan(&s).Error
	if err != nil {
		return nil, fmt.Errorf("report summary: %w", err)
	}
	if s.TotalOrders > 0 {
		// Half-up rounding, matching the dashboard mock.
		s.AverageOrderValue = (s.TotalRevenue + s.TotalOrders/2) / s.TotalOrders
	}
	return &s, nil
}

func (r *ReportRepository) ListTrends(ctx context.Context, f domain.ReportFilter) ([]domain.DailySalesTrend, error) {
	var rows []domain.DailySalesTrend
	err := r.db.WithContext(ctx).Raw(`
		SELECT days.d::text AS date,
			COALESCE(SUM(o.total_amount), 0) AS revenue,
			COUNT(o.id) AS order_count
		FROM (SELECT generate_series(?::date, ?::date - 1, '1 day')::date AS d) days
		LEFT JOIN orders o
			ON o.created_at >= days.d::timestamptz
			AND o.created_at < (days.d + 1)::timestamptz
			AND `+paidOnly+`
		GROUP BY days.d
		ORDER BY days.d`,
		f.From.Format("2006-01-02"), f.To.Format("2006-01-02")).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("report trends: %w", err)
	}
	return rows, nil
}

func (r *ReportRepository) ListTopMenus(ctx context.Context, f domain.ReportFilter, limit int) ([]domain.TopSellingMenuItem, error) {
	var rows []domain.TopSellingMenuItem
	err := r.db.WithContext(ctx).Raw(`
		SELECT oi.menu_id::text AS menu_id,
			MAX(oi.menu_name_snapshot) AS menu_name,
			COALESCE(MAX(mc.name), 'Other') AS category_name,
			SUM(oi.qty) AS qty_sold,
			SUM(oi.qty * oi.price) AS total_revenue
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		LEFT JOIN menus m ON m.id = oi.menu_id
		LEFT JOIN menu_categories mc ON mc.id = m.category_id
		WHERE `+paidOnly+` AND `+inRange+`
		GROUP BY oi.menu_id
		ORDER BY qty_sold DESC, menu_name
		LIMIT ?`,
		f.From, f.To, limit).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("report top menus: %w", err)
	}
	return rows, nil
}

func (r *ReportRepository) ListCategorySales(ctx context.Context, f domain.ReportFilter) ([]domain.CategorySalesShare, error) {
	var rows []domain.CategorySalesShare
	// Every category is listed, including zero-revenue ones; the FILTER drops
	// order_items rows whose order left the paid range.
	err := r.db.WithContext(ctx).Raw(`
		SELECT mc.id::text AS category_id,
			mc.name AS category_name,
			COALESCE(SUM(oi.qty * oi.price) FILTER (WHERE o.id IS NOT NULL), 0) AS total_revenue,
			COALESCE(SUM(oi.qty) FILTER (WHERE o.id IS NOT NULL), 0) AS total_items_sold
		FROM menu_categories mc
		LEFT JOIN menus m ON m.category_id = mc.id
		LEFT JOIN order_items oi ON oi.menu_id = m.id
		LEFT JOIN orders o ON o.id = oi.order_id AND `+paidOnly+` AND `+inRange+`
		GROUP BY mc.id, mc.name
		ORDER BY total_revenue DESC, mc.name`,
		f.From, f.To).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("report categories: %w", err)
	}
	var grand int64
	for i := range rows {
		grand += rows[i].TotalRevenue
	}
	if grand > 0 {
		for i := range rows {
			// Half-up rounding of the revenue share as a percentage.
			rows[i].Percentage = (rows[i].TotalRevenue*100 + grand/2) / grand
		}
	}
	return rows, nil
}

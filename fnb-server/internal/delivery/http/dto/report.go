package dto

import "fnb-server/internal/usecase"

type SalesReportSummaryResponse struct {
	TotalRevenue        int64 `json:"total_revenue"`
	TotalOrders         int64 `json:"total_orders"`
	AverageOrderValue   int64 `json:"average_order_value"`
	CashRevenue         int64 `json:"cash_revenue"`
	NonCashRevenue      int64 `json:"non_cash_revenue"`
	DineInOrdersCount   int64 `json:"dine_in_orders_count"`
	TakeAwayOrdersCount int64 `json:"take_away_orders_count"`
	TotalItemsSold      int64 `json:"total_items_sold"`
}

type DailySalesTrendResponse struct {
	Date       string `json:"date"`
	Revenue    int64  `json:"revenue"`
	OrderCount int64  `json:"order_count"`
}

type TopSellingMenuItemResponse struct {
	MenuID       string `json:"menu_id"`
	MenuName     string `json:"menu_name"`
	CategoryName string `json:"category_name"`
	QtySold      int64  `json:"qty_sold"`
	TotalRevenue int64  `json:"total_revenue"`
}

type CategorySalesShareResponse struct {
	CategoryID     string `json:"category_id"`
	CategoryName   string `json:"category_name"`
	TotalRevenue   int64  `json:"total_revenue"`
	TotalItemsSold int64  `json:"total_items_sold"`
	Percentage     int64  `json:"percentage"`
}

type ReportSummaryResponse struct {
	Summary    SalesReportSummaryResponse   `json:"summary"`
	Trends     []DailySalesTrendResponse    `json:"trends"`
	TopMenus   []TopSellingMenuItemResponse `json:"top_menus"`
	Categories []CategorySalesShareResponse `json:"categories"`
}

func ReportSummaryResponseFrom(r *usecase.SummaryResult) ReportSummaryResponse {
	out := ReportSummaryResponse{
		Summary: SalesReportSummaryResponse{
			TotalRevenue:        r.Summary.TotalRevenue,
			TotalOrders:         r.Summary.TotalOrders,
			AverageOrderValue:   r.Summary.AverageOrderValue,
			CashRevenue:         r.Summary.CashRevenue,
			NonCashRevenue:      r.Summary.NonCashRevenue,
			DineInOrdersCount:   r.Summary.DineInOrdersCount,
			TakeAwayOrdersCount: r.Summary.TakeAwayOrdersCount,
			TotalItemsSold:      r.Summary.TotalItemsSold,
		},
		Trends:     make([]DailySalesTrendResponse, 0, len(r.Trends)),
		TopMenus:   make([]TopSellingMenuItemResponse, 0, len(r.TopMenus)),
		Categories: make([]CategorySalesShareResponse, 0, len(r.Categories)),
	}
	for _, v := range r.Trends {
		out.Trends = append(out.Trends, DailySalesTrendResponse{Date: v.Date, Revenue: v.Revenue, OrderCount: v.OrderCount})
	}
	for _, v := range r.TopMenus {
		out.TopMenus = append(out.TopMenus, TopSellingMenuItemResponse{
			MenuID: v.MenuID, MenuName: v.MenuName, CategoryName: v.CategoryName, QtySold: v.QtySold, TotalRevenue: v.TotalRevenue,
		})
	}
	for _, v := range r.Categories {
		out.Categories = append(out.Categories, CategorySalesShareResponse{
			CategoryID: v.CategoryID, CategoryName: v.CategoryName, TotalRevenue: v.TotalRevenue, TotalItemsSold: v.TotalItemsSold, Percentage: v.Percentage,
		})
	}
	return out
}

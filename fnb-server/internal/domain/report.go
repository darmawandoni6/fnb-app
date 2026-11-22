package domain

import (
	"context"
	"time"
)

// ReportFilter is the inclusive UTC day range for a report query.
type ReportFilter struct {
	From time.Time
	To   time.Time
}

type SalesReportSummary struct {
	TotalRevenue        int64
	TotalOrders         int64
	AverageOrderValue   int64
	CashRevenue         int64
	NonCashRevenue      int64
	DineInOrdersCount   int64
	TakeAwayOrdersCount int64
	TotalItemsSold      int64
}

type DailySalesTrend struct {
	Date       string
	Revenue    int64
	OrderCount int64
}

type TopSellingMenuItem struct {
	MenuID       string
	MenuName     string
	CategoryName string
	QtySold      int64
	TotalRevenue int64
}

type CategorySalesShare struct {
	CategoryID     string
	CategoryName   string
	TotalRevenue   int64
	TotalItemsSold int64
	Percentage     int64
}

type ReportRepository interface {
	ListSummary(ctx context.Context, f ReportFilter) (*SalesReportSummary, error)
	ListTrends(ctx context.Context, f ReportFilter) ([]DailySalesTrend, error)
	ListTopMenus(ctx context.Context, f ReportFilter, limit int) ([]TopSellingMenuItem, error)
	ListCategorySales(ctx context.Context, f ReportFilter) ([]CategorySalesShare, error)
}

package usecase

import (
	"context"
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"golang.org/x/sync/errgroup"
)

const (
	reportTopMenuLimit = 10
	maxReportSpanDays  = 366
)

type ReportUsecase struct {
	reports domain.ReportRepository
	orders  domain.OrderQueryRepository
}

func NewReportUsecase(reports domain.ReportRepository, orders domain.OrderQueryRepository) *ReportUsecase {
	return &ReportUsecase{reports: reports, orders: orders}
}

type SummaryResult struct {
	Summary    *domain.SalesReportSummary
	Trends     []domain.DailySalesTrend
	TopMenus   []domain.TopSellingMenuItem
	Categories []domain.CategorySalesShare
}

func validateReportRange(from, to time.Time) error {
	// to is exclusive, so a single day still spans 24h.
	if !to.After(from) {
		return domain.NewError(domain.CodeValidationError, "from must not be after to", http.StatusBadRequest, nil)
	}
	if to.Sub(from) > maxReportSpanDays*24*time.Hour {
		return domain.NewError(domain.CodeValidationError, "report range exceeds 366 days", http.StatusBadRequest, nil)
	}
	return nil
}

func (u *ReportUsecase) Summary(ctx context.Context, f domain.ReportFilter) (*SummaryResult, error) {
	if err := validateReportRange(f.From, f.To); err != nil {
		return nil, err
	}

	var out SummaryResult
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error { var err error; out.Summary, err = u.reports.ListSummary(gctx, f); return err })
	g.Go(func() error { var err error; out.Trends, err = u.reports.ListTrends(gctx, f); return err })
	g.Go(func() error {
		var err error
		out.TopMenus, err = u.reports.ListTopMenus(gctx, f, reportTopMenuLimit)
		return err
	})
	g.Go(func() error { var err error; out.Categories, err = u.reports.ListCategorySales(gctx, f); return err })
	if err := g.Wait(); err != nil {
		return nil, err
	}
	if out.Summary == nil {
		out.Summary = &domain.SalesReportSummary{}
	}
	return &out, nil
}

func (u *ReportUsecase) Transactions(ctx context.Context, filter domain.OrderFilter) ([]domain.Order, error) {
	if filter.From == nil || filter.To == nil {
		return nil, domain.NewError(domain.CodeValidationError, "from and to are required", http.StatusBadRequest, nil)
	}
	if err := validateReportRange(*filter.From, *filter.To); err != nil {
		return nil, err
	}
	return u.orders.List(ctx, filter)
}

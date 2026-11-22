package http

import (
	"net/http"
	"time"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/labstack/echo/v4"
)

type ReportHandler struct {
	reports *usecase.ReportUsecase
}

func NewReportHandler(r *usecase.ReportUsecase) *ReportHandler {
	return &ReportHandler{reports: r}
}

// reportRange reads the required from/to day range and returns a half-open window.
func reportRange(c echo.Context) (domain.ReportFilter, error) {
	rawFrom, rawTo := c.QueryParam("from"), c.QueryParam("to")
	if rawFrom == "" || rawTo == "" {
		return domain.ReportFilter{}, domain.NewError(domain.CodeValidationError, "from and to are required (YYYY-MM-DD)", http.StatusBadRequest, nil)
	}
	from, err := time.Parse("2006-01-02", rawFrom)
	if err != nil {
		return domain.ReportFilter{}, domain.NewError(domain.CodeValidationError, "invalid from date (expected YYYY-MM-DD)", http.StatusBadRequest, nil)
	}
	to, err := time.Parse("2006-01-02", rawTo)
	if err != nil {
		return domain.ReportFilter{}, domain.NewError(domain.CodeValidationError, "invalid to date (expected YYYY-MM-DD)", http.StatusBadRequest, nil)
	}
	if to.Before(from) {
		return domain.ReportFilter{}, domain.NewError(domain.CodeValidationError, "from must not be after to", http.StatusBadRequest, nil)
	}
	return domain.ReportFilter{From: from.UTC(), To: to.UTC().Add(24 * time.Hour)}, nil
}

func (h *ReportHandler) Summary(c echo.Context) error {
	f, err := reportRange(c)
	if err != nil {
		return err
	}
	result, err := h.reports.Summary(c.Request().Context(), f)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.ReportSummaryResponseFrom(result))
}

func (h *ReportHandler) Transactions(c echo.Context) error {
	f, err := reportRange(c)
	if err != nil {
		return err
	}
	filter := domain.OrderFilter{From: &f.From, To: &f.To}
	if v := c.QueryParam("order_type"); v != "" && v != "ALL" {
		orderType := domain.OrderType(v)
		if !orderType.Valid() {
			return domain.NewError(domain.CodeValidationError, "invalid order_type filter", http.StatusBadRequest, nil)
		}
		filter.OrderType = &orderType
	}
	if v := c.QueryParam("payment_method"); v != "" && v != "ALL" {
		method := domain.PaymentMethod(v)
		if !method.Valid() {
			return domain.NewError(domain.CodeValidationError, "invalid payment_method filter", http.StatusBadRequest, nil)
		}
		filter.PaymentMethod = &method
	}

	orders, err := h.reports.Transactions(c.Request().Context(), filter)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.OrderListResponseFrom(orders))
}

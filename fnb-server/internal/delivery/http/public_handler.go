package http

import (
	"net/http"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type PublicHandler struct {
	publicUsecase       *usecase.PublicUsecase
	tableSessionUsecase *usecase.TableSessionUsecase
}

func NewPublicHandler(u *usecase.PublicUsecase, sessionUsecase *usecase.TableSessionUsecase) *PublicHandler {
	return &PublicHandler{publicUsecase: u, tableSessionUsecase: sessionUsecase}
}

func (h *PublicHandler) OpenSession(c echo.Context) error {
	qrToken := c.Param("qr_token")
	session, err := h.tableSessionUsecase.Open(c.Request().Context(), qrToken)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.OpenSessionResponse{
		SessionToken: session.SessionToken,
		TableNumber:  session.Table.TableNumber,
		Status:       string(session.Status),
	})
}

func (h *PublicHandler) Menu(c echo.Context) error {
	session, ok := GetTableSession(c)
	if !ok {
		return domain.NewError(domain.CodeUnauthorized, "missing table session", http.StatusUnauthorized, nil)
	}
	r, err := h.publicUsecase.Menu(c.Request().Context(), session)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.MenuResponseFrom(r))
}

func (h *PublicHandler) CreateOrder(c echo.Context) error {
	session, ok := GetTableSession(c)
	if !ok {
		return domain.NewError(domain.CodeUnauthorized, "missing table session", http.StatusUnauthorized, nil)
	}

	var req dto.CreateOrderRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	items := make([]usecase.CreateOrderItem, 0, len(req.Items))
	for _, it := range req.Items {
		mid, err := uuid.Parse(it.MenuID)
		if err != nil {
			return domain.NewError(domain.CodeValidationError, "invalid menu_id in items", http.StatusBadRequest, nil)
		}
		items = append(items, usecase.CreateOrderItem{
			MenuID: mid,
			Qty:    it.Qty,
			Note:   it.Note,
		})
	}

	in := usecase.OrderInput{
		CustomerName:  req.CustomerName,
		CustomerPhone: req.CustomerPhone,
		PaymentMethod: domain.PaymentMethod(req.PaymentMethod),
		Items:         items,
	}

	order, err := h.publicUsecase.CreateOrder(c.Request().Context(), session, in)
	if err != nil {
		return err
	}
	return Success(c, http.StatusCreated, dto.PublicOrderResponseFrom(order))
}

func (h *PublicHandler) ListOrders(c echo.Context) error {
	session, ok := GetTableSession(c)
	if !ok {
		return domain.NewError(domain.CodeUnauthorized, "missing table session", http.StatusUnauthorized, nil)
	}

	orders, err := h.publicUsecase.ListOrders(c.Request().Context(), session)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.PublicOrderListResponseFrom(orders))
}

func (h *PublicHandler) GetOrder(c echo.Context) error {
	session, ok := GetTableSession(c)
	if !ok {
		return domain.NewError(domain.CodeUnauthorized, "missing table session", http.StatusUnauthorized, nil)
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid order id", http.StatusBadRequest, nil)
	}

	order, err := h.publicUsecase.GetOrder(c.Request().Context(), session, id)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.PublicOrderResponseFrom(order))
}

func (h *PublicHandler) CancelOrder(c echo.Context) error {
	session, ok := GetTableSession(c)
	if !ok {
		return domain.NewError(domain.CodeUnauthorized, "missing table session", http.StatusUnauthorized, nil)
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid order id", http.StatusBadRequest, nil)
	}

	var req dto.CancelOrderRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	order, err := h.publicUsecase.CancelOrder(c.Request().Context(), session, id, req.Reason)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.PublicOrderResponseFrom(order))
}

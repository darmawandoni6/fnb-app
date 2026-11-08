package http

import (
	"net/http"
	"time"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type OrderHandler struct {
	orderUsecase *usecase.OrderUsecase
}

func NewOrderHandler(orderUsecase *usecase.OrderUsecase) *OrderHandler {
	return &OrderHandler{orderUsecase: orderUsecase}
}

func (h *OrderHandler) List(c echo.Context) error {
	role, _ := GetCurrentUserRole(c)

	filter := domain.OrderFilter{}
	if s := c.QueryParam("status"); s != "" {
		st := domain.OrderStatus(s)
		if !st.Valid() {
			return domain.NewError(domain.CodeValidationError, "invalid order status filter", http.StatusBadRequest, nil)
		}
		filter.Status = &st
	}
	if tid := c.QueryParam("table_id"); tid != "" {
		parsed, err := uuid.Parse(tid)
		if err != nil {
			return domain.NewError(domain.CodeValidationError, "invalid table_id", http.StatusBadRequest, nil)
		}
		filter.TableID = &parsed
	}
	if d := c.QueryParam("date"); d != "" {
		t, err := time.Parse("2006-01-02", d)
		if err != nil {
			return domain.NewError(domain.CodeValidationError, "invalid date format (expected YYYY-MM-DD)", http.StatusBadRequest, nil)
		}
		filter.Date = &t
	}

	orders, err := h.orderUsecase.List(c.Request().Context(), filter, role)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.OrderListResponseFrom(orders))
}

func (h *OrderHandler) Get(c echo.Context) error {
	role, _ := GetCurrentUserRole(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid order id", http.StatusBadRequest, nil)
	}

	order, err := h.orderUsecase.Get(c.Request().Context(), id, role)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.OrderResponseFrom(order))
}

func (h *OrderHandler) CreateManual(c echo.Context) error {
	actorID, _ := GetCurrentUserID(c)
	var req dto.ManualOrderRequest
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

	order, err := h.orderUsecase.CreateManual(c.Request().Context(), actorID, items)
	if err != nil {
		return err
	}
	return Success(c, http.StatusCreated, dto.OrderResponseFrom(order))
}

func (h *OrderHandler) UpdatePayment(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid order id", http.StatusBadRequest, nil)
	}

	var req dto.UpdatePaymentRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	var method *domain.PaymentMethod
	if req.PaymentMethod != nil {
		m := domain.PaymentMethod(*req.PaymentMethod)
		method = &m
	}

	order, err := h.orderUsecase.UpdatePayment(c.Request().Context(), id, domain.PaymentStatus(req.PaymentStatus), method)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.OrderResponseFrom(order))
}

func (h *OrderHandler) UpdateItemStatus(c echo.Context) error {
	role, _ := GetCurrentUserRole(c)
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid order id", http.StatusBadRequest, nil)
	}
	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid item id", http.StatusBadRequest, nil)
	}

	var req dto.UpdateItemStatusRequest
	if err := c.Bind(&req); err != nil {
		return err
	}

	order, err := h.orderUsecase.UpdateItemStatus(c.Request().Context(), orderID, itemID, domain.OrderItemStatus(req.Status), role)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.OrderResponseFrom(order))
}

func (h *OrderHandler) CancelItem(c echo.Context) error {
	actorID, _ := GetCurrentUserID(c)
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid order id", http.StatusBadRequest, nil)
	}
	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		return domain.NewError(domain.CodeValidationError, "invalid item id", http.StatusBadRequest, nil)
	}

	order, err := h.orderUsecase.CancelItem(c.Request().Context(), orderID, itemID, actorID)
	if err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.OrderResponseFrom(order))
}

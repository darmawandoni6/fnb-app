package http

import (
	"net/http"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/usecase"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type PublicHandler struct{ publicUsecase *usecase.PublicUsecase }

func NewPublicHandler(u *usecase.PublicUsecase) *PublicHandler {
	return &PublicHandler{publicUsecase: u}
}

func (h *PublicHandler) Menu(c echo.Context) error {
	r, e := h.publicUsecase.Menu(c.Request().Context(), c.Param("qr_token"))
	if e != nil {
		return e
	}
	return Success(c, http.StatusOK, dto.MenuResponseFrom(r))
}

func (h *PublicHandler) CreateOrder(c echo.Context) error {
	var req dto.CreateOrderRequest
	if e := c.Bind(&req); e != nil {
		return e
	}
	items := make([]usecase.CreateOrderItem, len(req.Items))
	for i, v := range req.Items {
		id, e := uuid.Parse(v.MenuID)
		if e != nil {
			return e
		}
		items[i] = usecase.CreateOrderItem{MenuID: id, Qty: v.Qty, Note: v.Note}
	}
	r, e := h.publicUsecase.CreateOrder(c.Request().Context(), c.Param("qr_token"), items)
	if e != nil {
		return e
	}
	return Success(c, http.StatusCreated, dto.CreateOrderResponse{OrderID: r.Order.ID.String(), TrackingToken: r.TrackingToken, SubtotalAmount: r.Order.SubtotalAmount, TaxAmount: r.Order.TaxAmount, TotalAmount: r.Order.TotalAmount, Status: string(r.Order.Status), Items: dto.ItemsFrom(r.Items)})
}

func (h *PublicHandler) OrderStatus(c echo.Context) error {
	r, e := h.publicUsecase.OrderStatus(c.Request().Context(), c.Param("tracking_token"))
	if e != nil {
		return e
	}
	return Success(c, http.StatusOK, dto.OrderStatusResponse{OrderID: r.Order.ID.String(), Status: string(r.Order.Status), PaymentStatus: string(r.Order.PaymentStatus), SubtotalAmount: r.Order.SubtotalAmount, TaxAmount: r.Order.TaxAmount, TotalAmount: r.Order.TotalAmount, Items: dto.ItemsFrom(r.Items)})
}

func (h *PublicHandler) CancelItem(c echo.Context) error {
	var req dto.CancelItemRequest
	if e := c.Bind(&req); e != nil {
		return e
	}
	id, e := uuid.Parse(req.ItemID)
	if e != nil {
		return e
	}
	r, e := h.publicUsecase.CancelItem(c.Request().Context(), c.Param("tracking_token"), id)
	if e != nil {
		return e
	}
	return Success(c, http.StatusOK, dto.OrderStatusResponse{OrderID: r.Order.ID.String(), Status: string(r.Order.Status), PaymentStatus: string(r.Order.PaymentStatus), SubtotalAmount: r.Order.SubtotalAmount, TaxAmount: r.Order.TaxAmount, TotalAmount: r.Order.TotalAmount, Items: dto.ItemsFrom(r.Items)})
}

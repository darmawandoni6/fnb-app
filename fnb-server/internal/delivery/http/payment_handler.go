package http

import (
	"net/http"
	"strings"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/usecase"

	"github.com/labstack/echo/v4"
)

type PaymentHandler struct {
	paymentUsecase *usecase.PaymentUsecase
}

func NewPaymentHandler(u *usecase.PaymentUsecase) *PaymentHandler {
	return &PaymentHandler{paymentUsecase: u}
}

func (h *PaymentHandler) MidtransCallback(c echo.Context) error {
	var req dto.MidtransCallbackRequest
	if strings.Contains(c.Request().Header.Get(echo.HeaderContentType), echo.MIMEApplicationForm) {
		if err := c.Request().ParseForm(); err != nil {
			return err
		}
		req = req.FormValue(c.Request().FormValue)
	} else if err := c.Bind(&req); err != nil {
		return err
	}

	in := usecase.CallbackInput{
		OrderID:           req.OrderID,
		StatusCode:        req.StatusCode,
		GrossAmount:       req.GrossAmount,
		SignatureKey:      req.SignatureKey,
		TransactionStatus: req.TransactionStatus,
		TransactionID:     req.TransactionID,
		FraudStatus:       req.FraudStatus,
	}

	if err := h.paymentUsecase.HandleMidtransCallback(c.Request().Context(), in); err != nil {
		return err
	}
	return Success(c, http.StatusOK, dto.MidtransCallbackResponse{Status: "ok"})
}

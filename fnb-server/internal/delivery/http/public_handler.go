package http

import (
	"net/http"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"

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

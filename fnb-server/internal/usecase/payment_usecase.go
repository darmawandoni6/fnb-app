package usecase

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"fnb-server/internal/domain"
)

type CallbackInput struct {
	OrderID           string // our order_number
	StatusCode        string
	GrossAmount       string
	SignatureKey      string
	TransactionStatus string
	TransactionID     string
	FraudStatus       string
}

type PaymentUsecase struct {
	orderRepo domain.OrderQueryRepository
	withTx    TxRunner
	serverKey string
	publisher domain.Publisher
	logger    *slog.Logger
}

func NewPaymentUsecase(
	orderRepo domain.OrderQueryRepository,
	withTx TxRunner,
	serverKey string,
	publisher domain.Publisher,
	logger *slog.Logger,
) *PaymentUsecase {
	return &PaymentUsecase{
		orderRepo: orderRepo,
		withTx:    withTx,
		serverKey: serverKey,
		publisher: publisher,
		logger:    logger,
	}
}

func sameAmount(gross string, total int64) bool {
	whole, frac, _ := strings.Cut(gross, ".")
	if strings.Trim(frac, "0") != "" {
		return false
	}
	return strconv.FormatInt(total, 10) == whole
}

func (u *PaymentUsecase) HandleMidtransCallback(ctx context.Context, in CallbackInput) error {
	rawSig := in.OrderID + in.StatusCode + in.GrossAmount + u.serverKey
	hasher := sha512.New()
	hasher.Write([]byte(rawSig))
	expectedSig := hex.EncodeToString(hasher.Sum(nil))

	if in.SignatureKey != expectedSig {
		return domain.NewError(domain.CodeUnauthorized, "invalid signature key", http.StatusUnauthorized, nil)
	}

	order, err := u.orderRepo.GetByOrderNumber(ctx, in.OrderID)
	if err != nil {
		return err
	}
	if order == nil {
		if u.logger != nil {
			u.logger.Warn("midtrans callback order not found", "order_number", in.OrderID)
		}
		return domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}

	isSuccess := in.TransactionStatus == "settlement" ||
		(in.TransactionStatus == "capture" && (in.FraudStatus == "accept" || in.FraudStatus == ""))

	isCancel := in.TransactionStatus == "expire" ||
		in.TransactionStatus == "deny" ||
		in.TransactionStatus == "cancel"

	now := time.Now().UTC()

	if isSuccess {
		if !sameAmount(in.GrossAmount, order.TotalAmount) {
			if u.logger != nil {
				u.logger.Warn("midtrans gross_amount mismatch, ignoring settlement",
					"order_number", order.OrderNumber, "gross_amount", in.GrossAmount, "total", order.TotalAmount)
			}
			return nil
		}
		var alreadySettled bool
		err = u.withTx(ctx, func(tx OrderTx) error {
			pLog, err := tx.GetPaymentLogByGatewayRef(ctx, in.TransactionID)
			if err != nil {
				return err
			}
			if pLog != nil && pLog.Status == domain.PaymentLogStatusSettled {
				alreadySettled = true
				return nil
			}
			if order.PaymentStatus == domain.PaymentStatusPaid {
				alreadySettled = true
				return nil
			}

			pendingLog, err := tx.GetPendingPaymentLog(ctx, order.ID)
			if err != nil {
				return err
			}
			if pendingLog != nil {
				if err := tx.UpdatePaymentLogStatus(ctx, pendingLog.ID, domain.PaymentLogStatusSettled, &in.TransactionStatus, &in.TransactionID); err != nil {
					return err
				}
			} else {
				gw := domain.PaymentGatewayMidtrans
				newLog := domain.PaymentLog{
					OrderID:       order.ID,
					Method:        domain.PaymentMethodNonCash,
					Gateway:       &gw,
					Amount:        order.TotalAmount,
					Status:        domain.PaymentLogStatusSettled,
					GatewayRef:    &in.TransactionID,
					GatewayStatus: &in.TransactionStatus,
				}
				if err := tx.CreatePaymentLog(ctx, &newLog); err != nil {
					return err
				}
			}

			if err := tx.SetPaid(ctx, order.ID, domain.PaymentMethodNonCash, &in.TransactionID, now, nil, nil); err != nil {
				return err
			}

			newStatus := domain.AggregateOrderStatus(order.Items, domain.PaymentStatusPaid, false)
			if newStatus != order.Status {
				if err := tx.UpdateAggregate(ctx, order.ID, newStatus); err != nil {
					return err
				}
				order.Status = newStatus
			}

			audit := &domain.AuditLog{
				Entity:   "order",
				EntityID: order.ID,
				Action:   "payment_confirmed",
				ToValue:  &in.TransactionStatus,
			}
			return tx.Audit(ctx, audit)
		})
		if err != nil {
			return err
		}
		if alreadySettled {
			return nil
		}

		order.PaymentStatus = domain.PaymentStatusPaid
		nonCash := domain.PaymentMethodNonCash
		order.PaymentMethod = &nonCash
		order.PaymentRef = &in.TransactionID
		order.PaidAt = &now

		if u.publisher != nil {
			u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: "order.updated", Order: order})
			if order.TableSession != nil && order.TableSession.SessionToken != "" {
				u.publisher.PublishSession(ctx, order.TableSession.SessionToken, domain.OrderEvent{Event: "order.updated", Order: order})
			}
		}
		return nil
	}

	if isCancel {
		if order.CanceledAt != nil || order.PaymentStatus == domain.PaymentStatusPaid {
			return nil
		}

		cancelReason := "midtrans " + in.TransactionStatus
		err = u.withTx(ctx, func(tx OrderTx) error {
			pendingLog, err := tx.GetPendingPaymentLog(ctx, order.ID)
			if err != nil {
				return err
			}
			if pendingLog != nil {
				if err := tx.UpdatePaymentLogStatus(ctx, pendingLog.ID, domain.PaymentLogStatusExpired, &in.TransactionStatus, &in.TransactionID); err != nil {
					return err
				}
			}

			if err := tx.RestoreStock(ctx, order, order.Items); err != nil {
				return err
			}
			if err := tx.CancelOrder(ctx, order.ID, cancelReason, nil); err != nil {
				return err
			}
			if err := tx.UpdateAggregate(ctx, order.ID, domain.OrderStatusCancelled); err != nil {
				return err
			}
			audit := &domain.AuditLog{
				Entity:   "order",
				EntityID: order.ID,
				Action:   "order_cancelled",
				ToValue:  &cancelReason,
			}
			return tx.Audit(ctx, audit)
		})
		if err != nil {
			return err
		}

		order.Status = domain.OrderStatusCancelled
		order.CancelReason = &cancelReason
		order.CanceledAt = &now
		for i := range order.Items {
			order.Items[i].Status = domain.OrderItemStatusCancelled
			order.Items[i].CancelledAt = &now
		}

		if u.publisher != nil {
			u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: "order.updated", Order: order})
			if order.TableSession != nil && order.TableSession.SessionToken != "" {
				u.publisher.PublishSession(ctx, order.TableSession.SessionToken, domain.OrderEvent{Event: "order.updated", Order: order})
			}
		}
		return nil
	}

	return nil
}

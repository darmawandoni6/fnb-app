package domain

import (
	"fmt"
	"math"
	"net/http"
)

type Totals struct {
	Subtotal int64 `json:"subtotal"`
	Service  int64 `json:"service"`
	Tax      int64 `json:"tax"`
	Total    int64 `json:"total"`
}

// CalcTotals implements PRD §6: service on subtotal, tax on subtotal+service,
// round half up per component, integer rupiah.
func CalcTotals(subtotal int64, serviceRate, taxRate float64) Totals {
	service := calcComponent(subtotal, serviceRate)
	tax := calcComponent(subtotal+service, taxRate)
	return Totals{
		Subtotal: subtotal,
		Service:  service,
		Tax:      tax,
		Total:    subtotal + service + tax,
	}
}

func calcComponent(amount int64, rate float64) int64 {
	if amount <= 0 || rate <= 0 {
		return 0
	}
	return int64(math.Round(float64(amount) * rate / 100.0))
}

// CalcTax is kept as a helper for backward compatibility where only tax is calculated.
func CalcTax(amount int64, percent float64) int64 {
	return calcComponent(amount, percent)
}

// AggregateOrderStatus implements PRD §5.3:
// 1. cancelled == true -> DIBATALKAN.
// 2. all items CANCELLED -> DIBATALKAN.
// 3. payment == BELUM -> MENUNGGU.
// 4. every item COMPLETED or CANCELLED -> SELESAI.
// 5. otherwise -> DIPROSES.
func AggregateOrderStatus(items []OrderItem, payment PaymentStatus, cancelled bool) OrderStatus {
	if cancelled {
		return OrderStatusCancelled
	}

	if len(items) == 0 {
		return OrderStatusWaiting
	}

	allCancelled := true
	allCompletedOrCancelled := true
	for _, it := range items {
		if it.Status != OrderItemStatusCancelled {
			allCancelled = false
		}
		if it.Status != OrderItemStatusCompleted && it.Status != OrderItemStatusCancelled {
			allCompletedOrCancelled = false
		}
	}

	if allCancelled {
		return OrderStatusCancelled
	}
	if payment == PaymentStatusUnpaid {
		return OrderStatusWaiting
	}
	if allCompletedOrCancelled {
		return OrderStatusCompleted
	}
	return OrderStatusProcessing
}

func ValidateItemTransition(from, to OrderItemStatus) error {
	if from == OrderItemStatusPending && to == OrderItemStatusCooking {
		return nil
	}
	if from == OrderItemStatusCooking && to == OrderItemStatusReady {
		return nil
	}
	if from == OrderItemStatusReady && to == OrderItemStatusDelivered {
		return nil
	}
	if from == OrderItemStatusDelivered && to == OrderItemStatusCompleted {
		return nil
	}
	return NewError(CodeInvalidTransition, fmt.Sprintf("invalid transition from %s to %s", from, to), http.StatusConflict, nil)
}

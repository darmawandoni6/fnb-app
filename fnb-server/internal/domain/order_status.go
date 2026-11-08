package domain

import (
	"fmt"
	"net/http"
)

func AggregateOrderStatus(items []OrderItem, payment PaymentStatus) OrderStatus {
	var active []OrderItem
	for _, it := range items {
		if it.Status != OrderItemStatusCancelled {
			active = append(active, it)
		}
	}

	if len(active) == 0 {
		return OrderStatusCancelled
	}

	allPending := true
	for _, it := range active {
		if it.Status != OrderItemStatusPending {
			allPending = false
			break
		}
	}
	if allPending {
		return OrderStatusWaiting
	}

	for _, it := range active {
		if it.Status == OrderItemStatusCooking {
			return OrderStatusProcessing
		}
	}

	allDelivered := true
	for _, it := range active {
		if it.Status != OrderItemStatusDelivered {
			allDelivered = false
			break
		}
	}
	if allDelivered {
		if payment == PaymentStatusPaid {
			return OrderStatusCompleted
		}
		return OrderStatusDelivering
	}

	for _, it := range active {
		if it.Status == OrderItemStatusDelivered {
			return OrderStatusDelivering
		}
	}

	allReady := true
	for _, it := range active {
		if it.Status != OrderItemStatusReady {
			allReady = false
			break
		}
	}
	if allReady {
		return OrderStatusReady
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
	return NewError(CodeInvalidTransition, fmt.Sprintf("invalid transition from %s to %s", from, to), http.StatusConflict, nil)
}

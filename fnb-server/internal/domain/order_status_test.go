package domain

import (
	"testing"
)

func TestAggregateOrderStatus(t *testing.T) {
	tests := []struct {
		name     string
		items    []OrderItem
		payment  PaymentStatus
		expected OrderStatus
	}{
		{
			name: "1. All PENDING -> MENUNGGU",
			items: []OrderItem{
				{Status: OrderItemStatusPending},
				{Status: OrderItemStatusPending},
			},
			payment:  PaymentStatusUnpaid,
			expected: OrderStatusWaiting,
		},
		{
			name: "2. One COOKING -> DIPROSES",
			items: []OrderItem{
				{Status: OrderItemStatusPending},
				{Status: OrderItemStatusCooking},
			},
			payment:  PaymentStatusPaid,
			expected: OrderStatusProcessing,
		},
		{
			name: "3. All READY -> SIAP",
			items: []OrderItem{
				{Status: OrderItemStatusReady},
				{Status: OrderItemStatusReady},
			},
			payment:  PaymentStatusPaid,
			expected: OrderStatusReady,
		},
		{
			name: "4. One DELIVERED, others active -> DIANTAR",
			items: []OrderItem{
				{Status: OrderItemStatusDelivered},
				{Status: OrderItemStatusReady},
			},
			payment:  PaymentStatusPaid,
			expected: OrderStatusDelivering,
		},
		{
			name: "5. All DELIVERED + LUNAS -> SELESAI",
			items: []OrderItem{
				{Status: OrderItemStatusDelivered},
				{Status: OrderItemStatusDelivered},
			},
			payment:  PaymentStatusPaid,
			expected: OrderStatusCompleted,
		},
		{
			name: "6. All DELIVERED + BELUM -> DIANTAR",
			items: []OrderItem{
				{Status: OrderItemStatusDelivered},
				{Status: OrderItemStatusDelivered},
			},
			payment:  PaymentStatusUnpaid,
			expected: OrderStatusDelivering,
		},
		{
			name: "7. All CANCELLED -> DIBATALKAN",
			items: []OrderItem{
				{Status: OrderItemStatusCancelled},
				{Status: OrderItemStatusCancelled},
			},
			payment:  PaymentStatusUnpaid,
			expected: OrderStatusCancelled,
		},
		{
			name: "8. PENDING + READY mix -> DIPROSES",
			items: []OrderItem{
				{Status: OrderItemStatusPending},
				{Status: OrderItemStatusReady},
			},
			payment:  PaymentStatusPaid,
			expected: OrderStatusProcessing,
		},
		{
			name: "9. Cancelled items excluded from active count",
			items: []OrderItem{
				{Status: OrderItemStatusReady},
				{Status: OrderItemStatusCancelled},
			},
			payment:  PaymentStatusPaid,
			expected: OrderStatusReady,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := AggregateOrderStatus(tc.items, tc.payment)
			if got != tc.expected {
				t.Errorf("AggregateOrderStatus() = %v, want %v", got, tc.expected)
			}
		})
	}
}

func TestValidateItemTransition(t *testing.T) {
	valid := [][2]OrderItemStatus{
		{OrderItemStatusPending, OrderItemStatusCooking},
		{OrderItemStatusCooking, OrderItemStatusReady},
		{OrderItemStatusReady, OrderItemStatusDelivered},
	}
	for _, pair := range valid {
		if err := ValidateItemTransition(pair[0], pair[1]); err != nil {
			t.Errorf("expected valid transition from %s to %s, got error: %v", pair[0], pair[1], err)
		}
	}

	invalid := [][2]OrderItemStatus{
		{OrderItemStatusPending, OrderItemStatusReady},
		{OrderItemStatusPending, OrderItemStatusDelivered},
		{OrderItemStatusCooking, OrderItemStatusDelivered},
		{OrderItemStatusCooking, OrderItemStatusPending},
		{OrderItemStatusReady, OrderItemStatusCooking},
		{OrderItemStatusDelivered, OrderItemStatusReady},
		{OrderItemStatusCancelled, OrderItemStatusCooking},
	}
	for _, pair := range invalid {
		if err := ValidateItemTransition(pair[0], pair[1]); err == nil {
			t.Errorf("expected error for invalid transition from %s to %s, got nil", pair[0], pair[1])
		}
	}
}

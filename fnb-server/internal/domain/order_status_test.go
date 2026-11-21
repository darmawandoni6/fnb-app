package domain

import (
	"testing"
)

func TestCalcTotals(t *testing.T) {
	cases := []struct {
		name        string
		subtotal    int64
		serviceRate float64
		taxRate     float64
		want        Totals
	}{
		{
			name:        "Standard PRD example 50000 with 5% and 10%",
			subtotal:    50000,
			serviceRate: 5,
			taxRate:     10,
			want: Totals{
				Subtotal: 50000,
				Service:  2500,
				Tax:      5250,
				Total:    57750,
			},
		},
		{
			name:        "Zero rates",
			subtotal:    50000,
			serviceRate: 0,
			taxRate:     0,
			want: Totals{
				Subtotal: 50000,
				Service:  0,
				Tax:      0,
				Total:    50000,
			},
		},
		{
			name:        "Zero subtotal",
			subtotal:    0,
			serviceRate: 5,
			taxRate:     10,
			want: Totals{
				Subtotal: 0,
				Service:  0,
				Tax:      0,
				Total:    0,
			},
		},
		{
			name:        "1 rupiah subtotal with round half up",
			subtotal:    1,
			serviceRate: 50, // 1 * 0.5 = 0.5 -> 1
			taxRate:     50, // (1 + 1) * 0.5 = 1.0 -> 1
			want: Totals{
				Subtotal: 1,
				Service:  1,
				Tax:      1,
				Total:    3,
			},
		},
		{
			name:        "Round half up check",
			subtotal:    10,
			serviceRate: 5, // 10 * 0.05 = 0.5 -> 1
			taxRate:     5, // 11 * 0.05 = 0.55 -> 1
			want: Totals{
				Subtotal: 10,
				Service:  1,
				Tax:      1,
				Total:    12,
			},
		},
		{
			name:        "Large value overflow free",
			subtotal:    1_000_000_000, // 1 billion
			serviceRate: 5,
			taxRate:     10,
			want: Totals{
				Subtotal: 1_000_000_000,
				Service:  50_000_000,
				Tax:      105_000_000,
				Total:    1_155_000_000,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CalcTotals(tc.subtotal, tc.serviceRate, tc.taxRate)
			if got != tc.want {
				t.Errorf("CalcTotals(%d, %v, %v) = %+v, want %+v",
					tc.subtotal, tc.serviceRate, tc.taxRate, got, tc.want)
			}
		})
	}
}

func TestAggregateOrderStatus(t *testing.T) {
	tests := []struct {
		name      string
		items     []OrderItem
		payment   PaymentStatus
		cancelled bool
		expected  OrderStatus
	}{
		{
			name: "1. Cancelled flag true -> DIBATALKAN",
			items: []OrderItem{
				{Status: OrderItemStatusPending},
			},
			payment:   PaymentStatusPaid,
			cancelled: true,
			expected:  OrderStatusCancelled,
		},
		{
			name: "2. All items cancelled -> DIBATALKAN",
			items: []OrderItem{
				{Status: OrderItemStatusCancelled},
				{Status: OrderItemStatusCancelled},
			},
			payment:   PaymentStatusPaid,
			cancelled: false,
			expected:  OrderStatusCancelled,
		},
		{
			name: "3. PRD §5.3 Row 1: payment BELUM -> MENUNGGU",
			items: []OrderItem{
				{Status: OrderItemStatusCooking},
			},
			payment:   PaymentStatusUnpaid,
			cancelled: false,
			expected:  OrderStatusWaiting,
		},
		{
			name: "4. PRD §5.3 Row 2: payment LUNAS + active items not all completed -> DIPROSES",
			items: []OrderItem{
				{Status: OrderItemStatusCooking},
				{Status: OrderItemStatusReady},
			},
			payment:   PaymentStatusPaid,
			cancelled: false,
			expected:  OrderStatusProcessing,
		},
		{
			name: "5. PRD §5.3 Row 3: payment LUNAS + some delivered, some cooking -> DIPROSES",
			items: []OrderItem{
				{Status: OrderItemStatusCooking},
				{Status: OrderItemStatusDelivered},
			},
			payment:   PaymentStatusPaid,
			cancelled: false,
			expected:  OrderStatusProcessing,
		},
		{
			name: "6. PRD §5.3 Row 4: payment LUNAS + all items COMPLETED -> SELESAI",
			items: []OrderItem{
				{Status: OrderItemStatusCompleted},
				{Status: OrderItemStatusCompleted},
			},
			payment:   PaymentStatusPaid,
			cancelled: false,
			expected:  OrderStatusCompleted,
		},
		{
			name: "7. All items COMPLETED or CANCELLED (at least one completed) -> SELESAI",
			items: []OrderItem{
				{Status: OrderItemStatusCompleted},
				{Status: OrderItemStatusCancelled},
			},
			payment:   PaymentStatusPaid,
			cancelled: false,
			expected:  OrderStatusCompleted,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := AggregateOrderStatus(tc.items, tc.payment, tc.cancelled)
			if got != tc.expected {
				t.Errorf("AggregateOrderStatus() = %v, want %v", got, tc.expected)
			}
		})
	}
}

func TestValidateItemTransition(t *testing.T) {
	allStatuses := []OrderItemStatus{
		OrderItemStatusPending,
		OrderItemStatusCooking,
		OrderItemStatusReady,
		OrderItemStatusDelivered,
		OrderItemStatusCompleted,
		OrderItemStatusCancelled,
	}

	allowed := map[[2]OrderItemStatus]bool{
		{OrderItemStatusPending, OrderItemStatusCooking}:     true,
		{OrderItemStatusCooking, OrderItemStatusReady}:       true,
		{OrderItemStatusReady, OrderItemStatusDelivered}:     true,
		{OrderItemStatusDelivered, OrderItemStatusCompleted}: true,
	}

	// Full 6x6 matrix verification
	for _, from := range allStatuses {
		for _, to := range allStatuses {
			err := ValidateItemTransition(from, to)
			pair := [2]OrderItemStatus{from, to}
			if allowed[pair] {
				if err != nil {
					t.Errorf("expected transition %s -> %s to be allowed, got error: %v", from, to, err)
				}
			} else {
				if err == nil {
					t.Errorf("expected transition %s -> %s to be rejected, got nil error", from, to)
				}
			}
		}
	}
}

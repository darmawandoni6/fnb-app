package domain

import "testing"

func TestSingularTableNamesMatchMigrations(t *testing.T) {
	cases := map[string]interface{ TableName() string }{
		"audit_log":      AuditLog{},
		"payment_log":    PaymentLog{},
		"order_sequence": OrderSequence{},
	}
	for want, model := range cases {
		if got := model.TableName(); got != want {
			t.Errorf("expected table %q, got %q", want, got)
		}
	}
}

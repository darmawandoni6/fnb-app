package domain

import "testing"

func TestAuditLog_TableNameMatchesMigration(t *testing.T) {
	if got := (AuditLog{}).TableName(); got != "audit_log" {
		t.Fatalf("expected table audit_log (see migrations/000003_prd_alignment.up.sql), got %q", got)
	}
}

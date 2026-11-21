package usecase

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type mockTableRepo struct {
	tables map[string]*domain.Table
}

func (m *mockTableRepo) GetByQRToken(ctx context.Context, qrToken string) (*domain.Table, error) {
	return m.tables[qrToken], nil
}

type mockTableSessionRepo struct {
	mu       sync.Mutex
	sessions map[string]*domain.TableSession
}

func newMockTableSessionRepo() *mockTableSessionRepo {
	return &mockTableSessionRepo{
		sessions: make(map[string]*domain.TableSession),
	}
}

func (m *mockTableSessionRepo) GetOpenByTableID(ctx context.Context, tableID uuid.UUID) (*domain.TableSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.sessions {
		if s.TableID == tableID && s.Status == domain.TableSessionStatusOpen {
			return s, nil
		}
	}
	return nil, nil
}

func (m *mockTableSessionRepo) GetBySessionToken(ctx context.Context, token string) (*domain.TableSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[token]
	return s, nil
}

func (m *mockTableSessionRepo) Create(ctx context.Context, session *domain.TableSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.sessions {
		if s.TableID == session.TableID && s.Status == domain.TableSessionStatusOpen {
			return domain.ErrSessionAlreadyOpen
		}
	}
	if session.ID == uuid.Nil {
		session.ID = uuid.New()
	}
	m.sessions[session.SessionToken] = session
	return nil
}

func (m *mockTableSessionRepo) Close(ctx context.Context, id uuid.UUID, closedBy *uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.sessions {
		if s.ID == id && s.Status == domain.TableSessionStatusOpen {
			now := time.Now().UTC()
			s.Status = domain.TableSessionStatusClosed
			s.EndedAt = &now
			s.ClosedBy = closedBy
			return nil
		}
	}
	return nil
}

func TestTableSessionUsecase_Open_NewTable(t *testing.T) {
	table := &domain.Table{
		ID:          uuid.New(),
		TableNumber: "A1",
		QRToken:     "token-a1",
		IsActive:    true,
	}
	tableRepo := &mockTableRepo{tables: map[string]*domain.Table{table.QRToken: table}}
	sessionRepo := newMockTableSessionRepo()
	u := NewTableSessionUsecase(sessionRepo, tableRepo, nil)

	ctx := context.Background()
	session, err := u.Open(ctx, "token-a1")
	if err != nil {
		t.Fatalf("expected open success, got: %v", err)
	}

	if session.SessionToken == "" {
		t.Fatalf("expected non-empty session token")
	}
	if session.TableID != table.ID {
		t.Errorf("expected tableID %s, got %s", table.ID, session.TableID)
	}
	if session.Status != domain.TableSessionStatusOpen {
		t.Errorf("expected status OPEN, got %s", session.Status)
	}
}

func TestTableSessionUsecase_Open_Idempotent(t *testing.T) {
	table := &domain.Table{
		ID:          uuid.New(),
		TableNumber: "A1",
		QRToken:     "token-a1",
		IsActive:    true,
	}
	tableRepo := &mockTableRepo{tables: map[string]*domain.Table{table.QRToken: table}}
	sessionRepo := newMockTableSessionRepo()
	u := NewTableSessionUsecase(sessionRepo, tableRepo, nil)

	ctx := context.Background()
	first, err := u.Open(ctx, "token-a1")
	if err != nil {
		t.Fatalf("first open failed: %v", err)
	}

	second, err := u.Open(ctx, "token-a1")
	if err != nil {
		t.Fatalf("second open failed: %v", err)
	}

	if first.SessionToken != second.SessionToken {
		t.Errorf("expected idempotent session token, got %s vs %s", first.SessionToken, second.SessionToken)
	}
}

func TestTableSessionUsecase_Open_InactiveTable_Returns404(t *testing.T) {
	table := &domain.Table{
		ID:          uuid.New(),
		TableNumber: "A1",
		QRToken:     "token-a1",
		IsActive:    false,
	}
	tableRepo := &mockTableRepo{tables: map[string]*domain.Table{table.QRToken: table}}
	sessionRepo := newMockTableSessionRepo()
	u := NewTableSessionUsecase(sessionRepo, tableRepo, nil)

	_, err := u.Open(context.Background(), "token-a1")
	if err == nil {
		t.Fatal("expected error for inactive table, got nil")
	}

	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.HTTPStatus != 404 {
		t.Fatalf("expected 404 NOT_FOUND, got: %v", err)
	}
}

func TestTableSessionUsecase_RequireOpen_ClosedSession_Returns401(t *testing.T) {
	table := &domain.Table{
		ID:          uuid.New(),
		TableNumber: "A1",
		QRToken:     "token-a1",
		IsActive:    true,
	}
	tableRepo := &mockTableRepo{tables: map[string]*domain.Table{table.QRToken: table}}
	sessionRepo := newMockTableSessionRepo()
	u := NewTableSessionUsecase(sessionRepo, tableRepo, nil)

	ctx := context.Background()
	session, _ := u.Open(ctx, "token-a1")

	// Close session
	_ = sessionRepo.Close(ctx, session.ID, nil)

	_, err := u.RequireOpen(ctx, session.SessionToken)
	if err == nil {
		t.Fatal("expected 401 for closed session, got nil")
	}

	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.HTTPStatus != 401 {
		t.Fatalf("expected 401 UNAUTHORIZED, got: %v", err)
	}
}

func TestTableSessionUsecase_Open_ConcurrentRace(t *testing.T) {
	table := &domain.Table{
		ID:          uuid.New(),
		TableNumber: "A1",
		QRToken:     "token-a1",
		IsActive:    true,
	}
	tableRepo := &mockTableRepo{tables: map[string]*domain.Table{table.QRToken: table}}
	sessionRepo := newMockTableSessionRepo()
	u := NewTableSessionUsecase(sessionRepo, tableRepo, nil)

	ctx := context.Background()
	const n = 10
	results := make([]*domain.TableSession, n)
	var wg sync.WaitGroup

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			s, err := u.Open(ctx, "token-a1")
			if err == nil {
				results[idx] = s
			}
		}(i)
	}
	wg.Wait()

	// All concurrent opens should return the identical session token
	firstToken := ""
	for i, s := range results {
		if s == nil {
			t.Fatalf("goroutine %d failed to get session", i)
		}
		if firstToken == "" {
			firstToken = s.SessionToken
		} else if s.SessionToken != firstToken {
			t.Errorf("token mismatch in race: %s vs %s", s.SessionToken, firstToken)
		}
	}
}

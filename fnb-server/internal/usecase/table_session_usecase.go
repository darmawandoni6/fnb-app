package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type TableSessionUsecase struct {
	sessionRepo domain.TableSessionRepository
	tableRepo   domain.TableRepository
	auditRepo   domain.AuditRepository
}

func NewTableSessionUsecase(
	sessionRepo domain.TableSessionRepository,
	tableRepo domain.TableRepository,
	auditRepo domain.AuditRepository,
) *TableSessionUsecase {
	return &TableSessionUsecase{
		sessionRepo: sessionRepo,
		tableRepo:   tableRepo,
		auditRepo:   auditRepo,
	}
}

func (u *TableSessionUsecase) Open(ctx context.Context, qrToken string) (*domain.TableSession, error) {
	table, err := u.tableRepo.GetByQRToken(ctx, qrToken)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to query table", http.StatusInternalServerError, err)
	}
	if table == nil || !table.IsActive {
		return nil, domain.NewError(domain.CodeNotFound, "table not found", http.StatusNotFound, nil)
	}

	existing, err := u.sessionRepo.GetOpenByTableID(ctx, table.ID)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to query open session", http.StatusInternalServerError, err)
	}
	if existing != nil {
		if existing.Table.TableNumber == "" {
			existing.Table = *table
		}
		return existing, nil
	}

	token, err := generateSessionToken()
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to generate session token", http.StatusInternalServerError, err)
	}

	session := &domain.TableSession{
		TableID:      table.ID,
		Table:        *table,
		SessionToken: token,
		Status:       domain.TableSessionStatusOpen,
		StartedAt:    time.Now().UTC(),
	}

	err = u.sessionRepo.Create(ctx, session)
	if err != nil {
		if errors.Is(err, domain.ErrSessionAlreadyOpen) {
			reloaded, reloadErr := u.sessionRepo.GetOpenByTableID(ctx, table.ID)
			if reloadErr != nil {
				return nil, domain.NewError(domain.CodeInternalError, "failed to reload open session", http.StatusInternalServerError, reloadErr)
			}
			if reloaded != nil {
				if reloaded.Table.TableNumber == "" {
					reloaded.Table = *table
				}
				return reloaded, nil
			}
		}
		return nil, domain.NewError(domain.CodeInternalError, "failed to create session", http.StatusInternalServerError, err)
	}

	if u.auditRepo != nil {
		_ = u.auditRepo.Create(ctx, &domain.AuditLog{
			Entity:   "table_session",
			EntityID: session.ID,
			Action:   "session_opened",
		})
	}

	return session, nil
}

func (u *TableSessionUsecase) RequireOpen(ctx context.Context, sessionToken string) (*domain.TableSession, error) {
	if strings.TrimSpace(sessionToken) == "" {
		return nil, domain.NewError(domain.CodeUnauthorized, "session token is required", http.StatusUnauthorized, nil)
	}

	session, err := u.sessionRepo.GetBySessionToken(ctx, sessionToken)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to query session", http.StatusInternalServerError, err)
	}
	if session == nil {
		return nil, domain.NewError(domain.CodeUnauthorized, "invalid session token", http.StatusUnauthorized, nil)
	}

	if session.Status != domain.TableSessionStatusOpen {
		return nil, domain.NewError(domain.CodeUnauthorized, "table session is closed", http.StatusUnauthorized, nil)
	}

	if !session.Table.IsActive {
		return nil, domain.NewError(domain.CodeUnauthorized, "table is inactive", http.StatusUnauthorized, nil)
	}

	return session, nil
}

func (u *TableSessionUsecase) GetOpenByTable(ctx context.Context, tableID uuid.UUID) (*domain.TableSession, error) {
	session, err := u.sessionRepo.GetOpenByTableID(ctx, tableID)
	if err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to query session", http.StatusInternalServerError, err)
	}
	if session == nil {
		return nil, domain.NewError(domain.CodeNotFound, "open session not found", http.StatusNotFound, nil)
	}
	return session, nil
}

func (u *TableSessionUsecase) CloseByTable(ctx context.Context, tableID uuid.UUID, actorID *uuid.UUID, actorRole *domain.UserRole, publisher domain.Publisher) (*domain.TableSession, error) {
	session, err := u.GetOpenByTable(ctx, tableID)
	if err != nil {
		return nil, err
	}
	if err := u.sessionRepo.Close(ctx, session.ID, actorID); err != nil {
		return nil, domain.NewError(domain.CodeInternalError, "failed to close session", http.StatusInternalServerError, err)
	}
	fromStr, toStr := string(session.Status), string(domain.TableSessionStatusClosed)
	if u.auditRepo != nil {
		_ = u.auditRepo.Create(ctx, &domain.AuditLog{
			Entity:    "table_session",
			EntityID:  session.ID,
			Action:    "session_closed",
			FromValue: &fromStr,
			ToValue:   &toStr,
			ActorID:   actorID,
			ActorRole: actorRole,
		})
	}
	if publisher != nil {
		publisher.PublishSession(ctx, session.SessionToken, domain.OrderEvent{Event: "session.closed", Order: &domain.Order{ID: session.ID}})
	}
	now := time.Now().UTC()
	session.Status = domain.TableSessionStatusClosed
	session.EndedAt = &now
	session.ClosedBy = actorID
	return session, nil
}

func generateSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate random bytes: %w", err)
	}
	return hex.EncodeToString(b), nil
}

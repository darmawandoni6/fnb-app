package repository

import (
	"context"
	"time"

	"fnb-server/internal/domain"
	"gorm.io/gorm"
)

type OrderSequenceRepository struct {
	db *gorm.DB
}

func NewOrderSequenceRepository(db *gorm.DB) *OrderSequenceRepository {
	return &OrderSequenceRepository{db: db}
}

func (r *OrderSequenceRepository) NextSeq(ctx context.Context, t domain.OrderType, day time.Time) (int, error) {
	var seq int
	err := r.db.WithContext(ctx).Raw(`
		INSERT INTO order_sequence (order_type, date, last_seq)
		VALUES (?, ?, 1)
		ON CONFLICT (order_type, date)
		DO UPDATE SET last_seq = order_sequence.last_seq + 1
		RETURNING last_seq`, t, day.Format("2006-01-02")).Scan(&seq).Error
	return seq, err
}

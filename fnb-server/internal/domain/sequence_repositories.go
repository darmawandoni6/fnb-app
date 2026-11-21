package domain

import (
	"context"
	"time"
)

type SequenceRepository interface {
	NextSeq(ctx context.Context, orderType OrderType, day time.Time) (int, error)
}

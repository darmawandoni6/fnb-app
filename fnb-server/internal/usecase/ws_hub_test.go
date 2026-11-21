package usecase

import (
	"context"
	"sync"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type hubTestClient struct {
	mu       sync.Mutex
	received [][]byte
	closed   bool
	full     bool
}

func (c *hubTestClient) Send(payload []byte) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.full {
		return false
	}
	c.received = append(c.received, payload)
	return true
}

func (c *hubTestClient) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.closed = true
}

func (c *hubTestClient) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.received)
}

func startHub(t *testing.T) *Hub {
	t.Helper()
	hub := NewHub()
	go hub.Run(context.Background())
	t.Cleanup(hub.Close)
	return hub
}

func eventOf(topic string) domain.Event {
	return domain.Event{Topic: topic, Name: "order.updated", Data: map[string]string{"id": "x"}}
}

func TestHub_RegisterPublishUnregister(t *testing.T) {
	hub := startHub(t)
	a, b := &hubTestClient{}, &hubTestClient{}
	hub.Register("order:1", a)
	hub.Register("order:1", b)

	hub.Publish(eventOf("order:1"))
	waitFor(t, func() bool { return a.count() == 1 && b.count() == 1 })

	hub.Publish(eventOf("order:1"))
	waitFor(t, func() bool { return a.count() == 2 })

	hub.Unregister("order:1", a)
	before := a.count()
	hub.Publish(eventOf("order:1"))
	waitFor(t, func() bool { return b.count() == 3 })
	if a.count() != before {
		t.Errorf("unregistered client received an event")
	}
}

func TestHub_DropsSlowClient(t *testing.T) {
	hub := startHub(t)
	fast, slow := &hubTestClient{}, &hubTestClient{full: true}
	hub.Register("order:1", fast)
	hub.Register("order:1", slow)

	hub.Publish(eventOf("order:1"))
	waitFor(t, func() bool { return fast.count() == 1 })
	waitFor(t, func() bool {
		slow.mu.Lock()
		defer slow.mu.Unlock()
		return slow.closed
	})

	hub.Publish(eventOf("order:1"))
	waitFor(t, func() bool { return fast.count() == 2 })
}

func TestHub_PublishOrderFansOutToSession(t *testing.T) {
	hub := startHub(t)
	orderClient, sessionClient := &hubTestClient{}, &hubTestClient{}
	order := &domain.Order{ID: uuid.New(), OrderNumber: "DI-20261121-001", Items: []domain.OrderItem{{ID: uuid.New()}}}
	orderTopic := "order:" + order.ID.String()
	hub.Register(orderTopic, orderClient)
	hub.Register("session:tok", sessionClient)

	hub.PublishSession(context.Background(), "tok", domain.OrderEvent{Event: "order.created", Order: order})
	waitFor(t, func() bool { return orderClient.count() == 1 && sessionClient.count() == 1 })
}

func TestHub_ConcurrentPublishAndRegister(t *testing.T) {
	hub := startHub(t)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := &hubTestClient{}
			hub.Register("order:1", c)
			hub.Publish(eventOf("order:1"))
			hub.Unregister("order:1", c)
		}()
	}
	wg.Wait()
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	for i := 0; i < 2000; i++ {
		if cond() {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("condition not met in time")
}

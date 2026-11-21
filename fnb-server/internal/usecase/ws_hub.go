package usecase

import (
	"context"
	"encoding/json"
	"sync"

	"fnb-server/internal/domain"
)

type Client interface {
	Send(payload []byte) bool
	Close()
}

type Hub struct {
	mu       sync.RWMutex
	topics   map[string]map[Client]struct{}
	closed   bool
	messages chan domain.Event
	stop     chan struct{}
	done     chan struct{}
	once     sync.Once
}

func NewHub() *Hub {
	return &Hub{
		topics:   make(map[string]map[Client]struct{}),
		messages: make(chan domain.Event, 256),
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
	}
}

func (h *Hub) Run(ctx context.Context) {
	go func() {
		select {
		case <-ctx.Done():
			h.Close()
		case <-h.stop:
		}
	}()
	for {
		select {
		case ev := <-h.messages:
			h.broadcast(ev)
		case <-h.stop:
			close(h.done)
			return
		}
	}
}

func (h *Hub) Register(topic string, c Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return
	}
	if h.topics[topic] == nil {
		h.topics[topic] = make(map[Client]struct{})
	}
	h.topics[topic][c] = struct{}{}
}

func (h *Hub) Unregister(topic string, c Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.removeLocked(topic, c)
}

func (h *Hub) Publish(ev domain.Event) {
	h.mu.RLock()
	closed := h.closed
	h.mu.RUnlock()
	if closed {
		return
	}
	select {
	case h.messages <- ev:
	case <-h.stop:
	}
}

func (h *Hub) PublishOrder(ctx context.Context, ev domain.OrderEvent) {
	h.publishOrder(ctx, "", ev)
}

func (h *Hub) PublishSession(ctx context.Context, sessionToken string, ev domain.OrderEvent) {
	h.publishOrder(ctx, sessionToken, ev)
}

func (h *Hub) publishOrder(ctx context.Context, sessionToken string, ev domain.OrderEvent) {
	if ctx.Err() != nil || ev.Order == nil {
		return
	}
	data := domain.OrderEventDataFrom(ev.Order)
	targets := []string{"order:" + ev.Order.ID.String()}
	if sessionToken != "" {
		targets = append(targets, "session:"+sessionToken)
	}
	for _, topic := range targets {
		h.Publish(domain.Event{Topic: topic, Name: ev.Event, Data: data})
	}
}
func (h *Hub) Close() {
	h.mu.Lock()
	if h.closed {
		h.mu.Unlock()
		return
	}
	h.closed = true
	clients := make(map[Client]struct{})
	for _, set := range h.topics {
		for c := range set {
			clients[c] = struct{}{}
		}
	}
	h.topics = make(map[string]map[Client]struct{})
	h.mu.Unlock()

	h.once.Do(func() { close(h.stop) })
	for c := range clients {
		c.Close()
	}
}

func (h *Hub) broadcast(ev domain.Event) {
	payload, err := json.Marshal(wsEnvelope{Topic: ev.Topic, Event: ev.Name, Data: ev.Data})
	if err != nil {
		return
	}

	h.mu.RLock()
	clients := make([]Client, 0, len(h.topics[ev.Topic]))
	for c := range h.topics[ev.Topic] {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	var dead []Client
	for _, c := range clients {
		if !c.Send(payload) {
			dead = append(dead, c)
		}
	}
	if len(dead) == 0 {
		return
	}
	h.mu.Lock()
	for _, c := range dead {
		h.removeLocked(ev.Topic, c)
	}
	h.mu.Unlock()
	for _, c := range dead {
		c.Close()
	}
}

func (h *Hub) removeLocked(topic string, c Client) {
	set, ok := h.topics[topic]
	if !ok {
		return
	}
	delete(set, c)
	if len(set) == 0 {
		delete(h.topics, topic)
	}
}

type wsEnvelope struct {
	Topic string `json:"topic"`
	Event string `json:"event"`
	Data  any    `json:"data"`
}

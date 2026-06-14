package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

var RabbitConn *amqp.Connection
var RabbitChannel *amqp.Channel

const (
	ExchangeName       = "commerce.events"
	CartStabilityQueue = "cart.stability"
	ReplenishmentQueue = "replenishment.stats"

	RoutingKeyPriceChanged = "price.changed"
	RoutingKeyStockChanged = "stock.changed"
	RoutingKeyUserPurchase = "user.purchase"
)

type PriceChangedEvent struct {
	ProductID string  `json:"product_id"`
	OldPrice  float64 `json:"old_price"`
	NewPrice  float64 `json:"new_price"`
}

type StockChangedEvent struct {
	ProductID string `json:"product_id"`
	NewStock  int    `json:"new_stock"`
}

type UserPurchaseEvent struct {
	UserID    string `json:"user_id"`
	ProductID string `json:"product_id"`
	Timestamp int64  `json:"timestamp"`
}

func InitRabbitMQ() {
	url := os.Getenv("RABBITMQ_URL")
	if url == "" {
		url = "amqp://guest:guest@localhost:5672/"
	}

	var err error
	RabbitConn, err = amqp.Dial(url)
	if err != nil {
		log.Printf("Warning: RabbitMQ connection failed: %v", err)
		return
	}

	RabbitChannel, err = RabbitConn.Channel()
	if err != nil {
		log.Printf("Warning: Failed to open RabbitMQ channel: %v", err)
		return
	}

	// Declare topic exchange
	err = RabbitChannel.ExchangeDeclare(
		ExchangeName,
		"topic",
		true,  // durable
		false, // auto-deleted
		false, // internal
		false, // no-wait
		nil,
	)
	if err != nil {
		log.Printf("Warning: Failed to declare exchange: %v", err)
		return
	}

	// Declare queues
	declareQueue(CartStabilityQueue, []string{RoutingKeyPriceChanged, RoutingKeyStockChanged})
	declareQueue(ReplenishmentQueue, []string{RoutingKeyUserPurchase})

	fmt.Println("Successfully connected to RabbitMQ")
}

func declareQueue(queueName string, routingKeys []string) {
	q, err := RabbitChannel.QueueDeclare(
		queueName,
		true,  // durable
		false, // auto-delete
		false, // exclusive
		false, // no-wait
		nil,
	)
	if err != nil {
		log.Printf("Warning: Failed to declare queue %s: %v", queueName, err)
		return
	}

	for _, key := range routingKeys {
		err = RabbitChannel.QueueBind(q.Name, key, ExchangeName, false, nil)
		if err != nil {
			log.Printf("Warning: Failed to bind queue %s to key %s: %v", queueName, key, err)
		}
	}
}

func PublishEvent(routingKey string, payload interface{}) error {
	if RabbitChannel == nil {
		return fmt.Errorf("RabbitMQ channel not initialized")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return RabbitChannel.PublishWithContext(ctx,
		ExchangeName,
		routingKey,
		false, // mandatory
		false, // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		},
	)
}

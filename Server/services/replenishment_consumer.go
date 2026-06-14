package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"
)

func StartReplenishmentConsumer() {
	if RabbitChannel == nil {
		log.Println("Warning: Cannot start replenishment consumer - RabbitMQ not connected")
		return
	}

	msgs, err := RabbitChannel.Consume(
		ReplenishmentQueue,
		"",    // consumer tag
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,
	)
	if err != nil {
		log.Printf("Warning: Failed to start consuming from %s: %v", ReplenishmentQueue, err)
		return
	}

	go func() {
		for msg := range msgs {
			handleUserPurchase(msg.Body)
			msg.Ack(false)
		}
	}()

	fmt.Println("Replenishment consumer started")
}

func handleUserPurchase(body []byte) {
	var event UserPurchaseEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Error parsing user purchase event: %v", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	key := fmt.Sprintf("replenish:%s:%s", event.UserID, event.ProductID)
	timestamp := strconv.FormatInt(event.Timestamp, 10)

	// Increment count
	RedisClient.HIncrBy(ctx, key, "count", 1)

	// Set first_used only if not already set
	RedisClient.HSetNX(ctx, key, "first_used", timestamp)

	// Always update last_used
	RedisClient.HSet(ctx, key, "last_used", timestamp)

	// Set a long TTL so data persists for analysis (90 days)
	RedisClient.Expire(ctx, key, 90*24*time.Hour)

	log.Printf("Purchase event recorded: user=%s, product=%s", event.UserID, event.ProductID)
}

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func StartCartStabilityConsumer(client *mongo.Client) {
	if RabbitChannel == nil {
		log.Println("Warning: Cannot start cart stability consumer - RabbitMQ not connected")
		return
	}

	msgs, err := RabbitChannel.Consume(
		CartStabilityQueue,
		"",    // consumer tag
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,
	)
	if err != nil {
		log.Printf("Warning: Failed to start consuming from %s: %v", CartStabilityQueue, err)
		return
	}

	go func() {
		for msg := range msgs {
			switch msg.RoutingKey {
			case RoutingKeyPriceChanged:
				handlePriceChanged(client, msg.Body)
			case RoutingKeyStockChanged:
				handleStockChanged(client, msg.Body)
			}
			msg.Ack(false)
		}
	}()

	fmt.Println("Cart stability consumer started")
}

func handlePriceChanged(client *mongo.Client, body []byte) {
	var event PriceChangedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Error parsing price changed event: %v", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	prodID, err := bson.ObjectIDFromHex(event.ProductID)
	if err != nil {
		log.Printf("Invalid product ID in price event: %v", err)
		return
	}

	// Find all carts containing this product
	cartCollection := client.Database(getDatabaseName()).Collection("Carts")
	cursor, err := cartCollection.Find(ctx, bson.M{"items.product_id": prodID})
	if err != nil {
		log.Printf("Error finding affected carts: %v", err)
		return
	}
	defer cursor.Close(ctx)

	for cursor.Next(ctx) {
		var cart struct {
			UserID bson.ObjectID `bson:"user_id"`
		}
		if err := cursor.Decode(&cart); err != nil {
			continue
		}

		// Write stale flag to Redis
		key := fmt.Sprintf("stale:cart:%s", cart.UserID.Hex())
		staleData, _ := json.Marshal(map[string]interface{}{
			"type":      "price_changed",
			"old_price": event.OldPrice,
			"new_price": event.NewPrice,
		})
		RedisClient.HSet(ctx, key, event.ProductID, string(staleData))
		RedisClient.Expire(ctx, key, 24*time.Hour)
	}

	log.Printf("Price changed event processed: product=%s, %v -> %v", event.ProductID, event.OldPrice, event.NewPrice)
}

func handleStockChanged(client *mongo.Client, body []byte) {
	var event StockChangedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Error parsing stock changed event: %v", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	prodID, err := bson.ObjectIDFromHex(event.ProductID)
	if err != nil {
		log.Printf("Invalid product ID in stock event: %v", err)
		return
	}

	// Find all carts containing this product
	cartCollection := client.Database(getDatabaseName()).Collection("Carts")
	cursor, err := cartCollection.Find(ctx, bson.M{"items.product_id": prodID})
	if err != nil {
		log.Printf("Error finding affected carts: %v", err)
		return
	}
	defer cursor.Close(ctx)

	staleType := "low_stock"
	if event.NewStock == 0 {
		staleType = "out_of_stock"
	}

	for cursor.Next(ctx) {
		var cart struct {
			UserID bson.ObjectID `bson:"user_id"`
		}
		if err := cursor.Decode(&cart); err != nil {
			continue
		}

		key := fmt.Sprintf("stale:cart:%s", cart.UserID.Hex())
		staleData, _ := json.Marshal(map[string]interface{}{
			"type":      staleType,
			"available": event.NewStock,
		})
		RedisClient.HSet(ctx, key, event.ProductID, string(staleData))
		RedisClient.Expire(ctx, key, 24*time.Hour)
	}

	log.Printf("Stock changed event processed: product=%s, new_stock=%d", event.ProductID, event.NewStock)
}

func getDatabaseName() string {
	name := os.Getenv("DATABASE_NAME")
	if name == "" {
		name = "HackOn"
	}
	return name
}

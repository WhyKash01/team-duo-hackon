package services

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// HydrateInventory loads stock counts from MongoDB into Redis for atomic operations
func HydrateInventory(client *mongo.Client) {
	if RedisClient == nil {
		log.Println("Warning: Cannot hydrate inventory - Redis not connected")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	dbName := os.Getenv("DATABASE_NAME")
	if dbName == "" {
		dbName = "HackOn"
	}

	productCollection := client.Database(dbName).Collection("Products")
	cursor, err := productCollection.Find(ctx, bson.M{})
	if err != nil {
		log.Printf("Warning: Failed to query products for inventory hydration: %v", err)
		return
	}
	defer cursor.Close(ctx)

	count := 0
	for cursor.Next(ctx) {
		var product struct {
			ID    bson.ObjectID `bson:"_id"`
			Stock int           `bson:"stock"`
		}
		if err := cursor.Decode(&product); err != nil {
			continue
		}

		key := fmt.Sprintf("inventory:%s", product.ID.Hex())
		stock := product.Stock
		if stock == 0 {
			stock = 999 // default if not set
		}
		RedisClient.Set(ctx, key, stock, 0)
		count++
	}

	log.Printf("Inventory hydrated: %d products loaded into Redis", count)
}

// ReserveStock atomically decrements stock. Returns true if reservation succeeded.
func ReserveStock(productID string, qty int) (bool, error) {
	if RedisClient == nil {
		return true, nil // graceful fallback if Redis not available
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	key := fmt.Sprintf("inventory:%s", productID)

	// Use DECRBY atomically
	result, err := RedisClient.DecrBy(ctx, key, int64(qty)).Result()
	if err != nil {
		return false, fmt.Errorf("redis error: %v", err)
	}

	if result < 0 {
		// Oversold — restore stock
		RedisClient.IncrBy(ctx, key, int64(qty))
		return false, nil
	}

	return true, nil
}

// ReleaseStock restores stock (for failed orders or TTL expiry)
func ReleaseStock(productID string, qty int) {
	if RedisClient == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	key := fmt.Sprintf("inventory:%s", productID)
	RedisClient.IncrBy(ctx, key, int64(qty))
}

// GetStock returns current available stock from Redis
func GetStock(productID string) int {
	if RedisClient == nil {
		return 999
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	key := fmt.Sprintf("inventory:%s", productID)
	val, err := RedisClient.Get(ctx, key).Int()
	if err != nil {
		return 999 // default if not found
	}
	return val
}

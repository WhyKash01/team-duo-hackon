package services

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

func InitRedis() {
	addr := os.Getenv("REDIS_URL")
	if addr == "" {
		addr = "redis://localhost:6379"
	}

	opts, err := redis.ParseURL(addr)
	if err != nil {
		log.Printf("Warning: failed to parse REDIS_URL: %v", err)
		opts = &redis.Options{Addr: "localhost:6379"}
	}
	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second

	RedisClient = redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	} else {
		fmt.Println("Successfully connected to Redis")
	}
}

package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// DBInstance initializes the MongoDB client connection.
func DBInstance() *mongo.Client {
	err := godotenv.Load(".env")
	if err != nil {
		log.Println("Warning: unable to find .env file:", err)
	}

	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		log.Fatal("MONGODB_URI not set!")
	}
	fmt.Println("MongoDB URI: ", mongoURI)

	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(clientOptions)
	if err != nil {
		log.Fatalf("Error creating MongoDB client: %v", err)
	}

	// Verify MongoDB connection availability via ping
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Printf("Warning: MongoDB ping failed: %v", err)
	} else {
		fmt.Println("Successfully connected and pinged MongoDB")
	}

	return client
}

// Client is a global MongoDB client instance.
var Client *mongo.Client = DBInstance()

// OpenCollection returns a collection instance with fallback for nil clients.
func OpenCollection(collectionName string, client *mongo.Client) *mongo.Collection {
	if client == nil {
		client = Client
	}

	err := godotenv.Load(".env")
	if err != nil {
		log.Println("Warning: unable to find .env file:", err)
	}

	databaseName := os.Getenv("DATABASE_NAME")
	if databaseName == "" {
		databaseName = "hackon"
	}
	fmt.Println("DATABASE_NAME: ", databaseName)

	return client.Database(databaseName).Collection(collectionName)
}

// RedisClient is a global Redis client instance.
var RedisClient *redis.Client

// InitRedis initializes the Redis client connection.
func InitRedis() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379" // fallback for local dev
	}
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("Warning: failed to parse REDIS_URL: %v", err)
		opts = &redis.Options{Addr: "localhost:6379"}
	}
	RedisClient = redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := RedisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis ping failed. Rate limiter will be bypassed. Error: %v", err)
	} else {
		fmt.Println("Successfully connected to Redis")
	}
}

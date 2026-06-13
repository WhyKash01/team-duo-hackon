package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
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

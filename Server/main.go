package main

import (
	"log"

	"server/config"
	"server/database"
	"server/routes"
	"server/services"
)

func main() {
	// Load environment configuration
	cfg := config.LoadConfig()

	// Initialize Redis
	services.InitRedis()

	// Initialize RabbitMQ
	services.InitRabbitMQ()

	// Initialize LLM Client
	if err := services.InitLLM(); err != nil {
		log.Printf("LLM Initialization Error: %v", err)
	}

	// Hydrate inventory from MongoDB into Redis
	services.HydrateInventory(database.Client)

	// Start background consumers
	services.StartCartStabilityConsumer(database.Client)
	services.StartReplenishmentConsumer()

	// Set up the router
	r := routes.SetupRouter()

	// Run the HTTP server
	log.Printf("Server starting on port %s in %s mode...", cfg.Port, cfg.Env)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

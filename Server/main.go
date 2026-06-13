package main

import (
	"log"

	"server/config"
	"server/routes"
)

func main() {
	// Load environment configuration
	cfg := config.LoadConfig()

	// Set up the router
	r := routes.SetupRouter()

	// Run the HTTP server
	log.Printf("Server starting on port %s in %s mode...", cfg.Port, cfg.Env)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

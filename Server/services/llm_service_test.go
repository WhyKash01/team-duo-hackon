package services_test

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/joho/godotenv"
	"server/services"
)

func TestLLM(t *testing.T) {
	// Load .env from the parent directory
	err := godotenv.Load("../.env")
	if err != nil {
		t.Logf("Could not load .env: %v", err)
	}

	// Initialize the LLM Client
	if err := services.InitLLM(); err != nil {
		t.Fatalf("Failed to init LLM: %v", err)
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" || apiKey == "your_api_key_here" {
		t.Skip("Skipping test because real GEMINI_API_KEY is not set")
	}

	// Generate a response
	prompt := "Please reply with a short sentence: What is the capital of France?"
	fmt.Printf("Testing LLM with prompt: '%s'\n", prompt)
	
	resp, err := services.GenerateResponse(context.Background(), prompt)
	if err != nil {
		t.Fatalf("Failed to generate response: %v", err)
	}

	fmt.Println("\n=== LLM Response ===")
	fmt.Println(resp)
	fmt.Println("====================")
}

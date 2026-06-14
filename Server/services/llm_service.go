package services

import (
	"context"
	"fmt"
	"os"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

var LLMClient *genai.Client

func InitLLM() error {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" || apiKey == "your_api_key_here" {
		fmt.Println("Warning: GEMINI_API_KEY is not set or is still the placeholder. LLM functionalities may fail.")
		return nil
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return fmt.Errorf("failed to create GenAI client: %w", err)
	}

	LLMClient = client
	fmt.Println("Successfully initialized LLM Client (Google Generative AI).")
	return nil
}

func GenerateResponse(ctx context.Context, prompt string) (string, error) {
	if LLMClient == nil {
		return "", fmt.Errorf("LLMClient is not initialized - missing API key?")
	}

	model := LLMClient.GenerativeModel("gemini-2.5-flash")

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate content: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from model")
	}

	// Assuming the model returned text
	if textPart, ok := resp.Candidates[0].Content.Parts[0].(genai.Text); ok {
		return string(textPart), nil
	}

	return "", fmt.Errorf("unexpected response format")
}

package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"server/database"
	"server/models"
	"server/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func GetProducts(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "20")

		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 {
			limit = 20
		}

		productCollection := database.OpenCollection("Products", client)

		total, err := productCollection.CountDocuments(ctx, bson.D{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count products"})
			return
		}

		skip := int64((page - 1) * limit)
		findOptions := options.Find().
			SetSkip(skip).
			SetLimit(int64(limit))

		cursor, err := productCollection.Find(ctx, bson.D{}, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
			return
		}
		defer cursor.Close(ctx)

		var products []models.Product
		if err := cursor.All(ctx, &products); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse products list"})
			return
		}

		totalPages := (total + int64(limit) - 1) / int64(limit)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    products,
			"pagination": gin.H{
				"current_page": page,
				"limit":        limit,
				"total_items":  total,
				"total_pages":  totalPages,
			},
		})
	}
}

// GetProductByID retrieves a single product from the database by its ObjectID.
func GetProductByID(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		productIDHex := c.Param("id")
		objID, err := bson.ObjectIDFromHex(productIDHex)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID format"})
			return
		}

		productCollection := database.OpenCollection("Products", client)

		var product models.Product
		err = productCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&product)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product details"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    product,
		})
	}
}

// GetProductSubstitutes retrieves product substitutes by calling the ML Engine's /find-substitute endpoint.
func GetProductSubstitutes(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		productIDHex := c.Param("id")
		objID, err := bson.ObjectIDFromHex(productIDHex)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID format"})
			return
		}

		productCollection := database.OpenCollection("Products", client)

		var product models.Product
		err = productCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&product)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product details"})
			return
		}

		// Build the payload for ML Engine
		type MongoOid struct {
			Oid string `json:"$oid"`
		}
		type FastAPIProductPayload struct {
			IDObj       MongoOid `json:"_id"`
			Brand       string   `json:"Brand"`
			Product     string   `json:"Product"`
			Quantity    string   `json:"Quantity"`
			Price       float64  `json:"Price"`
			MRP         float64  `json:"MRP"`
			Category    string   `json:"Category"`
			SubCategory string   `json:"Sub-Category"`
			ImageSmall  string   `json:"image_small"`
			IDNum       int      `json:"id"`
		}

		payload := FastAPIProductPayload{
			IDObj: MongoOid{
				Oid: product.ID.Hex(),
			},
			Brand:       product.Brand,
			Product:     product.Name,
			Quantity:    product.Quantity,
			Price:       product.Price,
			MRP:         product.MRP,
			Category:    product.Category,
			SubCategory: product.SubCategory,
			ImageSmall:  product.ImageURL,
			IDNum:       product.IDNum,
		}

		jsonData, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal payload for ML Engine"})
			return
		}

		mlEngineURL := os.Getenv("ML_ENGINE_URL")
		if mlEngineURL == "" {
			mlEngineURL = "http://localhost:8000"
		}
		substituteURL := mlEngineURL + "/find-substitute"

		resp, err := http.Post(substituteURL, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call ML Engine /find-substitute: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from ML Engine"})
			return
		}

		var substituteResults []interface{}
		if err := json.Unmarshal(bodyBytes, &substituteResults); err != nil {
			c.JSON(resp.StatusCode, gin.H{
				"success":       resp.StatusCode >= 200 && resp.StatusCode < 300,
				"ml_engine_raw": string(bodyBytes),
			})
			return
		}

		c.JSON(resp.StatusCode, gin.H{
			"success": true,
			"data":    substituteResults,
		})
	}
}

// SearchProducts calls the ML engine /search endpoint to perform vector search.
func SearchProducts(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Search query 'q' is required"})
			return
		}

		type SearchQuery struct {
			Query string `json:"query"`
		}

		payload := SearchQuery{
			Query: query,
		}

		jsonData, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal payload for ML Engine"})
			return
		}

		mlEngineURL := os.Getenv("ML_ENGINE_URL")
		if mlEngineURL == "" {
			mlEngineURL = "http://localhost:8000"
		}
		searchURL := mlEngineURL + "/search"

		resp, err := http.Post(searchURL, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call ML Engine /search: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from ML Engine"})
			return
		}

		var searchResults []interface{}
		if err := json.Unmarshal(bodyBytes, &searchResults); err != nil {
			c.JSON(resp.StatusCode, gin.H{
				"success":       resp.StatusCode >= 200 && resp.StatusCode < 300,
				"ml_engine_raw": string(bodyBytes),
			})
			return
		}

		// Also try to find exact matches from mongo for top results? Or just return the semantic matches?
		// We'll just return the vector semantic matches, but let's query Mongo to get the full product details.

		var fullProducts []models.Product
		productCollection := database.OpenCollection("Products", client)

		for _, rawItem := range searchResults {
			itemMap, ok := rawItem.(map[string]interface{})
			if !ok {
				continue
			}
			idStr, ok := itemMap["id"].(string)
			if !ok {
				continue
			}
			objID, err := bson.ObjectIDFromHex(idStr)
			if err != nil {
				continue
			}
			var product models.Product
			err = productCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&product)
			if err == nil {
				// We can embed the match_score if needed, but for now we'll just return the full products
				fullProducts = append(fullProducts, product)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    fullProducts,
		})
	}
}

// SearchByCategory calls the ML engine /search-category endpoint to perform category vector search.
func SearchByCategory(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		category := c.Query("category")
		if category == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Search query 'category' is required"})
			return
		}

		type CategorySearchQuery struct {
			Category string `json:"category"`
		}

		payload := CategorySearchQuery{
			Category: category,
		}

		jsonData, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal payload for ML Engine"})
			return
		}

		mlEngineURL := os.Getenv("ML_ENGINE_URL")
		if mlEngineURL == "" {
			mlEngineURL = "http://localhost:8000"
		}
		searchURL := mlEngineURL + "/search-category"

		resp, err := http.Post(searchURL, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call ML Engine /search-category: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from ML Engine"})
			return
		}

		var searchResults []interface{}
		if err := json.Unmarshal(bodyBytes, &searchResults); err != nil {
			c.JSON(resp.StatusCode, gin.H{
				"success":       resp.StatusCode >= 200 && resp.StatusCode < 300,
				"ml_engine_raw": string(bodyBytes),
			})
			return
		}

		var objectIDs []bson.ObjectID
		for _, rawItem := range searchResults {
			itemMap, ok := rawItem.(map[string]interface{})
			if !ok {
				continue
			}
			idStr, ok := itemMap["id"].(string)
			if !ok {
				continue
			}
			objID, err := bson.ObjectIDFromHex(idStr)
			if err == nil {
				objectIDs = append(objectIDs, objID)
			}
		}

		var fullProducts []models.Product
		if len(objectIDs) > 0 {
			productCollection := database.OpenCollection("Products", client)
			cursor, err := productCollection.Find(ctx, bson.M{"_id": bson.M{"$in": objectIDs}})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products from database"})
				return
			}
			defer cursor.Close(ctx)

			if err = cursor.All(ctx, &fullProducts); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse products from database"})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    fullProducts,
		})
	}
}

// Helper to clean JSON string
func cleanJSON(input string) string {
	input = strings.TrimSpace(input)
	if strings.HasPrefix(input, "```json") {
		input = strings.TrimPrefix(input, "```json")
		input = strings.TrimSuffix(input, "```")
	} else if strings.HasPrefix(input, "```") {
		input = strings.TrimPrefix(input, "```")
		input = strings.TrimSuffix(input, "```")
	}
	return strings.TrimSpace(input)
}

// TaskOrientedShopping handles the LLM task generation and searching
func TaskOrientedShopping(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 60*time.Second) // generous timeout for LLM
		defer cancel()

		task := c.Query("task")
		if task == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Task query 'task' is required"})
			return
		}

		prompt := fmt.Sprintf(`You are a shopping assistant. A user wants to do the following task: "%s". 
Return a raw JSON array of 3 to 6 generic grocery item names needed to complete this task. 
Example: ["spaghetti", "eggs", "bacon", "parmesan cheese"]. 
Return ONLY the raw JSON array, no markdown formatting or explanations.`, task)

		llmResp, err := services.GenerateResponse(ctx, prompt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate LLM response: " + err.Error()})
			return
		}

		cleanStr := cleanJSON(llmResp)
		var items []string
		if err := json.Unmarshal([]byte(cleanStr), &items); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse LLM response", "raw_response": llmResp})
			return
		}

		mlEngineURL := os.Getenv("ML_ENGINE_URL")
		if mlEngineURL == "" {
			mlEngineURL = "http://localhost:8000"
		}
		searchURL := mlEngineURL + "/search"

		var fullProducts []models.Product
		productCollection := database.OpenCollection("Products", client)
		seenIDs := make(map[string]bool)

		for _, item := range items {
			type SearchQuery struct {
				Query string `json:"query"`
			}
			payload := SearchQuery{Query: item}
			jsonData, _ := json.Marshal(payload)

			resp, err := http.Post(searchURL, "application/json", bytes.NewBuffer(jsonData))
			if err != nil {
				continue // skip on failure
			}
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			var searchResults []interface{}
			if err := json.Unmarshal(bodyBytes, &searchResults); err == nil {
				// Take top 3 products per ingredient
				limit := 3
				for i, rawItem := range searchResults {
					if i >= limit {
						break
					}
					itemMap, ok := rawItem.(map[string]interface{})
					if !ok {
						continue
					}
					idStr, ok := itemMap["id"].(string)
					if !ok {
						continue
					}
					if seenIDs[idStr] {
						limit++ // Try to get another one if this is a duplicate
						continue
					}
					objID, err := bson.ObjectIDFromHex(idStr)
					if err != nil {
						continue
					}
					var product models.Product
					err = productCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&product)
					if err == nil {
						fullProducts = append(fullProducts, product)
						seenIDs[idStr] = true
					}
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"task":    task,
			"items":   items,
			"data":    fullProducts,
		})
	}
}

// GetTopCategories returns all categories by product count.
func GetTopCategories(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		productCollection := database.OpenCollection("Products", client)

		pipeline := mongo.Pipeline{
			{{Key: "$group", Value: bson.D{
				{Key: "_id", Value: "$Category"},
				{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
				{Key: "image", Value: bson.D{{Key: "$first", Value: "$image_small"}}},
			}}},
			{{Key: "$sort", Value: bson.D{{Key: "count", Value: -1}}}},
		}

		cursor, err := productCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to aggregate categories"})
			return
		}
		defer cursor.Close(ctx)

		var results []bson.M
		if err = cursor.All(ctx, &results); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse categories"})
			return
		}

		var categories []map[string]string
		for _, res := range results {
			if id, ok := res["_id"].(string); ok && id != "" {
				cat := map[string]string{"category": id}
				if img, ok := res["image"].(string); ok && img != "" {
					cat["image"] = img
				}
				categories = append(categories, cat)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    categories,
		})
	}
}

// GetProductsByCategories accepts a list of categories in the request body and returns matching products with pagination.
func GetProductsByCategories(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var req struct {
			Categories []string `json:"categories" binding:"required,min=1"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body. 'categories' array is required."})
			return
		}

		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "20")

		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 {
			limit = 20
		}

		productCollection := database.OpenCollection("Products", client)

		var products []models.Product
		
		// Use $in to match any of the provided categories
		filter := bson.M{"Category": bson.M{"$in": req.Categories}}
		
		total, err := productCollection.CountDocuments(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count products"})
			return
		}

		skip := int64((page - 1) * limit)
		findOptions := options.Find().
			SetSkip(skip).
			SetLimit(int64(limit))

		cursor, err := productCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
			return
		}
		defer cursor.Close(ctx)

		if err = cursor.All(ctx, &products); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse products"})
			return
		}

		// Ensure we don't return null for empty slices in JSON
		if products == nil {
			products = []models.Product{}
		}

		totalPages := (total + int64(limit) - 1) / int64(limit)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    products,
			"pagination": gin.H{
				"current_page": page,
				"limit":        limit,
				"total_items":  total,
				"total_pages":  totalPages,
			},
		})
	}
}

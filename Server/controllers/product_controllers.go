package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"server/database"
	"server/models"

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

// SeedMLEngine queries all products from MongoDB, builds the payload, and sends it to FastAPI /seed.
func SeedMLEngine(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Seeding 38k+ products can take some time to fetch and process in Go (though Go handles it very quickly).
		// We set a 2 minute timeout for safety.
		var ctx, cancel = context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		productCollection := database.OpenCollection("Products", client)

		cursor, err := productCollection.Find(ctx, bson.M{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products from MongoDB"})
			return
		}
		defer cursor.Close(ctx)

		var mongoProducts []models.Product
		if err := cursor.All(ctx, &mongoProducts); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse products list"})
			return
		}

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

		payload := make([]FastAPIProductPayload, len(mongoProducts))
		for i, p := range mongoProducts {
			payload[i] = FastAPIProductPayload{
				IDObj: MongoOid{
					Oid: p.ID.Hex(),
				},
				Brand:       p.Brand,
				Product:     p.Name,
				Quantity:    p.Quantity,
				Price:       p.Price,
				MRP:         p.MRP,
				Category:    p.Category,
				SubCategory: p.SubCategory,
				ImageSmall:  p.ImageURL,
				IDNum:       p.IDNum,
			}
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
		seedURL := mlEngineURL + "/seed"

		// Call the FastAPI /seed endpoint. Since it executes as a background task,
		// the HTTP call completes quickly.
		resp, err := http.Post(seedURL, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call ML Engine /seed API: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from ML Engine"})
			return
		}

		var statusJSON interface{}
		if err := json.Unmarshal(bodyBytes, &statusJSON); err != nil {
			c.JSON(resp.StatusCode, gin.H{
				"success":             resp.StatusCode >= 200 && resp.StatusCode < 300,
				"ml_engine_raw":       string(bodyBytes),
				"ml_engine_status_ok": resp.StatusCode == http.StatusAccepted || resp.StatusCode == http.StatusOK,
			})
			return
		}

		c.JSON(resp.StatusCode, gin.H{
			"success":             resp.StatusCode >= 200 && resp.StatusCode < 300,
			"ml_engine_response":  statusJSON,
			"ml_engine_status_ok": resp.StatusCode == http.StatusAccepted || resp.StatusCode == http.StatusOK,
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

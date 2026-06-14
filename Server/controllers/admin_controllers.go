package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"server/database"
	"server/models"
	"server/services"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

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

// UpdateProductPrice updates a product's price and publishes a price.changed event
func UpdateProductPrice(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			ProductID string  `json:"product_id" binding:"required"`
			NewPrice  float64 `json:"new_price" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: product_id and new_price required"})
			return
		}

		prodID, err := bson.ObjectIDFromHex(input.ProductID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID format"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		productCollection := database.OpenCollection("Products", client)

		// Get current product to capture old price
		var product models.Product
		err = productCollection.FindOne(ctx, bson.M{"_id": prodID}).Decode(&product)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product"})
			return
		}

		oldPrice := product.Price

		// Update price in MongoDB
		_, err = productCollection.UpdateOne(ctx, bson.M{"_id": prodID}, bson.M{
			"$set": bson.M{"price": input.NewPrice},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update price"})
			return
		}

		// Publish price changed event to RabbitMQ
		event := services.PriceChangedEvent{
			ProductID: input.ProductID,
			OldPrice:  oldPrice,
			NewPrice:  input.NewPrice,
		}
		if pubErr := services.PublishEvent(services.RoutingKeyPriceChanged, event); pubErr != nil {
			// Non-fatal: log and continue
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "Price updated but event publish failed",
				"data": gin.H{
					"product_id": input.ProductID,
					"old_price":  oldPrice,
					"new_price":  input.NewPrice,
				},
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Price updated and event published",
			"data": gin.H{
				"product_id": input.ProductID,
				"old_price":  oldPrice,
				"new_price":  input.NewPrice,
			},
		})
	}
}

// UpdateProductStock updates a product's stock and publishes a stock.changed event
func UpdateProductStock(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			ProductID string `json:"product_id" binding:"required"`
			NewStock  int    `json:"new_stock"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: product_id and new_stock required"})
			return
		}

		prodID, err := bson.ObjectIDFromHex(input.ProductID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID format"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		productCollection := database.OpenCollection("Products", client)

		// Update stock in MongoDB
		_, err = productCollection.UpdateOne(ctx, bson.M{"_id": prodID}, bson.M{
			"$set": bson.M{"stock": input.NewStock},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock"})
			return
		}

		// Update Redis inventory counter
		if services.RedisClient != nil {
			key := "inventory:" + input.ProductID
			services.RedisClient.Set(ctx, key, input.NewStock, 0)
		}

		// Publish stock changed event
		event := services.StockChangedEvent{
			ProductID: input.ProductID,
			NewStock:  input.NewStock,
		}
		services.PublishEvent(services.RoutingKeyStockChanged, event)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Stock updated and event published",
			"data": gin.H{
				"product_id": input.ProductID,
				"new_stock":  input.NewStock,
			},
		})
	}
}

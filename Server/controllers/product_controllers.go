package controllers

import (
	"context"
	"net/http"
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

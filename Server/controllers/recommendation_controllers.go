package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"server/database"
	"server/models"
	"server/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type RecommendationItem struct {
	ProductID          string         `json:"product_id"`
	Product            models.Product `json:"product"`
	Score              float64        `json:"score"`
	Urgency            string         `json:"urgency"`
	LastPurchasedDays  int            `json:"last_purchased_days_ago"`
	AvgIntervalDays    int            `json:"avg_interval_days"`
	PurchaseCount      int            `json:"purchase_count"`
}

// GetRecommendations computes replenishment scores from Redis stats and returns suggestions
func GetRecommendations(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get raw userId string from context (same format as stored in Redis)
		userIdVal, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userIDStr, ok := userIdVal.(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
			return
		}

		if services.RedisClient == nil {
			c.JSON(http.StatusOK, gin.H{"success": true, "data": []RecommendationItem{}})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// Scan for all replenishment keys for this user
		pattern := fmt.Sprintf("replenish:%s:*", userIDStr)
		var allKeys []string
		iter := services.RedisClient.Scan(ctx, 0, pattern, 100).Iterator()
		for iter.Next(ctx) {
			allKeys = append(allKeys, iter.Val())
		}

		if len(allKeys) == 0 {
			c.JSON(http.StatusOK, gin.H{"success": true, "data": []RecommendationItem{}})
			return
		}

		now := time.Now().Unix()
		var recommendations []RecommendationItem

		productCollection := database.OpenCollection("Products", client)

		for _, key := range allKeys {
			// Extract product_id from key "replenish:{user_id}:{product_id}"
			parts := strings.Split(key, ":")
			if len(parts) < 3 {
				continue
			}
			productID := parts[2]

			// Get hash fields
			vals, err := services.RedisClient.HGetAll(ctx, key).Result()
			if err != nil || len(vals) == 0 {
				continue
			}

			count, _ := strconv.Atoi(vals["count"])
			firstUsed, _ := strconv.ParseInt(vals["first_used"], 10, 64)
			lastUsed, _ := strconv.ParseInt(vals["last_used"], 10, 64)

			// Need at least 2 purchases to infer a pattern
			if count < 2 {
				continue
			}

			// Compute scoring per feature4.md formula
			avgInterval := float64(lastUsed-firstUsed) / float64(max(count-1, 1))
			gap := float64(now - lastUsed)

			var score float64
			if avgInterval > 0 {
				score = gap / avgInterval
			} else {
				score = 0
			}

			weightedScore := 0.6*score + 0.4*math.Log(float64(count)+1)

			// Only include if score suggests item may be needed
			if weightedScore < 0.5 {
				continue
			}

			// Determine urgency
			urgency := "low"
			if weightedScore >= 2.0 {
				urgency = "high"
			} else if weightedScore >= 1.2 {
				urgency = "medium"
			}

			// Fetch product details
			prodObjID, err := bson.ObjectIDFromHex(productID)
			if err != nil {
				continue
			}

			var product models.Product
			err = productCollection.FindOne(ctx, bson.M{"_id": prodObjID}).Decode(&product)
			if err != nil {
				continue
			}

			avgIntervalDays := int(avgInterval / 86400)
			if avgIntervalDays < 1 {
				avgIntervalDays = 1
			}

			lastPurchasedDays := int(gap / 86400)

			recommendations = append(recommendations, RecommendationItem{
				ProductID:         productID,
				Product:           product,
				Score:             math.Round(weightedScore*100) / 100,
				Urgency:           urgency,
				LastPurchasedDays: lastPurchasedDays,
				AvgIntervalDays:   avgIntervalDays,
				PurchaseCount:     count,
			})
		}

		// Sort by score descending
		sort.Slice(recommendations, func(i, j int) bool {
			return recommendations[i].Score > recommendations[j].Score
		})

		// Limit to top 10
		if len(recommendations) > 10 {
			recommendations = recommendations[:10]
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    recommendations,
		})
	}
}

// GetCartStatus returns stale items info for the authenticated user's cart
func GetCartStatus(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		if services.RedisClient == nil {
			c.JSON(http.StatusOK, gin.H{"success": true, "stale_items": []interface{}{}})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		key := fmt.Sprintf("stale:cart:%s", userID.Hex())
		staleMap, err := services.RedisClient.HGetAll(ctx, key).Result()
		if err != nil || len(staleMap) == 0 {
			c.JSON(http.StatusOK, gin.H{"success": true, "stale_items": []interface{}{}})
			return
		}

		type StaleItem struct {
			ProductID string      `json:"product_id"`
			Type      string      `json:"type"`
			OldPrice  interface{} `json:"old_price,omitempty"`
			NewPrice  interface{} `json:"new_price,omitempty"`
			Available interface{} `json:"available,omitempty"`
		}

		var staleItems []StaleItem
		for productID, dataStr := range staleMap {
			var data map[string]interface{}
			if err := json.Unmarshal([]byte(dataStr), &data); err != nil {
				continue
			}

			item := StaleItem{
				ProductID: productID,
				Type:      fmt.Sprintf("%v", data["type"]),
			}

			if data["old_price"] != nil {
				item.OldPrice = data["old_price"]
			}
			if data["new_price"] != nil {
				item.NewPrice = data["new_price"]
			}
			if data["available"] != nil {
				item.Available = data["available"]
			}

			staleItems = append(staleItems, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"stale_items": staleItems,
		})
	}
}

// ClearStaleItem removes a stale item notification after user acknowledges it
func ClearStaleItem(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		var input struct {
			ProductID string `json:"product_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "product_id required"})
			return
		}

		if services.RedisClient != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			key := fmt.Sprintf("stale:cart:%s", userID.Hex())
			services.RedisClient.HDel(ctx, key, input.ProductID)
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Stale notification cleared"})
	}
}

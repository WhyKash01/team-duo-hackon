package controllers

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"server/database"
	"server/models"
	"server/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func generateOrderID() string {
	timestamp := time.Now().UnixNano() / int64(time.Millisecond)
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	randomNum := r.Intn(900) + 100 // 3-digit random number
	return fmt.Sprintf("ORD-%d-%d", timestamp, randomNum)
}

func PlaceOrder(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var order models.Order
		if err := c.ShouldBindJSON(&order); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		order.UserID = userID

		var ctx, cancel = context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		productCollection := database.OpenCollection("Products", client)
		orderCollection := database.OpenCollection("Orders", client)

		var validatedItems []models.OrderItem
		var itemTotal float64 = 0

		for _, item := range order.Items {
			if item.ProductID == bson.NilObjectID {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID is required for all items"})
				return
			}
			if item.Quantity <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero"})
				return
			}

			var product models.Product
			err = productCollection.FindOne(ctx, bson.M{"_id": item.ProductID}).Decode(&product)
			if err != nil {
				if err == mongo.ErrNoDocuments {
					c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Product not found: %s", item.ProductID.Hex())})
					return
				}
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product details"})
				return
			}

			subtotal := float64(item.Quantity) * product.Price
			validatedItem := models.OrderItem{
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				UnitPrice: product.Price,
				Subtotal:  subtotal,
			}
			validatedItems = append(validatedItems, validatedItem)
			itemTotal += subtotal
		}

		// Calculate delivery fee
		var deliveryFee float64 = 39.0
		if itemTotal >= 499.0 {
			deliveryFee = 0.0
		}

		grandTotal := itemTotal + deliveryFee

		// Feature 5: Reserve stock atomically via Redis
		var reservedItems []struct {
			ProductID string
			Qty       int
		}
		for _, item := range validatedItems {
			ok, err := services.ReserveStock(item.ProductID.Hex(), item.Quantity)
			if err != nil || !ok {
				// Release all previously reserved items
				for _, reserved := range reservedItems {
					services.ReleaseStock(reserved.ProductID, reserved.Qty)
				}
				c.JSON(http.StatusConflict, gin.H{
					"success":           false,
					"error":             "out_of_stock",
					"unavailable_items": []string{item.ProductID.Hex()},
					"message":           fmt.Sprintf("Product %s is out of stock", item.ProductID.Hex()),
				})
				return
			}
			reservedItems = append(reservedItems, struct {
				ProductID string
				Qty       int
			}{item.ProductID.Hex(), item.Quantity})
		}

		// Initialize/override system fields
		order.ID = bson.NewObjectID()
		order.OrderID = generateOrderID()
		order.Status = "Success"
		order.Items = validatedItems
		order.ItemTotal = itemTotal
		order.DeliveryFee = deliveryFee
		order.GrandTotal = grandTotal
		order.CreatedAt = time.Now()
		order.UpdatedAt = time.Now()

		_, insertErr := orderCollection.InsertOne(ctx, order)
		if insertErr != nil {
			// Release stock if order insert fails
			for _, reserved := range reservedItems {
				services.ReleaseStock(reserved.ProductID, reserved.Qty)
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to place order"})
			return
		}

		// Feature 4: Publish purchase events for replenishment tracking
		for _, item := range order.Items {
			event := services.UserPurchaseEvent{
				UserID:    userID.Hex(),
				ProductID: item.ProductID.Hex(),
				Timestamp: time.Now().Unix(),
			}
			services.PublishEvent(services.RoutingKeyUserPurchase, event)
		}

		// Feature 5: Update MongoDB stock (eventual consistency)
		for _, item := range order.Items {
			productCollection.UpdateOne(ctx, bson.M{"_id": item.ProductID}, bson.M{
				"$inc": bson.M{"stock": -item.Quantity},
			})
			// Publish stock changed event for cart stability
			currentStock := services.GetStock(item.ProductID.Hex())
			if currentStock <= 5 {
				services.PublishEvent(services.RoutingKeyStockChanged, services.StockChangedEvent{
					ProductID: item.ProductID.Hex(),
					NewStock:  currentStock,
				})
			}
		}

		// Only remove ordered items from user's cart; keep other items intact
		cartCollection := database.OpenCollection("Carts", client)
		var userCart models.Cart
		if err = cartCollection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&userCart); err == nil {
			// Build a map of ordered product IDs → ordered quantities
			orderedQtyMap := make(map[string]int)
			for _, item := range order.Items {
				orderedQtyMap[item.ProductID.Hex()] = item.Quantity
			}

			// Walk existing cart items, reducing or dropping ordered products
			var updatedItems []models.OrderItem
			var newSubtotal float64 = 0.0
			for _, ci := range userCart.Items {
				idStr := ci.ProductID.Hex()
				if oQty, hit := orderedQtyMap[idStr]; hit {
					remaining := ci.Quantity - oQty
					if remaining > 0 {
						ci.Quantity = remaining
						ci.Subtotal = float64(remaining) * ci.UnitPrice
						updatedItems = append(updatedItems, ci)
						newSubtotal += ci.Subtotal
					}
					// if remaining <= 0: item is fully consumed, skip it
				} else {
					updatedItems = append(updatedItems, ci)
					newSubtotal += ci.Subtotal
				}
			}
			if updatedItems == nil {
				updatedItems = []models.OrderItem{}
			}
			_, _ = cartCollection.UpdateOne(
				ctx,
				bson.M{"user_id": userID},
				bson.M{"$set": bson.M{"items": updatedItems, "subtotal": newSubtotal}},
			)
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Order placed successfully",
			"data":    order,
		})
	}
}

func GetUserOrders(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orderCollection := database.OpenCollection("Orders", client)

		// Find orders for the user sorted by creation date descending
		opts := options.Find().SetSort(bson.M{"created_at": -1})
		cursor, err := orderCollection.Find(ctx, bson.M{"user_id": userID}, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
			return
		}
		defer cursor.Close(ctx)

		var orders []models.Order
		if err = cursor.All(ctx, &orders); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error parsing orders"})
			return
		}

		// Ensure we return empty array instead of null in JSON if no orders exist
		if orders == nil {
			orders = []models.Order{}
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    orders,
		})
	}
}

package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"server/database"
	"server/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func getUserObjectID(c *gin.Context) (bson.ObjectID, error) {
	userIdVal, exists := c.Get("userId")
	if !exists {
		return bson.NilObjectID, fmt.Errorf("unauthorized: user ID not found in context")
	}
	userIdStr, ok := userIdVal.(string)
	if !ok {
		return bson.NilObjectID, fmt.Errorf("unauthorized: user ID is not a string")
	}
	objID, err := bson.ObjectIDFromHex(userIdStr)
	if err != nil {
		return bson.NilObjectID, fmt.Errorf("invalid user ID format: %v", err)
	}
	return objID, nil
}

func getOrCreateCart(ctx context.Context, cartCollection *mongo.Collection, userID bson.ObjectID) (models.Cart, error) {
	var cart models.Cart
	err := cartCollection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&cart)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			cart = models.Cart{
				ID:     bson.NewObjectID(),
				UserID: userID,
				Items:  []models.OrderItem{},
			}
			_, insertErr := cartCollection.InsertOne(ctx, cart)
			if insertErr != nil {
				return models.Cart{}, insertErr
			}
			return cart, nil
		}
		return models.Cart{}, err
	}
	return cart, nil
}

// calculateCartSubtotal computes the sum of all order item subtotals in the cart.
func calculateCartSubtotal(cart *models.Cart) {
	var total float64 = 0
	for _, item := range cart.Items {
		total += item.Subtotal
	}
	cart.Subtotal = total
}

func GetCart(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		cartCollection := database.OpenCollection("Carts", client)
		cart, err := getOrCreateCart(ctx, cartCollection, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve or create cart"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    cart,
		})
	}
}

func AddToCart(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			ProductID string `json:"product_id" binding:"required"`
			Quantity  int    `json:"quantity" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
			return
		}

		if input.Quantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero"})
			return
		}

		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		prodID, err := bson.ObjectIDFromHex(input.ProductID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID format"})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		productCollection := database.OpenCollection("Products", client)
		var product models.Product
		err = productCollection.FindOne(ctx, bson.M{"_id": prodID}).Decode(&product)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product details"})
			return
		}

		// Check stock availability before adding
		if product.Stock <= 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Product is out of stock"})
			return
		}

		cartCollection := database.OpenCollection("Carts", client)
		cart, err := getOrCreateCart(ctx, cartCollection, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve or create cart"})
			return
		}

		// Check if adding would exceed available stock
		existingQty := 0
		found := false
		for i, item := range cart.Items {
			if item.ProductID == prodID {
				existingQty = item.Quantity
				if existingQty+input.Quantity > product.Stock {
					c.JSON(http.StatusConflict, gin.H{
						"error":     fmt.Sprintf("Only %d units available (you have %d in cart)", product.Stock, existingQty),
						"available": product.Stock,
					})
					return
				}
				cart.Items[i].Quantity += input.Quantity
				cart.Items[i].Subtotal = float64(cart.Items[i].Quantity) * item.UnitPrice
				found = true
				break
			}
		}

		if !found {
			if input.Quantity > product.Stock {
				c.JSON(http.StatusConflict, gin.H{
					"error":     fmt.Sprintf("Only %d units available", product.Stock),
					"available": product.Stock,
				})
				return
			}
			newItem := models.OrderItem{
				ProductID:  prodID,
				Quantity:   input.Quantity,
				UnitPrice:  product.Price,
				PriceAtAdd: product.Price,
				Subtotal:   float64(input.Quantity) * product.Price,
			}
			cart.Items = append(cart.Items, newItem)
		}

		calculateCartSubtotal(&cart)
		_, updateErr := cartCollection.UpdateOne(
			ctx,
			bson.M{"user_id": userID},
			bson.M{"$set": bson.M{"items": cart.Items, "subtotal": cart.Subtotal}},
		)
		if updateErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cart"})
			return
		}

		err = cartCollection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&cart)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated cart details"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Item added to cart successfully",
			"data":    cart,
		})
	}
}

func UpdateCartItem(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			ProductID string `json:"product_id" binding:"required"`
			Quantity  int    `json:"quantity"` // can be 0 or negative to remove
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
			return
		}

		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		prodID, err := bson.ObjectIDFromHex(input.ProductID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID format"})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		cartCollection := database.OpenCollection("Carts", client)
		cart, err := getOrCreateCart(ctx, cartCollection, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve or create cart"})
			return
		}

		var updatedItems []models.OrderItem
		found := false

		for _, item := range cart.Items {
			if item.ProductID == prodID {
				found = true
				if input.Quantity > 0 {
					// Check stock limit
					productCollection := database.OpenCollection("Products", client)
					var product models.Product
					if pErr := productCollection.FindOne(ctx, bson.M{"_id": prodID}).Decode(&product); pErr == nil {
						if input.Quantity > product.Stock {
							c.JSON(http.StatusConflict, gin.H{
								"error":     fmt.Sprintf("Only %d units available", product.Stock),
								"available": product.Stock,
							})
							return
						}
					}
					item.Quantity = input.Quantity
					item.Subtotal = float64(input.Quantity) * item.UnitPrice
					updatedItems = append(updatedItems, item)
				}
				// if input.Quantity <= 0, the item is removed by skipping
			} else {
				updatedItems = append(updatedItems, item)
			}
		}

		// If the product was not in the cart and quantity > 0, we can add it
		if !found && input.Quantity > 0 {
			productCollection := database.OpenCollection("Products", client)
			var product models.Product
			err = productCollection.FindOne(ctx, bson.M{"_id": prodID}).Decode(&product)
			if err != nil {
				if err == mongo.ErrNoDocuments {
					c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
					return
				}
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product details"})
				return
			}

			if product.Stock <= 0 {
				c.JSON(http.StatusConflict, gin.H{"error": "Product is out of stock"})
				return
			}
			if input.Quantity > product.Stock {
				c.JSON(http.StatusConflict, gin.H{
					"error":     fmt.Sprintf("Only %d units available", product.Stock),
					"available": product.Stock,
				})
				return
			}

			newItem := models.OrderItem{
				ProductID:  prodID,
				Quantity:   input.Quantity,
				UnitPrice:  product.Price,
				PriceAtAdd: product.Price,
				Subtotal:   float64(input.Quantity) * product.Price,
			}
			updatedItems = append(updatedItems, newItem)
		}

		cart.Items = updatedItems
		calculateCartSubtotal(&cart)
		_, updateErr := cartCollection.UpdateOne(
			ctx,
			bson.M{"user_id": userID},
			bson.M{"$set": bson.M{"items": cart.Items, "subtotal": cart.Subtotal}},
		)
		if updateErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cart"})
			return
		}

		// Fetch the freshly updated cart
		err = cartCollection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&cart)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated cart details"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Cart item updated successfully",
			"data":    cart,
		})
	}
}

// RemoveCartItem removes an item completely from the authenticated user's cart.
func RemoveCartItem(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		productIDHex := c.Param("product_id")
		prodID, err := bson.ObjectIDFromHex(productIDHex)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID format"})
			return
		}

		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		cartCollection := database.OpenCollection("Carts", client)
		cart, err := getOrCreateCart(ctx, cartCollection, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve or create cart"})
			return
		}

		var updatedItems []models.OrderItem
		for _, item := range cart.Items {
			if item.ProductID != prodID {
				updatedItems = append(updatedItems, item)
			}
		}

		cart.Items = updatedItems
		calculateCartSubtotal(&cart)
		_, updateErr := cartCollection.UpdateOne(
			ctx,
			bson.M{"user_id": userID},
			bson.M{"$set": bson.M{"items": cart.Items, "subtotal": cart.Subtotal}},
		)
		if updateErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cart"})
			return
		}

		// Fetch updated cart
		err = cartCollection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&cart)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated cart details"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Item removed from cart successfully",
			"data":    cart,
		})
	}
}

// ClearCart empties all items in the user's cart.
func ClearCart(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := getUserObjectID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		cartCollection := database.OpenCollection("Carts", client)
		_, updateErr := cartCollection.UpdateOne(
			ctx,
			bson.M{"user_id": userID},
			bson.M{"$set": bson.M{"items": []models.OrderItem{}, "subtotal": float64(0)}},
		)
		if updateErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear cart"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Cart cleared successfully",
		})
	}
}

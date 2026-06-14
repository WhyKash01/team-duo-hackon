package controllers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"server/database"
	"server/models"
	"server/utils"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	HashPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(HashPassword), nil
}

func RegisterUser(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user models.User

		if err := c.ShouldBindJSON(&user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
			return
		}
		validate := validator.New()

		if err := validate.Struct(user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
			return
		}

		hashedPassword, err := HashPassword(user.Password)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to hash password"})
			return
		}

		var ctx, cancel = context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		count, err := userCollection.CountDocuments(ctx, bson.D{{Key: "email", Value: user.Email}})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing user"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
			return
		}
		user.UserID = bson.NewObjectID().Hex()
		user.CreatedAt = time.Now()
		user.UpdatedAt = time.Now()
		user.Password = hashedPassword

		result, err := userCollection.InsertOne(ctx, user)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		c.JSON(http.StatusCreated, result)

	}
}

func LoginUser(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userLogin models.UserLogin

		if err := c.ShouldBindJSON(&userLogin); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalide input data"})
			return
		}

		var ctx, cancel = context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		var foundUser models.User
		err := userCollection.FindOne(ctx, bson.D{{Key: "email", Value: userLogin.Email}}).Decode(&foundUser)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}

		err = bcrypt.CompareHashAndPassword([]byte(foundUser.Password), []byte(userLogin.Password))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}

		token, refreshToken, err := utils.GenerateAllTokens(foundUser.Email, foundUser.FirstName, foundUser.LastName, foundUser.Role, foundUser.UserID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
			return
		}

		err = utils.UpdateAllTokens(foundUser.UserID, token, refreshToken, client)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tokens"})
			return
		}
		domain := os.Getenv("DOMAIN")
		if domain == "" {
			domain = "localhost"
		}
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "access_token",
			Value:    token,
			Path:     "/",
			Domain:   domain,
			MaxAge:   86400,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "refresh_token",
			Value:    refreshToken,
			Path:     "/",
			Domain:   domain,
			MaxAge:   604800,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})

		c.JSON(http.StatusOK, models.UserResponse{
			UserId:       foundUser.UserID,
			FirstName:    foundUser.FirstName,
			LastName:     foundUser.LastName,
			Email:        foundUser.Email,
			Role:         foundUser.Role,
			Token:        token,
			RefreshToken: refreshToken,
			Addresses:    foundUser.Addresses,
		})

	}
}

func LogoutHandler(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {

		var UserLogout struct {
			UserId string `json:"user_id"`
		}

		err := c.ShouldBindJSON(&UserLogout)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		fmt.Println("User ID from Logout request:", UserLogout.UserId)

		err = utils.UpdateAllTokens(UserLogout.UserId, "", "", client) // Clear tokens in the database
		// Optionally, you can also remove the user session from the database if needed

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error logging out"})
			return
		}
		// c.SetCookie(
		// 	"access_token",
		// 	"",
		// 	-1, // MaxAge negative → delete immediately
		// 	"/",
		// 	"localhost", // Adjust to your domain
		// 	true,        // Use true in production with HTTPS
		// 	true,        // HttpOnly
		// )
		domain := os.Getenv("DOMAIN")
		if domain == "" {
			domain = "localhost"
		}
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "access_token",
			Value:    "",
			Path:     "/",
			Domain:   domain,
			MaxAge:   -1,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})

		// // Clear the refresh_token cookie
		// c.SetCookie(
		// 	"refresh_token",
		// 	"",
		// 	-1,
		// 	"/",
		// 	"localhost",
		// 	true,
		// 	true,
		// )
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "refresh_token",
			Value:    "",
			Path:     "/",
			Domain:   domain,
			MaxAge:   -1,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})

		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
	}
}

func RefreshTokenHandler(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(c, 100*time.Second)
		defer cancel()

		refreshToken, err := c.Cookie("refresh_token")

		if err != nil {
			fmt.Println("error", err.Error())
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unable to retrieve refresh token from cookie"})
			return
		}

		claim, err := utils.ValidateRefreshToken(refreshToken)
		if err != nil || claim == nil {
			fmt.Println("error", err.Error())
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
			return
		}

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		var user models.User
		err = userCollection.FindOne(ctx, bson.D{{Key: "user_id", Value: claim.UserId}}).Decode(&user)

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		newToken, newRefreshToken, _ := utils.GenerateAllTokens(user.Email, user.FirstName, user.LastName, user.Role, user.UserID)
		err = utils.UpdateAllTokens(user.UserID, newToken, newRefreshToken, client)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating tokens"})
			return
		}

		domain := os.Getenv("DOMAIN")
		if domain == "" {
			domain = "localhost"
		}
		c.SetCookie("access_token", newToken, 86400, "/", domain, true, true)          // expires in 24 hours
		c.SetCookie("refresh_token", newRefreshToken, 604800, "/", domain, true, true) //expires in 1 week

		c.JSON(http.StatusOK, gin.H{"message": "Tokens refreshed"})
	}
}

// GetFavCategories retrieves the user's favorite categories.
func GetFavCategories(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		favCollection := database.OpenCollection("favCategory", client)

		var fav models.FavCategory
		err := favCollection.FindOne(ctx, bson.M{"user_id": userIDStr}).Decode(&fav)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve favorite categories"})
			return
		}

		if fav.Categories == nil {
			fav.Categories = []string{}
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": fav.Categories})
	}
}

// AddFavCategory adds a single category to the user's favorites.
func AddFavCategory(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req struct {
			Category string `json:"category" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request. 'category' string is required."})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		favCollection := database.OpenCollection("favCategory", client)

		// Upsert: Create if doesn't exist, addToSet ensures uniqueness
		filter := bson.M{"user_id": userIDStr}
		update := bson.M{
			"$addToSet": bson.M{"categories": req.Category},
		}

		opts := options.UpdateOne().SetUpsert(true)
		_, err := favCollection.UpdateOne(ctx, filter, update, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add favorite category"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Category added to favorites"})
	}
}

// RemoveFavCategory removes a single category from the user's favorites.
func RemoveFavCategory(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		category := c.Param("category")
		if category == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Category parameter is required"})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		favCollection := database.OpenCollection("favCategory", client)

		filter := bson.M{"user_id": userIDStr}
		update := bson.M{
			"$pull": bson.M{"categories": category},
		}

		_, err := favCollection.UpdateOne(ctx, filter, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove favorite category"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Category removed from favorites"})
	}
}

// UpdateFavCategories replaces the entire array of favorite categories.
func UpdateFavCategories(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req struct {
			Categories []string `json:"categories" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request. 'categories' array is required."})
			return
		}

		var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		favCollection := database.OpenCollection("favCategory", client)

		filter := bson.M{"user_id": userIDStr}
		update := bson.M{
			"$set": bson.M{"categories": req.Categories},
		}

		opts := options.UpdateOne().SetUpsert(true)
		_, err := favCollection.UpdateOne(ctx, filter, update, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update favorite categories"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Favorite categories updated"})
	}
}

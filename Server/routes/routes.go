package routes

import (
	"server/controllers"
	"server/database"
	"server/middleware"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()
	var client *mongo.Client = database.DBInstance()
	
	// Initialize Redis for rate limiting
	database.InitRedis()
	
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.RateLimiter(database.RedisClient))

	// Unprotected Routes
	api := r.Group("/api")
	{
		api.GET("/ping", controllers.PingHandler)
		api.POST("/register", controllers.RegisterUser(client))
		api.POST("/login", controllers.LoginUser(client))
		api.POST("/refresh", controllers.RefreshTokenHandler(client))

		// Product catalog routes
		api.GET("/products", controllers.GetProducts(client))
		api.GET("/search", controllers.SearchProducts(client))
		api.GET("/search-category", controllers.SearchByCategory(client))
		api.POST("/products/categories", controllers.GetProductsByCategories(client))
		api.POST("/products/batch", controllers.GetProductsByIDs(client))
		api.GET("/categories/top", controllers.GetTopCategories(client))
		api.GET("/products/:id", controllers.GetProductByID(client))
		api.GET("/products/:id/substitutes", controllers.GetProductSubstitutes(client))
		api.GET("/task-shopping", controllers.TaskOrientedShopping(client))

		// Admin routes (unprotected for demo purposes)
		api.POST("/admin/update-price", controllers.UpdateProductPrice(client))
		api.POST("/admin/update-stock", controllers.UpdateProductStock(client))
		api.POST("/admin/seed-ml", controllers.SeedMLEngine(client))
	}

	// Protected Routes (requires AuthMiddleware)
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.POST("/logout", controllers.LogoutHandler(client))

		// Favorite Category endpoints
		protected.GET("/user/fav-categories", controllers.GetFavCategories(client))
		protected.POST("/user/fav-categories", controllers.AddFavCategory(client))
		protected.PUT("/user/fav-categories", controllers.UpdateFavCategories(client))
		protected.DELETE("/user/fav-categories/:category", controllers.RemoveFavCategory(client))

		// Cart management endpoints
		protected.GET("/cart", controllers.GetCart(client))
		protected.POST("/cart/add", controllers.AddToCart(client))
		protected.POST("/cart/update", controllers.UpdateCartItem(client))
		protected.DELETE("/cart/remove/:product_id", controllers.RemoveCartItem(client))
		protected.DELETE("/cart/clear", controllers.ClearCart(client))

		// Cart stability endpoints
		protected.GET("/cart/status", controllers.GetCartStatus(client))
		protected.POST("/cart/clear-stale", controllers.ClearStaleItem(client))

		// Order management endpoints
		protected.POST("/order/place", controllers.PlaceOrder(client))
		protected.GET("/orders", controllers.GetUserOrders(client))

		// Recommendation endpoints
		protected.GET("/recommendations", controllers.GetRecommendations(client))
	}

	return r
}

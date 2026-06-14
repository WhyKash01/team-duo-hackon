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
	r.Use(middleware.CORSMiddleware())

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
		api.GET("/products/:id", controllers.GetProductByID(client))
		api.GET("/products/:id/substitutes", controllers.GetProductSubstitutes(client))

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

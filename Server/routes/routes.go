package routes

import (
	"server/controllers"
	"server/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRouter initializes standard middleware and defines routing rules.
func SetupRouter() *gin.Engine {
	r := gin.Default()

	// Use custom CORS middleware
	r.Use(middleware.CORSMiddleware())

	// Set up API routes
	api := r.Group("/api")
	{
		api.GET("/ping", controllers.PingHandler)
	}

	return r
}

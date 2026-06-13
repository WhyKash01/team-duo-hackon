package controllers

import (
	"net/http"
	"time"

	"server/models"

	"github.com/gin-gonic/gin"
)

// PingHandler handles request to check the server's availability.
func PingHandler(c *gin.Context) {
	c.JSON(http.StatusOK, models.JSONResponse{
		Success: true,
		Message: "pong",
		Data: gin.H{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   "1.0.0",
		},
	})
}

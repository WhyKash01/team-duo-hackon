package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimiter uses Redis to limit requests per IP address to prevent bot abuse.
// It allows 100 requests per minute per IP.
func RateLimiter(client *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// If Redis isn't connected (e.g. local dev without Redis), bypass rate limiting
		if client == nil {
			c.Next()
			return
		}

		ip := c.ClientIP()
		key := "rate_limit:" + ip

		ctx := context.Background()

		// Increment the request count for this IP
		count, err := client.Incr(ctx, key).Result()
		if err != nil {
			// On Redis failure, fail open to avoid breaking the app
			c.Next()
			return
		}

		// Set expiry to 1 minute on the first request
		if count == 1 {
			client.Expire(ctx, key, time.Minute)
		}

		// Check against the limit (100 requests per minute)
		if count > 100 {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "Too many requests. Please slow down.",
			})
			return
		}

		c.Next()
	}
}

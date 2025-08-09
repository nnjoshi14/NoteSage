package middleware

import (
	"net/http"
	"strings"

	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func CORS() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})
}

func Logger() gin.HandlerFunc {
	return gin.Logger()
}

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		var tokenString string

		// For WebSocket connections, check query parameter first
		if c.Request.Header.Get("Upgrade") == "websocket" {
			tokenString = c.Query("token")
			if tokenString == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token query parameter required for WebSocket"})
				c.Abort()
				return
			}
		} else {
			// For regular HTTP requests, use Authorization header
			authHeader := c.GetHeader("Authorization")
			if authHeader == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
				c.Abort()
				return
			}

			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Bearer token required"})
				c.Abort()
				return
			}
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			c.Set("userID", claims["user_id"])
			c.Set("username", claims["username"])
			c.Set("role", claims["role"])
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		c.Next()
	})
}

// RequireRole middleware ensures the user has the required role
func RequireRole(requiredRole models.UserRole) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
			c.Abort()
			return
		}

		userRole := models.UserRole(role.(string))
		if userRole != requiredRole {
			// Admin can access everything
			if userRole != models.RoleAdmin {
				c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
				c.Abort()
				return
			}
		}

		c.Next()
	})
}

// RequireAdmin middleware ensures the user is an admin
func RequireAdmin() gin.HandlerFunc {
	return RequireRole(models.RoleAdmin)
}

package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtSecret := "test-secret"

	tests := []struct {
		name           string
		authHeader     string
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "No Authorization Header",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Authorization header required",
		},
		{
			name:           "Invalid Bearer Format",
			authHeader:     "InvalidToken",
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Bearer token required",
		},
		{
			name:           "Invalid Token",
			authHeader:     "Bearer invalid.token.here",
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid token",
		},
		{
			name:           "Valid Token",
			authHeader:     "Bearer " + generateValidToken(jwtSecret),
			expectedStatus: http.StatusOK,
			expectedError:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(AuthMiddleware(jwtSecret))
			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			req, _ := http.NewRequest("GET", "/test", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.expectedError != "" {
				assert.Contains(t, w.Body.String(), tt.expectedError)
			}
		})
	}
}

func TestRequireRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtSecret := "test-secret"

	tests := []struct {
		name           string
		userRole       models.UserRole
		requiredRole   models.UserRole
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "User accessing user endpoint",
			userRole:       models.RoleUser,
			requiredRole:   models.RoleUser,
			expectedStatus: http.StatusOK,
			expectedError:  "",
		},
		{
			name:           "User accessing admin endpoint",
			userRole:       models.RoleUser,
			requiredRole:   models.RoleAdmin,
			expectedStatus: http.StatusForbidden,
			expectedError:  "Insufficient permissions",
		},
		{
			name:           "Admin accessing user endpoint",
			userRole:       models.RoleAdmin,
			requiredRole:   models.RoleUser,
			expectedStatus: http.StatusOK,
			expectedError:  "",
		},
		{
			name:           "Admin accessing admin endpoint",
			userRole:       models.RoleAdmin,
			requiredRole:   models.RoleAdmin,
			expectedStatus: http.StatusOK,
			expectedError:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(AuthMiddleware(jwtSecret))
			router.Use(RequireRole(tt.requiredRole))
			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			token := generateTokenWithRole(jwtSecret, tt.userRole)
			req, _ := http.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", "Bearer "+token)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.expectedError != "" {
				assert.Contains(t, w.Body.String(), tt.expectedError)
			}
		})
	}
}

func TestRequireAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtSecret := "test-secret"

	tests := []struct {
		name           string
		userRole       models.UserRole
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "User accessing admin endpoint",
			userRole:       models.RoleUser,
			expectedStatus: http.StatusForbidden,
			expectedError:  "Insufficient permissions",
		},
		{
			name:           "Admin accessing admin endpoint",
			userRole:       models.RoleAdmin,
			expectedStatus: http.StatusOK,
			expectedError:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(AuthMiddleware(jwtSecret))
			router.Use(RequireAdmin())
			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			token := generateTokenWithRole(jwtSecret, tt.userRole)
			req, _ := http.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", "Bearer "+token)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.expectedError != "" {
				assert.Contains(t, w.Body.String(), tt.expectedError)
			}
		})
	}
}

func TestCORS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Test OPTIONS request
	req, _ := http.NewRequest("OPTIONS", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")

	// Test regular request
	req, _ = http.NewRequest("GET", "/test", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
}

// Helper functions
func generateValidToken(secret string) string {
	claims := jwt.MapClaims{
		"user_id":  "test-user-id",
		"username": "testuser",
		"role":     string(models.RoleUser),
		"exp":      time.Now().Add(time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(secret))
	return tokenString
}

func generateTokenWithRole(secret string, role models.UserRole) string {
	claims := jwt.MapClaims{
		"user_id":  "test-user-id",
		"username": "testuser",
		"role":     string(role),
		"exp":      time.Now().Add(time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(secret))
	return tokenString
}
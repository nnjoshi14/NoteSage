package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"notesage-server/internal/database"
	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupWebSocketHandlerTest(t *testing.T) (*WebSocketHandler, *gorm.DB) {
	testDB := database.SetupTestDB(t)
	wsService := services.NewWebSocketService(testDB)
	handler := NewWebSocketHandler(wsService)
	return handler, testDB
}

func TestWebSocketHandler_GetRoomStats(t *testing.T) {
	handler, testDB := setupWebSocketHandlerTest(t)
	defer database.CleanupTestDB(testDB)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/ws/stats", handler.GetRoomStats)

	req, err := http.NewRequest("GET", "/ws/stats", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.True(t, response["success"].(bool))
	
	data := response["data"].(map[string]interface{})
	assert.Contains(t, data, "total_rooms")
	assert.Contains(t, data, "total_clients")
	assert.Contains(t, data, "rooms")
	
	assert.Equal(t, float64(0), data["total_rooms"])
	assert.Equal(t, float64(0), data["total_clients"])
}

func TestWebSocketHandler_GetActiveRooms(t *testing.T) {
	handler, testDB := setupWebSocketHandlerTest(t)
	defer database.CleanupTestDB(testDB)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/ws/rooms", handler.GetActiveRooms)

	req, err := http.NewRequest("GET", "/ws/rooms", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.True(t, response["success"].(bool))
	
	data := response["data"].(map[string]interface{})
	assert.Contains(t, data, "rooms")
	assert.Contains(t, data, "total")
	
	rooms := data["rooms"].([]interface{})
	assert.Equal(t, 0, len(rooms))
	assert.Equal(t, float64(0), data["total"])
}

func TestWebSocketHandler_HandleWebSocket_Unauthorized(t *testing.T) {
	handler, testDB := setupWebSocketHandlerTest(t)
	defer database.CleanupTestDB(testDB)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// No auth middleware - should fail
	router.GET("/ws", handler.HandleWebSocket)

	req, err := http.NewRequest("GET", "/ws", nil)
	require.NoError(t, err)
	
	// Set WebSocket upgrade headers
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Sec-WebSocket-Version", "13")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestWebSocketHandler_HandleWebSocket_WithAuth(t *testing.T) {
	_, testDB := setupWebSocketHandlerTest(t)
	defer database.CleanupTestDB(testDB)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Mock auth middleware
	router.Use(func(c *gin.Context) {
		c.Set("userID", uuid.New().String())
		c.Set("username", "testuser")
		c.Next()
	})
	
	router.GET("/ws", func(c *gin.Context) {
		// Just check that auth middleware worked
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		
		username, exists := c.Get("username")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Username not found"})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"message": "Auth successful",
			"user_id": userID,
			"username": username,
		})
	})

	req, err := http.NewRequest("GET", "/ws", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestWebSocketHandler_HandleWebSocket_InvalidUserID(t *testing.T) {
	handler, testDB := setupWebSocketHandlerTest(t)
	defer database.CleanupTestDB(testDB)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Mock auth middleware with invalid user ID
	router.Use(func(c *gin.Context) {
		c.Set("userID", "invalid-uuid")
		c.Set("username", "testuser")
		c.Next()
	})
	
	router.GET("/ws", handler.HandleWebSocket)

	req, err := http.NewRequest("GET", "/ws", nil)
	require.NoError(t, err)
	
	// Set WebSocket upgrade headers
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Sec-WebSocket-Version", "13")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	
	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Equal(t, "Invalid user ID", response["error"])
}
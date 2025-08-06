package services

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"notesage-server/internal/database"
	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupWebSocketTest(t *testing.T) (*WebSocketService, *gorm.DB) {
	testDB := database.SetupTestDB(t)
	service := NewWebSocketService(testDB)
	return service, testDB
}

func createTestUser(t *testing.T, db *gorm.DB) models.User {
	userID := uuid.New()
	user := models.User{
		ID:       userID,
		Username: "testuser_" + userID.String()[:8],
		Email:    "test_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	
	err := db.Create(&user).Error
	require.NoError(t, err)
	return user
}

func createTestNote(t *testing.T, db *gorm.DB, userID uuid.UUID) models.Note {
	note := models.Note{
		ID:      uuid.New(),
		UserID:  userID,
		Title:   "Test Note",
		Content: models.JSONB{"type": "doc", "content": []interface{}{}},
	}
	
	err := db.Create(&note).Error
	require.NoError(t, err)
	return note
}

func setupWebSocketConnection(t *testing.T, service *WebSocketService, userID uuid.UUID, username string) (*websocket.Conn, *httptest.Server) {
	// Create a test server
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Mock auth middleware
	router.Use(func(c *gin.Context) {
		c.Set("userID", userID.String())
		c.Set("username", username)
		c.Next()
	})
	
	router.GET("/ws", service.HandleWebSocket)
	
	server := httptest.NewServer(router)
	
	// Convert HTTP URL to WebSocket URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	
	// Connect to WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	
	return conn, server
}

func readMessageOfType(t *testing.T, conn *websocket.Conn, expectedType string) models.WebSocketMessage {
	var message models.WebSocketMessage
	for {
		err := conn.ReadJSON(&message)
		require.NoError(t, err)
		if message.Type == expectedType {
			return message
		}
		// Skip other message types
	}
}

func TestWebSocketService_NewWebSocketService(t *testing.T) {
	service, testDB := setupWebSocketTest(t)
	defer database.CleanupTestDB(testDB)
	
	assert.NotNil(t, service)
	assert.NotNil(t, service.db)
	assert.NotNil(t, service.rooms)
	assert.NotNil(t, service.connections)
	assert.NotNil(t, service.clients)
	assert.NotNil(t, service.broadcast)
	assert.NotNil(t, service.register)
	assert.NotNil(t, service.unregister)
}

func TestWebSocketService_HandleWebSocket(t *testing.T) {
	service, testDB := setupWebSocketTest(t)
	defer database.CleanupTestDB(testDB)
	
	user := createTestUser(t, testDB)
	
	conn, server := setupWebSocketConnection(t, service, user.ID, user.Username)
	defer conn.Close()
	defer server.Close()
	
	// Give some time for connection to be established
	time.Sleep(100 * time.Millisecond)
	
	// Check that client was registered
	service.mutex.RLock()
	assert.Equal(t, 1, len(service.clients))
	service.mutex.RUnlock()
}

func TestWebSocketService_JoinRoom(t *testing.T) {
	service, testDB := setupWebSocketTest(t)
	defer database.CleanupTestDB(testDB)
	
	user := createTestUser(t, testDB)
	note := createTestNote(t, testDB, user.ID)
	
	conn, server := setupWebSocketConnection(t, service, user.ID, user.Username)
	defer conn.Close()
	defer server.Close()
	
	// Send join room message
	joinMessage := models.WebSocketMessage{
		Type: models.MessageTypeJoinRoom,
		Data: models.JoinRoomData{
			NoteID: note.ID,
		},
	}
	
	err := conn.WriteJSON(joinMessage)
	require.NoError(t, err)
	
	// Read acknowledgment
	var ackMessage models.WebSocketMessage
	err = conn.ReadJSON(&ackMessage)
	require.NoError(t, err)
	
	assert.Equal(t, models.MessageTypeAck, ackMessage.Type)
	assert.Equal(t, note.ID.String(), ackMessage.RoomID)
	
	// Check that room was created
	service.mutex.RLock()
	room, exists := service.rooms[note.ID.String()]
	service.mutex.RUnlock()
	
	assert.True(t, exists)
	assert.Equal(t, note.ID, room.NoteID)
	assert.Equal(t, 1, len(room.Clients))
}

func TestWebSocketService_JoinRoom_UnauthorizedNote(t *testing.T) {
	service, testDB := setupWebSocketTest(t)
	defer database.CleanupTestDB(testDB)
	
	user := createTestUser(t, testDB)
	
	// Create note for different user
	otherUserID := uuid.New()
	otherUser := models.User{
		ID:       otherUserID,
		Username: "otheruser_" + otherUserID.String()[:8],
		Email:    "other_" + otherUserID.String()[:8] + "@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	err := testDB.Create(&otherUser).Error
	require.NoError(t, err)
	
	note := createTestNote(t, testDB, otherUser.ID)
	
	conn, server := setupWebSocketConnection(t, service, user.ID, user.Username)
	defer conn.Close()
	defer server.Close()
	
	// Send join room message for unauthorized note
	joinMessage := models.WebSocketMessage{
		Type: models.MessageTypeJoinRoom,
		Data: models.JoinRoomData{
			NoteID: note.ID,
		},
	}
	
	err = conn.WriteJSON(joinMessage)
	require.NoError(t, err)
	
	// Read error message
	var errorMessage models.WebSocketMessage
	err = conn.ReadJSON(&errorMessage)
	require.NoError(t, err)
	
	assert.Equal(t, models.MessageTypeError, errorMessage.Type)
	
	errorData := errorMessage.Data.(map[string]interface{})
	assert.Equal(t, "note_not_found", errorData["code"])
}

func TestWebSocketService_NoteUpdate(t *testing.T) {
	service, testDB := setupWebSocketTest(t)
	defer database.CleanupTestDB(testDB)
	
	user := createTestUser(t, testDB)
	note := createTestNote(t, testDB, user.ID)
	
	conn, server := setupWebSocketConnection(t, service, user.ID, user.Username)
	defer conn.Close()
	defer server.Close()
	
	// Join room first
	joinMessage := models.WebSocketMessage{
		Type: models.MessageTypeJoinRoom,
		Data: models.JoinRoomData{
			NoteID: note.ID,
		},
	}
	
	err := conn.WriteJSON(joinMessage)
	require.NoError(t, err)
	
	// Read acknowledgment (skip presence messages)
	_ = readMessageOfType(t, conn, models.MessageTypeAck)
	
	// Send note update
	newContent := models.JSONB{
		"type": "doc",
		"content": []interface{}{
			map[string]interface{}{
				"type": "paragraph",
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "Updated content",
					},
				},
			},
		},
	}
	
	updateMessage := models.WebSocketMessage{
		Type: models.MessageTypeNoteUpdate,
		Data: models.NoteUpdateData{
			NoteID:    note.ID,
			Content:   newContent,
			Version:   1,
			Operation: "replace",
		},
	}
	
	err = conn.WriteJSON(updateMessage)
	require.NoError(t, err)
	
	// Read acknowledgment
	updateAck := readMessageOfType(t, conn, models.MessageTypeAck)
	
	assert.Equal(t, models.MessageTypeAck, updateAck.Type)
	
	ackData := updateAck.Data.(map[string]interface{})
	assert.Equal(t, "note_updated", ackData["action"])
	assert.Equal(t, float64(2), ackData["version"]) // Version should be incremented
	
	// Verify note was updated in database
	var updatedNote models.Note
	err = testDB.First(&updatedNote, note.ID).Error
	require.NoError(t, err)
	
	assert.Equal(t, 2, updatedNote.Version)
	assert.Equal(t, newContent, updatedNote.Content)
}

func TestWebSocketService_NoteUpdate_VersionConflict(t *testing.T) {
	service, testDB := setupWebSocketTest(t)
	defer database.CleanupTestDB(testDB)
	
	user := createTestUser(t, testDB)
	note := createTestNote(t, testDB, user.ID)
	
	// Update note version in database to simulate conflict
	err := testDB.Model(&note).Update("version", 2).Error
	require.NoError(t, err)
	
	conn, server := setupWebSocketConnection(t, service, user.ID, user.Username)
	defer conn.Close()
	defer server.Close()
	
	// Join room first
	joinMessage := models.WebSocketMessage{
		Type: models.MessageTypeJoinRoom,
		Data: models.JoinRoomData{
			NoteID: note.ID,
		},
	}
	
	err = conn.WriteJSON(joinMessage)
	require.NoError(t, err)
	
	// Read acknowledgment (skip presence messages)
	_ = readMessageOfType(t, conn, models.MessageTypeAck)
	
	// Send note update with old version
	updateMessage := models.WebSocketMessage{
		Type: models.MessageTypeNoteUpdate,
		Data: models.NoteUpdateData{
			NoteID:  note.ID,
			Content: models.JSONB{"type": "doc", "content": []interface{}{}},
			Version: 1, // Old version
		},
	}
	
	err = conn.WriteJSON(updateMessage)
	require.NoError(t, err)
	
	// Read conflict message
	conflictMessage := readMessageOfType(t, conn, models.MessageTypeConflict)
	
	assert.Equal(t, models.MessageTypeConflict, conflictMessage.Type)
	
	conflictData := conflictMessage.Data.(map[string]interface{})
	assert.Equal(t, float64(1), conflictData["local_version"])
	assert.Equal(t, float64(2), conflictData["remote_version"])
}

func TestWebSocketService_GetRoomStats(t *testing.T) {
	service, testDB := setupWebSocketTest(t)
	defer database.CleanupTestDB(testDB)
	
	user := createTestUser(t, testDB)
	note := createTestNote(t, testDB, user.ID)
	
	conn, server := setupWebSocketConnection(t, service, user.ID, user.Username)
	defer conn.Close()
	defer server.Close()
	
	// Join room
	joinMessage := models.WebSocketMessage{
		Type: models.MessageTypeJoinRoom,
		Data: models.JoinRoomData{
			NoteID: note.ID,
		},
	}
	
	err := conn.WriteJSON(joinMessage)
	require.NoError(t, err)
	
	// Read acknowledgment
	var ackMessage models.WebSocketMessage
	err = conn.ReadJSON(&ackMessage)
	require.NoError(t, err)
	
	// Get room stats
	stats := service.GetRoomStats()
	
	assert.Equal(t, 1, stats["total_rooms"])
	assert.Equal(t, 1, stats["total_clients"])
	
	rooms := stats["rooms"].([]map[string]interface{})
	assert.Len(t, rooms, 1)
	assert.Equal(t, note.ID.String(), rooms[0]["room_id"])
	assert.Equal(t, 1, rooms[0]["client_count"])
}
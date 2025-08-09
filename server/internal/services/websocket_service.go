package services

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for now - in production, implement proper CORS
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// WebSocketService manages WebSocket connections and real-time collaboration
type WebSocketService struct {
	db          *gorm.DB
	rooms       map[string]*models.Room
	connections map[uuid.UUID]*websocket.Conn
	clients     map[uuid.UUID]*models.Client
	mutex       sync.RWMutex
	broadcast   chan *models.WebSocketMessage
	register    chan *models.Client
	unregister  chan *models.Client
}

// NewWebSocketService creates a new WebSocket service
func NewWebSocketService(db *gorm.DB) *WebSocketService {
	service := &WebSocketService{
		db:          db,
		rooms:       make(map[string]*models.Room),
		connections: make(map[uuid.UUID]*websocket.Conn),
		clients:     make(map[uuid.UUID]*models.Client),
		broadcast:   make(chan *models.WebSocketMessage, 256),
		register:    make(chan *models.Client, 256),
		unregister:  make(chan *models.Client, 256),
	}

	// Start the hub goroutine
	go service.run()

	return service
}

// HandleWebSocket upgrades HTTP connection to WebSocket
func (s *WebSocketService) HandleWebSocket(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	username, exists := c.Get("username")
	if !exists {
		username = "Unknown User"
	}

	// Upgrade connection
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Create client
	client := &models.Client{
		ID:       uuid.New(),
		UserID:   userID,
		Username: username.(string),
		Status:   "active",
		JoinedAt: time.Now(),
		LastSeen: time.Now(),
	}

	// Store connection
	s.mutex.Lock()
	s.connections[client.ID] = conn
	s.clients[client.ID] = client
	s.mutex.Unlock()

	// Register client
	s.register <- client

	// Handle client messages
	go s.handleClient(client, conn)
}

// run manages the WebSocket hub
func (s *WebSocketService) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-s.register:
			s.registerClient(client)

		case client := <-s.unregister:
			s.unregisterClient(client)

		case message := <-s.broadcast:
			s.broadcastMessage(message)

		case <-ticker.C:
			s.cleanupInactiveClients()
		}
	}
}

// handleClient handles messages from a specific client
func (s *WebSocketService) handleClient(client *models.Client, conn *websocket.Conn) {
	defer func() {
		s.unregister <- client
		conn.Close()
		
		s.mutex.Lock()
		delete(s.connections, client.ID)
		delete(s.clients, client.ID)
		s.mutex.Unlock()
	}()

	// Set read deadline and pong handler
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var message models.WebSocketMessage
		err := conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Update client last seen
		client.LastSeen = time.Now()
		message.UserID = client.UserID
		message.Username = client.Username
		message.Timestamp = time.Now()

		// Handle message based on type
		s.handleMessage(client, &message)
	}
}

// handleMessage processes different types of WebSocket messages
func (s *WebSocketService) handleMessage(client *models.Client, message *models.WebSocketMessage) {
	switch message.Type {
	case models.MessageTypeJoinRoom:
		s.handleJoinRoom(client, message)
	case models.MessageTypeLeaveRoom:
		s.handleLeaveRoom(client, message)
	case models.MessageTypeNoteUpdate:
		s.handleNoteUpdate(client, message)
	case models.MessageTypeCursorUpdate:
		s.handleCursorUpdate(client, message)
	case models.MessageTypePresence:
		s.handlePresenceUpdate(client, message)
	default:
		s.sendError(client, "unknown_message_type", "Unknown message type: "+message.Type)
	}
}

// handleJoinRoom handles client joining a collaboration room
func (s *WebSocketService) handleJoinRoom(client *models.Client, message *models.WebSocketMessage) {
	var joinData models.JoinRoomData
	if err := s.parseMessageData(message.Data, &joinData); err != nil {
		s.sendError(client, "invalid_join_data", "Invalid join room data")
		return
	}

	// Verify user has access to the note
	var note models.Note
	if err := s.db.Where("id = ? AND user_id = ?", joinData.NoteID, client.UserID).First(&note).Error; err != nil {
		s.sendError(client, "note_not_found", "Note not found or access denied")
		return
	}

	roomID := joinData.NoteID.String()
	client.RoomID = roomID

	s.mutex.Lock()
	// Create room if it doesn't exist
	if _, exists := s.rooms[roomID]; !exists {
		s.rooms[roomID] = &models.Room{
			ID:        roomID,
			NoteID:    joinData.NoteID,
			Clients:   make(map[uuid.UUID]*models.Client),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
	}

	// Add client to room
	s.rooms[roomID].Clients[client.ID] = client
	s.rooms[roomID].UpdatedAt = time.Now()
	s.mutex.Unlock()

	// Send acknowledgment
	s.sendMessage(client, &models.WebSocketMessage{
		Type:      models.MessageTypeAck,
		RoomID:    roomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"action": "joined_room",
			"room_id": roomID,
		},
	})

	// Broadcast presence update to room
	s.broadcastToRoom(roomID, &models.WebSocketMessage{
		Type:      models.MessageTypePresence,
		RoomID:    roomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data: models.PresenceData{
			NoteID:     joinData.NoteID,
			Status:     "active",
			LastActive: time.Now(),
		},
	}, client.ID)

	// Send current active users to the new client
	s.sendActiveUsers(client, roomID)
}

// handleLeaveRoom handles client leaving a collaboration room
func (s *WebSocketService) handleLeaveRoom(client *models.Client, message *models.WebSocketMessage) {
	if client.RoomID == "" {
		return
	}

	s.mutex.Lock()
	if room, exists := s.rooms[client.RoomID]; exists {
		delete(room.Clients, client.ID)
		room.UpdatedAt = time.Now()

		// Remove room if empty
		if len(room.Clients) == 0 {
			delete(s.rooms, client.RoomID)
		}
	}
	s.mutex.Unlock()

	// Broadcast presence update
	s.broadcastToRoom(client.RoomID, &models.WebSocketMessage{
		Type:      models.MessageTypePresence,
		RoomID:    client.RoomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data: models.PresenceData{
			Status:     "away",
			LastActive: time.Now(),
		},
	}, client.ID)

	client.RoomID = ""
}

// handleNoteUpdate handles real-time note content updates
func (s *WebSocketService) handleNoteUpdate(client *models.Client, message *models.WebSocketMessage) {
	var updateData models.NoteUpdateData
	if err := s.parseMessageData(message.Data, &updateData); err != nil {
		s.sendError(client, "invalid_update_data", "Invalid note update data")
		return
	}

	// Get current note version
	var note models.Note
	if err := s.db.Where("id = ? AND user_id = ?", updateData.NoteID, client.UserID).First(&note).Error; err != nil {
		s.sendError(client, "note_not_found", "Note not found or access denied")
		return
	}

	// Check for version conflicts
	if updateData.Version != note.Version {
		s.handleVersionConflict(client, &note, &updateData)
		return
	}

	// Apply update to database
	note.Content = updateData.Content
	note.Version++
	note.UpdatedAt = time.Now()

	if err := s.db.Save(&note).Error; err != nil {
		s.sendError(client, "update_failed", "Failed to update note")
		return
	}

	// Broadcast update to room (excluding sender)
	updateData.Version = note.Version
	s.broadcastToRoom(client.RoomID, &models.WebSocketMessage{
		Type:      models.MessageTypeNoteUpdate,
		RoomID:    client.RoomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data:      updateData,
	}, client.ID)

	// Send acknowledgment to sender
	s.sendMessage(client, &models.WebSocketMessage{
		Type:      models.MessageTypeAck,
		RoomID:    client.RoomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"action":  "note_updated",
			"version": note.Version,
		},
	})
}

// handleCursorUpdate handles cursor position updates
func (s *WebSocketService) handleCursorUpdate(client *models.Client, message *models.WebSocketMessage) {
	var cursorData models.CursorUpdateData
	if err := s.parseMessageData(message.Data, &cursorData); err != nil {
		s.sendError(client, "invalid_cursor_data", "Invalid cursor data")
		return
	}

	// Broadcast cursor update to room (excluding sender)
	s.broadcastToRoom(client.RoomID, &models.WebSocketMessage{
		Type:      models.MessageTypeCursorUpdate,
		RoomID:    client.RoomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data:      cursorData,
	}, client.ID)
}

// handlePresenceUpdate handles user presence updates
func (s *WebSocketService) handlePresenceUpdate(client *models.Client, message *models.WebSocketMessage) {
	var presenceData models.PresenceData
	if err := s.parseMessageData(message.Data, &presenceData); err != nil {
		s.sendError(client, "invalid_presence_data", "Invalid presence data")
		return
	}

	client.Status = presenceData.Status
	client.LastSeen = time.Now()

	// Broadcast presence update to room
	s.broadcastToRoom(client.RoomID, &models.WebSocketMessage{
		Type:      models.MessageTypePresence,
		RoomID:    client.RoomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data:      presenceData,
	}, client.ID)
}

// handleVersionConflict handles version conflicts during note updates
func (s *WebSocketService) handleVersionConflict(client *models.Client, note *models.Note, updateData *models.NoteUpdateData) {
	conflictID := uuid.New().String()

	conflictData := models.ConflictData{
		NoteID:        note.ID,
		ConflictID:    conflictID,
		LocalVersion:  updateData.Version,
		RemoteVersion: note.Version,
		LocalContent:  updateData.Content,
		RemoteContent: note.Content,
	}

	s.sendMessage(client, &models.WebSocketMessage{
		Type:      models.MessageTypeConflict,
		RoomID:    client.RoomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data:      conflictData,
	})
}

// Utility methods

// registerClient registers a new client
func (s *WebSocketService) registerClient(client *models.Client) {
	log.Printf("Client registered: %s (%s)", client.Username, client.ID)
}

// unregisterClient unregisters a client
func (s *WebSocketService) unregisterClient(client *models.Client) {
	if client.RoomID != "" {
		s.handleLeaveRoom(client, nil)
	}
	log.Printf("Client unregistered: %s (%s)", client.Username, client.ID)
}

// broadcastMessage broadcasts a message to all clients
func (s *WebSocketService) broadcastMessage(message *models.WebSocketMessage) {
	if message.RoomID != "" {
		s.broadcastToRoom(message.RoomID, message, uuid.Nil)
	}
}

// broadcastToRoom broadcasts a message to all clients in a room
func (s *WebSocketService) broadcastToRoom(roomID string, message *models.WebSocketMessage, excludeClientID uuid.UUID) {
	s.mutex.RLock()
	room, exists := s.rooms[roomID]
	if !exists {
		s.mutex.RUnlock()
		return
	}

	clients := make([]*models.Client, 0, len(room.Clients))
	for _, client := range room.Clients {
		if client.ID != excludeClientID {
			clients = append(clients, client)
		}
	}
	s.mutex.RUnlock()

	for _, client := range clients {
		s.sendMessage(client, message)
	}
}

// sendMessage sends a message to a specific client
func (s *WebSocketService) sendMessage(client *models.Client, message *models.WebSocketMessage) {
	s.mutex.RLock()
	conn, exists := s.connections[client.ID]
	s.mutex.RUnlock()

	if !exists {
		return
	}

	if err := conn.WriteJSON(message); err != nil {
		log.Printf("Error sending message to client %s: %v", client.ID, err)
		s.unregister <- client
	}
}

// sendError sends an error message to a client
func (s *WebSocketService) sendError(client *models.Client, code, message string) {
	errorMsg := &models.WebSocketMessage{
		Type:      models.MessageTypeError,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data: models.ErrorData{
			Code:    code,
			Message: message,
		},
	}
	s.sendMessage(client, errorMsg)
}

// sendActiveUsers sends the list of active users in a room to a client
func (s *WebSocketService) sendActiveUsers(client *models.Client, roomID string) {
	s.mutex.RLock()
	room, exists := s.rooms[roomID]
	if !exists {
		s.mutex.RUnlock()
		return
	}

	activeUsers := make([]models.ActiveUser, 0, len(room.Clients))
	for _, roomClient := range room.Clients {
		if roomClient.ID != client.ID {
			activeUsers = append(activeUsers, models.ActiveUser{
				UserID:   roomClient.UserID,
				Username: roomClient.Username,
				Status:   roomClient.Status,
				JoinedAt: roomClient.JoinedAt,
				LastSeen: roomClient.LastSeen,
			})
		}
	}
	s.mutex.RUnlock()

	s.sendMessage(client, &models.WebSocketMessage{
		Type:      models.MessageTypePresence,
		RoomID:    roomID,
		UserID:    client.UserID,
		Username:  client.Username,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"action":       "active_users",
			"active_users": activeUsers,
		},
	})
}

// cleanupInactiveClients removes inactive clients
func (s *WebSocketService) cleanupInactiveClients() {
	cutoff := time.Now().Add(-5 * time.Minute)
	
	s.mutex.Lock()
	for clientID, client := range s.clients {
		if client.LastSeen.Before(cutoff) {
			delete(s.clients, clientID)
			if conn, exists := s.connections[clientID]; exists {
				conn.Close()
				delete(s.connections, clientID)
			}
			s.unregister <- client
		}
	}
	s.mutex.Unlock()
}

// parseMessageData parses message data into a specific struct
func (s *WebSocketService) parseMessageData(data interface{}, target interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return json.Unmarshal(jsonData, target)
}

// GetRoomStats returns statistics about active rooms
func (s *WebSocketService) GetRoomStats() map[string]interface{} {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	stats := map[string]interface{}{
		"total_rooms":   len(s.rooms),
		"total_clients": len(s.clients),
		"rooms":         make([]map[string]interface{}, 0, len(s.rooms)),
	}

	for roomID, room := range s.rooms {
		roomStats := map[string]interface{}{
			"room_id":      roomID,
			"note_id":      room.NoteID,
			"client_count": len(room.Clients),
			"created_at":   room.CreatedAt,
			"updated_at":   room.UpdatedAt,
		}
		stats["rooms"] = append(stats["rooms"].([]map[string]interface{}), roomStats)
	}

	return stats
}
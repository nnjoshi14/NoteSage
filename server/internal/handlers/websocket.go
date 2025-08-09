package handlers

import (
	"net/http"
	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
)

// WebSocketHandler handles WebSocket-related HTTP requests
type WebSocketHandler struct {
	wsService *services.WebSocketService
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(wsService *services.WebSocketService) *WebSocketHandler {
	return &WebSocketHandler{
		wsService: wsService,
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	h.wsService.HandleWebSocket(c)
}

// GetRoomStats returns statistics about active WebSocket rooms
func (h *WebSocketHandler) GetRoomStats(c *gin.Context) {
	stats := h.wsService.GetRoomStats()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetActiveRooms returns list of active collaboration rooms
func (h *WebSocketHandler) GetActiveRooms(c *gin.Context) {
	stats := h.wsService.GetRoomStats()
	rooms := stats["rooms"].([]map[string]interface{})
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"rooms": rooms,
			"total": len(rooms),
		},
	})
}
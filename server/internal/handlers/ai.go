package handlers

import (
	"net/http"
	"strconv"

	"notesage-server/internal/models"
	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AIHandler handles AI-related endpoints
type AIHandler struct {
	aiService *services.AIService
}

// NewAIHandler creates a new AI handler
func NewAIHandler(aiService *services.AIService) *AIHandler {
	return &AIHandler{
		aiService: aiService,
	}
}

// ExtractTodosRequest represents a request to extract todos from content
type ExtractTodosRequest struct {
	Content models.JSONB `json:"content" binding:"required"`
}

// AnalyzePeopleRequest represents a request to analyze people mentions
type AnalyzePeopleRequest struct {
	Content models.JSONB `json:"content" binding:"required"`
}

// GenerateInsightsRequest represents a request to generate insights
type GenerateInsightsRequest struct {
	Limit int `json:"limit,omitempty"`
}

// AIStatusResponse represents the AI service status
type AIStatusResponse struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message,omitempty"`
}

// GetAIStatus returns the current AI service status
func (h *AIHandler) GetAIStatus(c *gin.Context) {
	if h.aiService.IsEnabled() {
		c.JSON(http.StatusOK, AIStatusResponse{
			Enabled: true,
			Message: "AI service is available",
		})
	} else {
		c.JSON(http.StatusOK, AIStatusResponse{
			Enabled: false,
			Message: "AI service is not configured or unavailable",
		})
	}
}

// ExtractTodos extracts todos from note content using AI
func (h *AIHandler) ExtractTodos(c *gin.Context) {
	var req ExtractTodosRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	result, err := h.aiService.ExtractTodosFromNote(c.Request.Context(), req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract todos"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// AnalyzePeople analyzes people mentions and relationships in content
func (h *AIHandler) AnalyzePeople(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	var req AnalyzePeopleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	result, err := h.aiService.AnalyzePeopleMentions(c.Request.Context(), req.Content, userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze people mentions"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GenerateInsights generates insights from user's knowledge base
func (h *AIHandler) GenerateInsights(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	// Parse optional limit parameter
	limit := 50 // default
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	result, err := h.aiService.GenerateInsights(c.Request.Context(), userUUID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate insights"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ExtractTodosFromNote extracts todos from a specific note using AI
func (h *AIHandler) ExtractTodosFromNote(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	noteIDStr := c.Param("noteId")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	// Get the note (this would typically be done through a note service)
	// For now, we'll expect the content to be provided in the request body
	var req ExtractTodosRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	result, err := h.aiService.ExtractTodosFromNote(c.Request.Context(), req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract todos from note"})
		return
	}

	// Add note context to the response
	response := map[string]interface{}{
		"note_id": noteID,
		"user_id": userUUID,
		"result":  result,
	}

	c.JSON(http.StatusOK, response)
}

// AnalyzePeopleInNote analyzes people mentions in a specific note
func (h *AIHandler) AnalyzePeopleInNote(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	noteIDStr := c.Param("noteId")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	var req AnalyzePeopleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	result, err := h.aiService.AnalyzePeopleMentions(c.Request.Context(), req.Content, userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze people mentions in note"})
		return
	}

	// Add note context to the response
	response := map[string]interface{}{
		"note_id": noteID,
		"user_id": userUUID,
		"result":  result,
	}

	c.JSON(http.StatusOK, response)
}
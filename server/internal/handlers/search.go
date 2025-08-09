package handlers

import (
	"net/http"
	"strconv"
	"time"

	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SearchHandler struct {
	searchService *services.SearchService
}

func NewSearchHandler(db *gorm.DB) *SearchHandler {
	return &SearchHandler{
		searchService: services.NewSearchService(db),
	}
}

// AdvancedSearch performs advanced full-text search with filters and ranking
func (h *SearchHandler) AdvancedSearch(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))

	var req services.SearchRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse time parameters manually if they're strings
	if dateFromStr := c.Query("date_from"); dateFromStr != "" {
		if dateFrom, err := time.Parse(time.RFC3339, dateFromStr); err == nil {
			req.DateFrom = &dateFrom
		}
	}

	if dateToStr := c.Query("date_to"); dateToStr != "" {
		if dateTo, err := time.Parse(time.RFC3339, dateToStr); err == nil {
			req.DateTo = &dateTo
		}
	}

	// Parse boolean parameters
	if isArchivedStr := c.Query("is_archived"); isArchivedStr != "" {
		if isArchived, err := strconv.ParseBool(isArchivedStr); err == nil {
			req.IsArchived = &isArchived
		}
	}

	if isPinnedStr := c.Query("is_pinned"); isPinnedStr != "" {
		if isPinned, err := strconv.ParseBool(isPinnedStr); err == nil {
			req.IsPinned = &isPinned
		}
	}

	if isFavoriteStr := c.Query("is_favorite"); isFavoriteStr != "" {
		if isFavorite, err := strconv.ParseBool(isFavoriteStr); err == nil {
			req.IsFavorite = &isFavorite
		}
	}

	if includeSnippetsStr := c.Query("include_snippets"); includeSnippetsStr != "" {
		if includeSnippets, err := strconv.ParseBool(includeSnippetsStr); err == nil {
			req.IncludeSnippets = includeSnippets
		}
	}

	response, err := h.searchService.FullTextSearch(userUUID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// QuickSwitcher provides fuzzy search for note navigation
func (h *SearchHandler) QuickSwitcher(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))

	query := c.Query("q")
	limitStr := c.DefaultQuery("limit", "10")
	
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 50 {
		limit = 10
	}

	results, err := h.searchService.QuickSwitcher(userUUID, query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Quick switcher search failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"query":   query,
		"limit":   limit,
	})
}

// GetRecentNotes retrieves recently accessed notes
func (h *SearchHandler) GetRecentNotes(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))

	limitStr := c.DefaultQuery("limit", "10")
	
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 50 {
		limit = 10
	}

	results, err := h.searchService.GetRecentNotes(userUUID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recent notes: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"recent_notes": results,
		"limit":        limit,
	})
}

// SearchSuggestions provides search suggestions and autocomplete
func (h *SearchHandler) SearchSuggestions(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	limitStr := c.DefaultQuery("limit", "5")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 20 {
		limit = 5
	}

	// Get quick switcher results as suggestions
	suggestions, err := h.searchService.QuickSwitcher(userUUID, query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get suggestions: " + err.Error()})
		return
	}

	// Convert to simpler suggestion format
	simpleSuggestions := make([]gin.H, len(suggestions))
	for i, suggestion := range suggestions {
		simpleSuggestions[i] = gin.H{
			"id":       suggestion.ID,
			"title":    suggestion.Title,
			"category": suggestion.Category,
			"score":    suggestion.Score,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"suggestions": simpleSuggestions,
		"query":       query,
		"limit":       limit,
	})
}

// GetSearchStats provides search statistics and analytics
func (h *SearchHandler) GetSearchStats(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))

	// This would typically track search analytics
	// For now, return basic stats
	stats := gin.H{
		"user_id":           userUUID,
		"total_searches":    0, // Would be tracked in a real implementation
		"popular_queries":   []string{},
		"recent_searches":   []string{},
		"search_performance": gin.H{
			"avg_response_time": "0ms",
			"total_indexed":     0,
		},
	}

	c.JSON(http.StatusOK, stats)
}
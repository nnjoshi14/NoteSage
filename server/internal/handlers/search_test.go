package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"notesage-server/internal/database"
	"notesage-server/internal/models"
	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSearchRouter(t *testing.T) (*gin.Engine, *gorm.DB, *models.User) {
	t.Helper()

	db := database.SetupTestDB(t)

	// Create test user
	user := &models.User{
		ID:       uuid.New(),
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	db.Create(user)

	// Create test notes
	notes := []models.Note{
		{
			ID:       uuid.New(),
			UserID:   user.ID,
			Title:    "Go Programming Tutorial",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "paragraph", "content": []interface{}{map[string]interface{}{"type": "text", "text": "This is a comprehensive guide to Go programming language"}}}}},
			Category: "Tutorial",
			Tags:     pq.StringArray{"go", "programming", "tutorial"},
			IsPinned: true,
		},
		{
			ID:       uuid.New(),
			UserID:   user.ID,
			Title:    "JavaScript Best Practices",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "paragraph", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Modern JavaScript development practices and patterns"}}}}},
			Category: "Note",
			Tags:     pq.StringArray{"javascript", "best-practices"},
			IsFavorite: true,
		},
		{
			ID:       uuid.New(),
			UserID:   user.ID,
			Title:    "Meeting Notes - Project Alpha",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "paragraph", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Discussion about project alpha timeline and requirements"}}}}},
			Category: "Meeting",
			Tags:     pq.StringArray{"meeting", "project-alpha"},
		},
	}

	for _, note := range notes {
		require.NoError(t, db.Create(&note).Error)
	}

	searchHandler := NewSearchHandler(db)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.Use(func(c *gin.Context) {
		c.Set("userID", user.ID.String())
		c.Next()
	})

	api := router.Group("/api/search")
	{
		api.GET("", searchHandler.AdvancedSearch)
		api.GET("/quick", searchHandler.QuickSwitcher)
		api.GET("/recent", searchHandler.GetRecentNotes)
		api.GET("/suggestions", searchHandler.SearchSuggestions)
		api.GET("/stats", searchHandler.GetSearchStats)
	}

	return router, db, user
}

func TestAdvancedSearch(t *testing.T) {
	t.Parallel()
	router, _, _ := setupSearchRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/search?q=Go", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response services.SearchResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, int64(1), response.Total)
}

func TestQuickSwitcher(t *testing.T) {
	t.Parallel()
	router, _, _ := setupSearchRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/search/quick?q=Go", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	results, ok := response["results"].([]interface{})
	require.True(t, ok)
	assert.Len(t, results, 1)
}

func TestGetRecentNotes(t *testing.T) {
	t.Parallel()
	router, _, _ := setupSearchRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/search/recent", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	recentNotes, ok := response["recent_notes"].([]interface{})
	require.True(t, ok)
	assert.Len(t, recentNotes, 3)
}

func TestSearchSuggestions(t *testing.T) {
	t.Parallel()
	router, _, _ := setupSearchRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/search/suggestions?q=Go", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	suggestions, ok := response["suggestions"].([]interface{})
	require.True(t, ok)
	assert.Len(t, suggestions, 1)
}

func TestGetSearchStats(t *testing.T) {
	t.Parallel()
	router, _, user := setupSearchRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/search/stats", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, user.ID.String(), response["user_id"])
}

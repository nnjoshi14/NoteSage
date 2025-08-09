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

func setupSearchHandlerTest(t *testing.T) (*gin.Engine, *gorm.DB, models.User) {
	db := database.SetupTestDB(t)
	
	// Create test user with unique username
	userID := uuid.New()
	user := models.User{
		ID:       userID,
		Username: "testuser_" + userID.String()[:8],
		Email:    "test_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	require.NoError(t, db.Create(&user).Error)
	
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
	
	// Setup Gin router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Add middleware to set userID
	router.Use(func(c *gin.Context) {
		c.Set("userID", user.ID.String())
		c.Next()
	})
	
	// Setup search handler
	searchHandler := NewSearchHandler(db)
	
	// Setup routes
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

func TestSearchHandler_AdvancedSearch(t *testing.T) {
	router, db, _ := setupSearchHandlerTest(t)
	defer database.CleanupTestDB(db)
	
	tests := []struct {
		name           string
		query          string
		expectedStatus int
		expectedCount  int
	}{
		{
			name:           "search by title",
			query:          "?q=Go Programming",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search by category",
			query:          "?categories=Tutorial",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search by tag",
			query:          "?tags=programming",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search with multiple filters",
			query:          "?q=tutorial&categories=Tutorial",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search with snippets",
			query:          "?q=Go Programming&include_snippets=true",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search with sorting",
			query:          "?sort_by=title&sort_order=asc",
			expectedStatus: http.StatusOK,
			expectedCount:  3,
		},
		{
			name:           "search with pagination",
			query:          "?limit=2&offset=1",
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name:           "empty search returns all",
			query:          "",
			expectedStatus: http.StatusOK,
			expectedCount:  3,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/api/search"+tt.query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response services.SearchResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				
				assert.Equal(t, int64(tt.expectedCount), response.Total)
				assert.Equal(t, tt.expectedCount, len(response.Results))
				assert.Greater(t, response.Took.Nanoseconds(), int64(0))
			}
		})
	}
}

func TestSearchHandler_QuickSwitcher(t *testing.T) {
	router, db, _ := setupSearchHandlerTest(t)
	defer database.CleanupTestDB(db)
	
	tests := []struct {
		name           string
		query          string
		expectedStatus int
		expectedCount  int
	}{
		{
			name:           "search with query",
			query:          "?q=Go",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search with limit",
			query:          "?q=&limit=2",
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name:           "empty query returns recent",
			query:          "",
			expectedStatus: http.StatusOK,
			expectedCount:  3,
		},
		{
			name:           "no matches",
			query:          "?q=nonexistent",
			expectedStatus: http.StatusOK,
			expectedCount:  0,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/api/search/quick"+tt.query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				
				results, ok := response["results"].([]interface{})
				require.True(t, ok)
				assert.Equal(t, tt.expectedCount, len(results))
				
				if len(results) > 0 {
					result := results[0].(map[string]interface{})
					assert.Contains(t, result, "id")
					assert.Contains(t, result, "title")
					assert.Contains(t, result, "category")
					assert.Contains(t, result, "score")
				}
			}
		})
	}
}

func TestSearchHandler_GetRecentNotes(t *testing.T) {
	router, db, _ := setupSearchHandlerTest(t)
	defer database.CleanupTestDB(db)
	
	tests := []struct {
		name           string
		query          string
		expectedStatus int
		expectedCount  int
	}{
		{
			name:           "get recent notes default limit",
			query:          "",
			expectedStatus: http.StatusOK,
			expectedCount:  3,
		},
		{
			name:           "get recent notes with limit",
			query:          "?limit=2",
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name:           "get recent notes with high limit",
			query:          "?limit=100",
			expectedStatus: http.StatusOK,
			expectedCount:  3,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/api/search/recent"+tt.query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				
				recentNotes, ok := response["recent_notes"].([]interface{})
				require.True(t, ok)
				assert.Equal(t, tt.expectedCount, len(recentNotes))
				
				if len(recentNotes) > 0 {
					note := recentNotes[0].(map[string]interface{})
					assert.Contains(t, note, "id")
					assert.Contains(t, note, "title")
					assert.Contains(t, note, "category")
					assert.Contains(t, note, "updated_at")
					assert.Contains(t, note, "accessed_at")
				}
			}
		})
	}
}

func TestSearchHandler_SearchSuggestions(t *testing.T) {
	router, db, _ := setupSearchHandlerTest(t)
	defer database.CleanupTestDB(db)
	
	tests := []struct {
		name           string
		query          string
		expectedStatus int
		expectedCount  int
	}{
		{
			name:           "get suggestions with query",
			query:          "?q=Go",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "get suggestions with limit",
			query:          "?q=&limit=2",
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name:           "missing query parameter",
			query:          "",
			expectedStatus: http.StatusBadRequest,
			expectedCount:  0,
		},
		{
			name:           "no matches",
			query:          "?q=nonexistent",
			expectedStatus: http.StatusOK,
			expectedCount:  0,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/api/search/suggestions"+tt.query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				
				suggestions, ok := response["suggestions"].([]interface{})
				require.True(t, ok)
				assert.Equal(t, tt.expectedCount, len(suggestions))
				
				if len(suggestions) > 0 {
					suggestion := suggestions[0].(map[string]interface{})
					assert.Contains(t, suggestion, "id")
					assert.Contains(t, suggestion, "title")
					assert.Contains(t, suggestion, "category")
					assert.Contains(t, suggestion, "score")
				}
			}
		})
	}
}

func TestSearchHandler_GetSearchStats(t *testing.T) {
	router, db, user := setupSearchHandlerTest(t)
	defer database.CleanupTestDB(db)
	
	req, _ := http.NewRequest("GET", "/api/search/stats", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Equal(t, user.ID.String(), response["user_id"])
	assert.Contains(t, response, "total_searches")
	assert.Contains(t, response, "popular_queries")
	assert.Contains(t, response, "recent_searches")
	assert.Contains(t, response, "search_performance")
}

func TestSearchHandler_AdvancedSearchWithDateFilters(t *testing.T) {
	router, db, _ := setupSearchHandlerTest(t)
	defer database.CleanupTestDB(db)
	
	// Test with date filters
	req, _ := http.NewRequest("GET", "/api/search?date_from=2020-01-01T00:00:00Z&date_to=2030-12-31T23:59:59Z", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response services.SearchResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Equal(t, int64(3), response.Total)
	assert.Equal(t, 3, len(response.Results))
}

func TestSearchHandler_AdvancedSearchWithBooleanFilters(t *testing.T) {
	router, db, _ := setupSearchHandlerTest(t)
	defer database.CleanupTestDB(db)
	
	tests := []struct {
		name           string
		query          string
		expectedStatus int
		expectedCount  int
	}{
		{
			name:           "search pinned notes",
			query:          "?is_pinned=true",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search favorite notes",
			query:          "?is_favorite=true",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "search non-pinned notes",
			query:          "?is_pinned=false",
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name:           "search non-favorite notes",
			query:          "?is_favorite=false",
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/api/search"+tt.query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response services.SearchResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				
				assert.Equal(t, int64(tt.expectedCount), response.Total)
				assert.Equal(t, tt.expectedCount, len(response.Results))
			}
		})
	}
}
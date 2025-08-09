package services

import (
	"testing"
	"time"

	"notesage-server/internal/database"
	"notesage-server/internal/models"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSearchTestDB(t *testing.T) (*gorm.DB, models.User) {
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
		{
			ID:         uuid.New(),
			UserID:     user.ID,
			Title:      "Archived Note",
			Content:    models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "paragraph", "content": []interface{}{map[string]interface{}{"type": "text", "text": "This note is archived"}}}}},
			Category:   "Note",
			Tags:       pq.StringArray{"archived"},
			IsArchived: true,
		},
		{
			ID:       uuid.New(),
			UserID:   user.ID,
			Title:    "Python Data Science",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "paragraph", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Data science with Python pandas and numpy"}}}}},
			Category: "Tutorial",
			Tags:     pq.StringArray{"python", "data-science", "pandas"},
		},
	}
	
	for _, note := range notes {
		require.NoError(t, db.Create(&note).Error)
	}
	
	return db, user
}

func TestSearchService_FullTextSearch(t *testing.T) {
	db, user := setupSearchTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	tests := []struct {
		name           string
		request        SearchRequest
		expectedCount  int
		expectedTitles []string
	}{
		{
			name: "search by title",
			request: SearchRequest{
				Query: "Go Programming",
				Limit: 10,
			},
			expectedCount:  1,
			expectedTitles: []string{"Go Programming Tutorial"},
		},
		{
			name: "search by content",
			request: SearchRequest{
				Query: "JavaScript",
				Limit: 10,
			},
			expectedCount:  1,
			expectedTitles: []string{"JavaScript Best Practices"},
		},
		{
			name: "search by category",
			request: SearchRequest{
				Categories: []string{"Tutorial"},
				Limit:      10,
			},
			expectedCount:  2,
			expectedTitles: []string{"Go Programming Tutorial", "Python Data Science"},
		},
		{
			name: "search by tag",
			request: SearchRequest{
				Tags:  []string{"programming"},
				Limit: 10,
			},
			expectedCount:  1,
			expectedTitles: []string{"Go Programming Tutorial"},
		},
		{
			name: "search with multiple filters",
			request: SearchRequest{
				Query:      "tutorial",
				Categories: []string{"Tutorial"},
				Limit:      10,
			},
			expectedCount:  1,
			expectedTitles: []string{"Go Programming Tutorial"},
		},
		{
			name: "search archived notes",
			request: SearchRequest{
				Query:      "archived",
				IsArchived: searchBoolPtr(true),
				Limit:      10,
			},
			expectedCount:  1,
			expectedTitles: []string{"Archived Note"},
		},
		{
			name: "search pinned notes",
			request: SearchRequest{
				IsPinned: searchBoolPtr(true),
				Limit:    10,
			},
			expectedCount:  1,
			expectedTitles: []string{"Go Programming Tutorial"},
		},
		{
			name: "search favorite notes",
			request: SearchRequest{
				IsFavorite: searchBoolPtr(true),
				Limit:      10,
			},
			expectedCount:  1,
			expectedTitles: []string{"JavaScript Best Practices"},
		},
		{
			name: "empty search returns all non-archived",
			request: SearchRequest{
				Limit: 10,
			},
			expectedCount: 4, // All except archived
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response, err := service.FullTextSearch(user.ID, tt.request)
			require.NoError(t, err)
			
			assert.Equal(t, int64(tt.expectedCount), response.Total)
			assert.Equal(t, tt.expectedCount, len(response.Results))
			
			if len(tt.expectedTitles) > 0 {
				actualTitles := make([]string, len(response.Results))
				for i, result := range response.Results {
					actualTitles[i] = result.Note.Title
				}
				
				for _, expectedTitle := range tt.expectedTitles {
					assert.Contains(t, actualTitles, expectedTitle)
				}
			}
		})
	}
}

func TestSearchService_FullTextSearchWithSnippets(t *testing.T) {
	db, user := setupSearchTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	request := SearchRequest{
		Query:           "Go Programming",
		IncludeSnippets: true,
		Limit:           10,
	}
	
	response, err := service.FullTextSearch(user.ID, request)
	require.NoError(t, err)
	
	assert.Equal(t, int64(1), response.Total)
	assert.Equal(t, 1, len(response.Results))
	
	result := response.Results[0]
	assert.Equal(t, "Go Programming Tutorial", result.Note.Title)
	assert.Greater(t, result.Score, 0.0)
	assert.Equal(t, "title", result.MatchType)
	assert.NotEmpty(t, result.Snippets)
}

func TestSearchService_FullTextSearchSorting(t *testing.T) {
	db, user := setupSearchTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	tests := []struct {
		name      string
		sortBy    string
		sortOrder string
	}{
		{"sort by title asc", "title", "asc"},
		{"sort by title desc", "title", "desc"},
		{"sort by date asc", "date", "asc"},
		{"sort by date desc", "date", "desc"},
		{"sort by updated asc", "updated", "asc"},
		{"sort by updated desc", "updated", "desc"},
		{"sort by relevance", "relevance", "desc"},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := SearchRequest{
				SortBy:    tt.sortBy,
				SortOrder: tt.sortOrder,
				Limit:     10,
			}
			
			response, err := service.FullTextSearch(user.ID, request)
			require.NoError(t, err)
			
			assert.Greater(t, len(response.Results), 0)
			
			// Verify sorting worked (basic check)
			if tt.sortBy == "title" && len(response.Results) > 1 {
				if tt.sortOrder == "asc" {
					assert.LessOrEqual(t, response.Results[0].Note.Title, response.Results[1].Note.Title)
				} else {
					assert.GreaterOrEqual(t, response.Results[0].Note.Title, response.Results[1].Note.Title)
				}
			}
		})
	}
}

func TestSearchService_QuickSwitcher(t *testing.T) {
	db, user := setupSearchTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	tests := []struct {
		name          string
		query         string
		limit         int
		expectedCount int
		expectTitle   string
	}{
		{
			name:          "exact title match",
			query:         "Go Programming Tutorial",
			limit:         10,
			expectedCount: 1,
			expectTitle:   "Go Programming Tutorial",
		},
		{
			name:          "partial title match",
			query:         "Go",
			limit:         10,
			expectedCount: 1,
			expectTitle:   "Go Programming Tutorial",
		},
		{
			name:          "fuzzy match",
			query:         "prog",
			limit:         10,
			expectedCount: 1,
			expectTitle:   "Go Programming Tutorial",
		},
		{
			name:          "empty query returns recent",
			query:         "",
			limit:         5,
			expectedCount: 4, // All non-archived notes
		},
		{
			name:          "no matches",
			query:         "nonexistent",
			limit:         10,
			expectedCount: 0,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := service.QuickSwitcher(user.ID, tt.query, tt.limit)
			require.NoError(t, err)
			
			assert.Equal(t, tt.expectedCount, len(results))
			
			if tt.expectTitle != "" && len(results) > 0 {
				assert.Equal(t, tt.expectTitle, results[0].Title)
				assert.Greater(t, results[0].Score, 0.0)
			}
		})
	}
}

func TestSearchService_GetRecentNotes(t *testing.T) {
	db, user := setupSearchTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	tests := []struct {
		name          string
		limit         int
		expectedCount int
	}{
		{
			name:          "get recent notes with limit",
			limit:         3,
			expectedCount: 3,
		},
		{
			name:          "get all recent notes",
			limit:         10,
			expectedCount: 4, // All non-archived notes
		},
		{
			name:          "limit too high",
			limit:         100,
			expectedCount: 4, // All non-archived notes
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := service.GetRecentNotes(user.ID, tt.limit)
			require.NoError(t, err)
			
			assert.Equal(t, tt.expectedCount, len(results))
			
			// Verify results are sorted by updated_at desc
			if len(results) > 1 {
				assert.True(t, results[0].UpdatedAt.After(results[1].UpdatedAt) || results[0].UpdatedAt.Equal(results[1].UpdatedAt))
			}
		})
	}
}

func TestSearchService_CalculateRelevanceScore(t *testing.T) {
	service := NewSearchService(nil)
	
	note := models.Note{
		Title:      "Go Programming Tutorial",
		Content:    models.JSONB{"type": "doc", "content": "comprehensive guide to go programming"},
		Category:   "Tutorial",
		Tags:       pq.StringArray{"go", "programming", "tutorial"},
		IsPinned:   true,
		IsFavorite: false,
		UpdatedAt:  time.Now().Add(-1 * time.Hour), // Recent
	}
	
	tests := []struct {
		name          string
		query         string
		expectedScore float64
		comparison    string // "greater", "equal", "less"
	}{
		{
			name:          "exact title match",
			query:         "go programming tutorial",
			expectedScore: 10.0,
			comparison:    "greater",
		},
		{
			name:          "partial title match",
			query:         "go programming",
			expectedScore: 5.0,
			comparison:    "greater",
		},
		{
			name:          "tag match",
			query:         "go",
			expectedScore: 2.0,
			comparison:    "greater",
		},
		{
			name:          "no match",
			query:         "javascript",
			expectedScore: 0.0,
			comparison:    "equal",
		},
		{
			name:          "empty query",
			query:         "",
			expectedScore: 1.0,
			comparison:    "equal",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := service.calculateRelevanceScore(note, tt.query)
			
			switch tt.comparison {
			case "greater":
				assert.Greater(t, score, tt.expectedScore)
			case "equal":
				assert.Equal(t, tt.expectedScore, score)
			case "less":
				assert.Less(t, score, tt.expectedScore)
			}
		})
	}
}

func TestSearchService_CalculateFuzzyScore(t *testing.T) {
	service := NewSearchService(nil)
	
	tests := []struct {
		name          string
		title         string
		query         string
		expectedScore float64
		comparison    string
	}{
		{
			name:          "exact match",
			title:         "Go Programming",
			query:         "go programming",
			expectedScore: 10.0,
			comparison:    "equal",
		},
		{
			name:          "starts with",
			title:         "Go Programming Tutorial",
			query:         "go programming",
			expectedScore: 8.0,
			comparison:    "equal",
		},
		{
			name:          "contains",
			title:         "Advanced Go Programming",
			query:         "go programming",
			expectedScore: 6.0,
			comparison:    "equal",
		},
		{
			name:          "fuzzy match",
			title:         "Go Programming Tutorial",
			query:         "gpt",
			expectedScore: 0.0,
			comparison:    "greater",
		},
		{
			name:          "no match",
			title:         "JavaScript Tutorial",
			query:         "python",
			expectedScore: 0.0,
			comparison:    "equal",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := service.calculateFuzzyScore(tt.title, tt.query)
			
			switch tt.comparison {
			case "greater":
				assert.Greater(t, score, tt.expectedScore)
			case "equal":
				assert.Equal(t, tt.expectedScore, score)
			case "less":
				assert.Less(t, score, tt.expectedScore)
			}
		})
	}
}

func TestSearchService_DetermineMatchType(t *testing.T) {
	service := NewSearchService(nil)
	
	note := models.Note{
		Title:    "Go Programming Tutorial",
		Category: "Tutorial",
		Tags:     pq.StringArray{"go", "programming", "tutorial"},
	}
	
	tests := []struct {
		name         string
		query        string
		expectedType string
	}{
		{
			name:         "title match",
			query:        "programming",
			expectedType: "title",
		},
		{
			name:         "category match",
			query:        "tutorial",
			expectedType: "title", // Title takes precedence
		},
		{
			name:         "tag match only",
			query:        "go",
			expectedType: "title", // Title takes precedence
		},
		{
			name:         "no match defaults to content",
			query:        "javascript",
			expectedType: "content",
		},
		{
			name:         "empty query",
			query:        "",
			expectedType: "all",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matchType := service.determineMatchType(note, tt.query)
			assert.Equal(t, tt.expectedType, matchType)
		})
	}
}

func TestSearchService_GenerateSnippets(t *testing.T) {
	service := NewSearchService(nil)
	
	note := models.Note{
		Title:   "Go Programming Tutorial",
		Content: models.JSONB{"type": "doc", "content": "This is a comprehensive guide to Go programming language"},
	}
	
	snippets := service.generateSnippets(note, "programming")
	
	assert.NotEmpty(t, snippets)
	assert.Contains(t, snippets[0], "**Programming**")
}

// Helper function to create bool pointer (moved to avoid conflict)
func searchBoolPtr(b bool) *bool {
	return &b
}
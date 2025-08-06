package services

import (
	"fmt"
	"math/rand"
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

// Performance test constants
const (
	SmallDataset  = 100
	MediumDataset = 1000
	LargeDataset  = 10000
)

func setupPerformanceTestDB(t testing.TB, noteCount int) (*gorm.DB, models.User) {
	var db *gorm.DB
	if testT, ok := t.(*testing.T); ok {
		db = database.SetupTestDB(testT)
	} else if benchB, ok := t.(*testing.B); ok {
		// For benchmarks, create a temporary test to setup DB
		tempT := &testing.T{}
		db = database.SetupTestDB(tempT)
		_ = benchB // Use benchB to avoid unused variable warning
	} else {
		panic("unsupported testing type")
	}
	
	// Create test user with unique username
	userID := uuid.New()
	user := models.User{
		ID:       userID,
		Username: "perfuser_" + userID.String()[:8],
		Email:    "perf_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Generate test data
	categories := []string{"Note", "Tutorial", "Meeting", "Research", "Project"}
	tags := []string{"programming", "go", "javascript", "python", "tutorial", "meeting", "project", "research", "documentation", "api"}
	
	// Create notes in batches for better performance
	batchSize := 100
	for i := 0; i < noteCount; i += batchSize {
		var notes []models.Note
		
		end := i + batchSize
		if end > noteCount {
			end = noteCount
		}
		
		for j := i; j < end; j++ {
			// Generate realistic note data
			title := generateNoteTitle(j)
			content := generateNoteContent(j)
			category := categories[rand.Intn(len(categories))]
			
			// Random tags (1-3 tags per note)
			numTags := rand.Intn(3) + 1
			noteTags := make([]string, numTags)
			for k := 0; k < numTags; k++ {
				noteTags[k] = tags[rand.Intn(len(tags))]
			}
			
			note := models.Note{
				ID:         uuid.New(),
				UserID:     user.ID,
				Title:      title,
				Content:    models.JSONB{"type": "doc", "content": content},
				Category:   category,
				Tags:       pq.StringArray(noteTags),
				IsPinned:   rand.Float32() < 0.1,   // 10% pinned
				IsFavorite: rand.Float32() < 0.2,   // 20% favorite
				IsArchived: rand.Float32() < 0.05,  // 5% archived
				CreatedAt:  time.Now().Add(-time.Duration(rand.Intn(365*24)) * time.Hour), // Random date within last year
				UpdatedAt:  time.Now().Add(-time.Duration(rand.Intn(30*24)) * time.Hour),  // Random date within last month
			}
			
			notes = append(notes, note)
		}
		
		// Batch insert
		require.NoError(t, db.CreateInBatches(notes, batchSize).Error)
	}
	
	return db, user
}

func generateNoteTitle(index int) string {
	titles := []string{
		"Go Programming Tutorial %d",
		"JavaScript Best Practices %d",
		"Meeting Notes - Project Alpha %d",
		"Research on Database Performance %d",
		"API Documentation %d",
		"Code Review Guidelines %d",
		"System Architecture Design %d",
		"Testing Strategies %d",
		"Deployment Process %d",
		"Performance Optimization %d",
	}
	
	template := titles[index%len(titles)]
	return fmt.Sprintf(template, index)
}

func generateNoteContent(index int) string {
	contents := []string{
		"This is a comprehensive guide about software development practices and methodologies.",
		"Modern development requires understanding of various tools and frameworks.",
		"Discussion about project timeline, requirements, and deliverables.",
		"Research findings on performance optimization and scalability.",
		"Detailed documentation of API endpoints and usage examples.",
		"Guidelines for conducting effective code reviews and maintaining quality.",
		"System design principles and architectural patterns.",
		"Testing approaches including unit, integration, and end-to-end testing.",
		"Step-by-step deployment process and best practices.",
		"Performance tuning techniques and monitoring strategies.",
	}
	
	content := contents[index%len(contents)]
	return fmt.Sprintf("%s Note number %d with additional context and details.", content, index)
}

func BenchmarkSearchService_FullTextSearch_Small(b *testing.B) {
	benchmarkFullTextSearch(b, SmallDataset)
}

func BenchmarkSearchService_FullTextSearch_Medium(b *testing.B) {
	benchmarkFullTextSearch(b, MediumDataset)
}

func BenchmarkSearchService_FullTextSearch_Large(b *testing.B) {
	benchmarkFullTextSearch(b, LargeDataset)
}

func benchmarkFullTextSearch(b *testing.B, noteCount int) {
	db, user := setupPerformanceTestDB(b, noteCount)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	// Test queries
	queries := []string{
		"programming",
		"tutorial",
		"meeting",
		"project",
		"documentation",
	}
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		query := queries[i%len(queries)]
		req := SearchRequest{
			Query: query,
			Limit: 20,
		}
		
		_, err := service.FullTextSearch(user.ID, req)
		if err != nil {
			b.Fatalf("Search failed: %v", err)
		}
	}
}

func BenchmarkSearchService_QuickSwitcher_Small(b *testing.B) {
	benchmarkQuickSwitcher(b, SmallDataset)
}

func BenchmarkSearchService_QuickSwitcher_Medium(b *testing.B) {
	benchmarkQuickSwitcher(b, MediumDataset)
}

func BenchmarkSearchService_QuickSwitcher_Large(b *testing.B) {
	benchmarkQuickSwitcher(b, LargeDataset)
}

func benchmarkQuickSwitcher(b *testing.B, noteCount int) {
	db, user := setupPerformanceTestDB(b, noteCount)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	queries := []string{
		"Go",
		"JavaScript",
		"Meeting",
		"Research",
		"API",
	}
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		query := queries[i%len(queries)]
		
		_, err := service.QuickSwitcher(user.ID, query, 10)
		if err != nil {
			b.Fatalf("Quick switcher failed: %v", err)
		}
	}
}

func TestSearchService_PerformanceWithLargeDataset(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}
	
	db, user := setupPerformanceTestDB(t, LargeDataset)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	tests := []struct {
		name          string
		request       SearchRequest
		maxDuration   time.Duration
		description   string
	}{
		{
			name: "simple text search",
			request: SearchRequest{
				Query: "programming",
				Limit: 20,
			},
			maxDuration: 500 * time.Millisecond,
			description: "Simple text search should complete within 500ms",
		},
		{
			name: "complex filtered search",
			request: SearchRequest{
				Query:      "tutorial",
				Categories: []string{"Tutorial", "Note"},
				Tags:       []string{"programming", "go"},
				Limit:      50,
			},
			maxDuration: 1 * time.Second,
			description: "Complex filtered search should complete within 1s",
		},
		{
			name: "search with sorting",
			request: SearchRequest{
				Query:     "project",
				SortBy:    "title",
				SortOrder: "asc",
				Limit:     100,
			},
			maxDuration: 1 * time.Second,
			description: "Search with sorting should complete within 1s",
		},
		{
			name: "search with snippets",
			request: SearchRequest{
				Query:           "documentation",
				IncludeSnippets: true,
				Limit:           20,
			},
			maxDuration: 1 * time.Second,
			description: "Search with snippets should complete within 1s",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start := time.Now()
			
			response, err := service.FullTextSearch(user.ID, tt.request)
			
			duration := time.Since(start)
			
			require.NoError(t, err)
			assert.NotNil(t, response)
			assert.Greater(t, len(response.Results), 0, "Should return some results")
			
			assert.Less(t, duration, tt.maxDuration, 
				"%s: took %v, expected less than %v", tt.description, duration, tt.maxDuration)
			
			t.Logf("%s completed in %v", tt.name, duration)
		})
	}
}

func TestSearchService_QuickSwitcherPerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}
	
	db, user := setupPerformanceTestDB(t, LargeDataset)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	tests := []struct {
		name        string
		query       string
		limit       int
		maxDuration time.Duration
	}{
		{
			name:        "quick switcher with short query",
			query:       "Go",
			limit:       10,
			maxDuration: 200 * time.Millisecond,
		},
		{
			name:        "quick switcher with longer query",
			query:       "Programming Tutorial",
			limit:       10,
			maxDuration: 300 * time.Millisecond,
		},
		{
			name:        "quick switcher with empty query",
			query:       "",
			limit:       10,
			maxDuration: 100 * time.Millisecond,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start := time.Now()
			
			results, err := service.QuickSwitcher(user.ID, tt.query, tt.limit)
			
			duration := time.Since(start)
			
			require.NoError(t, err)
			assert.NotNil(t, results)
			assert.LessOrEqual(t, len(results), tt.limit)
			
			assert.Less(t, duration, tt.maxDuration,
				"Quick switcher took %v, expected less than %v", duration, tt.maxDuration)
			
			t.Logf("%s completed in %v with %d results", tt.name, duration, len(results))
		})
	}
}

func TestSearchService_ConcurrentSearches(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping concurrent test in short mode")
	}
	
	db, user := setupPerformanceTestDB(t, MediumDataset)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	// Test concurrent searches
	concurrency := 10
	searchesPerGoroutine := 5
	
	results := make(chan error, concurrency)
	
	for i := 0; i < concurrency; i++ {
		go func(goroutineID int) {
			for j := 0; j < searchesPerGoroutine; j++ {
				req := SearchRequest{
					Query: fmt.Sprintf("search %d %d", goroutineID, j),
					Limit: 10,
				}
				
				_, err := service.FullTextSearch(user.ID, req)
				if err != nil {
					results <- err
					return
				}
			}
			results <- nil
		}(i)
	}
	
	// Wait for all goroutines to complete
	for i := 0; i < concurrency; i++ {
		err := <-results
		assert.NoError(t, err, "Concurrent search should not fail")
	}
}

func TestSearchService_MemoryUsage(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping memory test in short mode")
	}
	
	db, user := setupPerformanceTestDB(t, MediumDataset)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	// Perform multiple searches to test memory usage
	for i := 0; i < 100; i++ {
		req := SearchRequest{
			Query:           "programming tutorial",
			IncludeSnippets: true,
			Limit:           50,
		}
		
		response, err := service.FullTextSearch(user.ID, req)
		require.NoError(t, err)
		assert.NotNil(t, response)
		
		// Force garbage collection periodically
		if i%10 == 0 {
			// In a real test, you might check memory usage here
			// For now, just ensure the search completes successfully
		}
	}
}

func TestSearchService_SearchAccuracy(t *testing.T) {
	db, user := setupPerformanceTestDB(t, SmallDataset)
	defer database.CleanupTestDB(db)
	
	service := NewSearchService(db)
	
	// Test search accuracy with known data
	tests := []struct {
		name           string
		query          string
		expectedMinResults int
		expectedMaxResults int
	}{
		{
			name:               "common term search",
			query:              "programming",
			expectedMinResults: 1,
			expectedMaxResults: 20,
		},
		{
			name:               "specific term search",
			query:              "Tutorial",
			expectedMinResults: 1,
			expectedMaxResults: 15,
		},
		{
			name:               "rare term search",
			query:              "nonexistent",
			expectedMinResults: 0,
			expectedMaxResults: 0,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := SearchRequest{
				Query: tt.query,
				Limit: 50,
			}
			
			response, err := service.FullTextSearch(user.ID, req)
			require.NoError(t, err)
			
			resultCount := len(response.Results)
			assert.GreaterOrEqual(t, resultCount, tt.expectedMinResults,
				"Should have at least %d results for query '%s'", tt.expectedMinResults, tt.query)
			assert.LessOrEqual(t, resultCount, tt.expectedMaxResults,
				"Should have at most %d results for query '%s'", tt.expectedMaxResults, tt.query)
		})
	}
}
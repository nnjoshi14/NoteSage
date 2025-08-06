package services

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"notesage-server/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SearchService provides advanced search capabilities
type SearchService struct {
	db *gorm.DB
}

// NewSearchService creates a new search service
func NewSearchService(db *gorm.DB) *SearchService {
	return &SearchService{db: db}
}

// SearchRequest represents a search query with filters
type SearchRequest struct {
	Query         string     `json:"query" form:"q"`
	Categories    []string   `json:"categories" form:"categories"`
	Tags          []string   `json:"tags" form:"tags"`
	FolderPath    string     `json:"folder_path" form:"folder_path"`
	IsArchived    *bool      `json:"is_archived" form:"is_archived"`
	IsPinned      *bool      `json:"is_pinned" form:"is_pinned"`
	IsFavorite    *bool      `json:"is_favorite" form:"is_favorite"`
	DateFrom      *time.Time `json:"date_from" form:"date_from"`
	DateTo        *time.Time `json:"date_to" form:"date_to"`
	Limit         int        `json:"limit" form:"limit"`
	Offset        int        `json:"offset" form:"offset"`
	SortBy        string     `json:"sort_by" form:"sort_by"`         // "relevance", "date", "title", "updated"
	SortOrder     string     `json:"sort_order" form:"sort_order"`   // "asc", "desc"
	IncludeSnippets bool     `json:"include_snippets" form:"include_snippets"`
}

// SearchResult represents a search result with ranking and snippets
type SearchResult struct {
	Note      models.Note `json:"note"`
	Score     float64     `json:"score"`
	Snippets  []string    `json:"snippets,omitempty"`
	MatchType string      `json:"match_type"` // "title", "content", "tag", "category"
}

// SearchResponse represents the search response
type SearchResponse struct {
	Results []SearchResult `json:"results"`
	Total   int64          `json:"total"`
	Limit   int            `json:"limit"`
	Offset  int            `json:"offset"`
	Query   string         `json:"query"`
	Took    time.Duration  `json:"took"`
}

// QuickSwitcherResult represents a quick switcher result
type QuickSwitcherResult struct {
	ID       uuid.UUID `json:"id"`
	Title    string    `json:"title"`
	Category string    `json:"category"`
	Score    float64   `json:"score"`
	Path     string    `json:"path"`
}

// RecentNote represents a recently accessed note
type RecentNote struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	Category    string    `json:"category"`
	UpdatedAt   time.Time `json:"updated_at"`
	AccessedAt  time.Time `json:"accessed_at"`
	AccessCount int       `json:"access_count"`
}

// FullTextSearch performs advanced full-text search with ranking
func (s *SearchService) FullTextSearch(userID uuid.UUID, req SearchRequest) (*SearchResponse, error) {
	start := time.Now()
	
	// Set defaults
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}
	if req.Offset < 0 {
		req.Offset = 0
	}
	if req.SortBy == "" {
		req.SortBy = "relevance"
	}
	if req.SortOrder == "" {
		req.SortOrder = "desc"
	}

	var notes []models.Note
	var total int64

	query := s.db.Model(&models.Note{}).Where("user_id = ?", userID)

	// Apply basic filters first
	query = s.applyFilters(query, req)

	// Apply search query if provided
	if req.Query != "" {
		query = s.applySearchQuery(query, req.Query)
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count search results: %w", err)
	}

	// Apply sorting
	query = s.applySorting(query, req)

	// Get paginated results
	if err := query.Limit(req.Limit).Offset(req.Offset).Find(&notes).Error; err != nil {
		return nil, fmt.Errorf("failed to execute search: %w", err)
	}

	// Convert to search results with scoring
	results := make([]SearchResult, len(notes))
	for i, note := range notes {
		result := SearchResult{
			Note:      note,
			Score:     s.calculateRelevanceScore(note, req.Query),
			MatchType: s.determineMatchType(note, req.Query),
		}

		// Generate snippets if requested
		if req.IncludeSnippets && req.Query != "" {
			result.Snippets = s.generateSnippets(note, req.Query)
		}

		results[i] = result
	}

	// Sort by relevance if requested
	if req.SortBy == "relevance" && req.Query != "" {
		sort.Slice(results, func(i, j int) bool {
			if req.SortOrder == "asc" {
				return results[i].Score < results[j].Score
			}
			return results[i].Score > results[j].Score
		})
	}

	return &SearchResponse{
		Results: results,
		Total:   total,
		Limit:   req.Limit,
		Offset:  req.Offset,
		Query:   req.Query,
		Took:    time.Since(start),
	}, nil
}

// QuickSwitcher provides fuzzy search for note navigation
func (s *SearchService) QuickSwitcher(userID uuid.UUID, query string, limit int) ([]QuickSwitcherResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	var notes []models.Note
	
	dbQuery := s.db.Model(&models.Note{}).
		Where("user_id = ? AND is_archived = ?", userID, false).
		Select("id, title, category, folder_path, updated_at")

	if query != "" {
		// Fuzzy search on title with different scoring
		searchQuery := strings.ToLower(query)
		dbQuery = dbQuery.Where("LOWER(title) LIKE ?", "%"+searchQuery+"%")
	}

	if err := dbQuery.Order("is_pinned DESC, updated_at DESC").
		Limit(limit * 2). // Get more results for better fuzzy matching
		Find(&notes).Error; err != nil {
		return nil, fmt.Errorf("failed to execute quick switcher search: %w", err)
	}

	// Convert to quick switcher results with fuzzy scoring
	results := make([]QuickSwitcherResult, 0, len(notes))
	for _, note := range notes {
		score := s.calculateFuzzyScore(note.Title, query)
		if query == "" || score > 0 {
			results = append(results, QuickSwitcherResult{
				ID:       note.ID,
				Title:    note.Title,
				Category: note.Category,
				Score:    score,
				Path:     note.FolderPath,
			})
		}
	}

	// Sort by fuzzy score
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	// Limit final results
	if len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}

// GetRecentNotes retrieves recently accessed notes
func (s *SearchService) GetRecentNotes(userID uuid.UUID, limit int) ([]RecentNote, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	var notes []models.Note
	
	// For now, use updated_at as a proxy for recent access
	// In a full implementation, you'd track actual access times
	if err := s.db.Model(&models.Note{}).
		Where("user_id = ? AND is_archived = ?", userID, false).
		Select("id, title, category, updated_at").
		Order("updated_at DESC").
		Limit(limit).
		Find(&notes).Error; err != nil {
		return nil, fmt.Errorf("failed to get recent notes: %w", err)
	}

	results := make([]RecentNote, len(notes))
	for i, note := range notes {
		results[i] = RecentNote{
			ID:          note.ID,
			Title:       note.Title,
			Category:    note.Category,
			UpdatedAt:   note.UpdatedAt,
			AccessedAt:  note.UpdatedAt, // Using updated_at as proxy
			AccessCount: 1,              // Placeholder
		}
	}

	return results, nil
}

// applyFilters applies search filters to the query
func (s *SearchService) applyFilters(query *gorm.DB, req SearchRequest) *gorm.DB {
	// Exclude archived notes by default unless explicitly requested
	if req.IsArchived == nil {
		query = query.Where("is_archived = ?", false)
	} else {
		query = query.Where("is_archived = ?", *req.IsArchived)
	}

	if len(req.Categories) > 0 {
		query = query.Where("category IN ?", req.Categories)
	}

	if len(req.Tags) > 0 {
		// Build OR conditions for each tag
		tagConditions := make([]string, len(req.Tags))
		tagArgs := make([]interface{}, len(req.Tags))
		for i, tag := range req.Tags {
			tagConditions[i] = "tags LIKE ?"
			tagArgs[i] = "%\"" + tag + "\"%"
		}
		if len(tagConditions) > 0 {
			query = query.Where("("+strings.Join(tagConditions, " OR ")+")", tagArgs...)
		}
	}

	if req.FolderPath != "" {
		query = query.Where("folder_path LIKE ?", req.FolderPath+"%")
	}

	if req.IsPinned != nil {
		query = query.Where("is_pinned = ?", *req.IsPinned)
	}

	if req.IsFavorite != nil {
		query = query.Where("is_favorite = ?", *req.IsFavorite)
	}

	if req.DateFrom != nil {
		query = query.Where("created_at >= ?", *req.DateFrom)
	}

	if req.DateTo != nil {
		query = query.Where("created_at <= ?", *req.DateTo)
	}

	return query
}

// applySearchQuery applies the search query with full-text search
func (s *SearchService) applySearchQuery(query *gorm.DB, searchQuery string) *gorm.DB {
	searchQuery = strings.ToLower(searchQuery)
	
	// Use PostgreSQL full-text search if available, otherwise fall back to LIKE
	// This is a simplified version - in production you'd detect the database type
	return query.Where(
		"LOWER(title) LIKE ? OR LOWER(CAST(content AS TEXT)) LIKE ?",
		"%"+searchQuery+"%",
		"%"+searchQuery+"%",
	)
}

// applySorting applies sorting to the query
func (s *SearchService) applySorting(query *gorm.DB, req SearchRequest) *gorm.DB {
	var orderClause string
	
	switch req.SortBy {
	case "date", "created":
		orderClause = "created_at"
	case "updated":
		orderClause = "updated_at"
	case "title":
		orderClause = "title"
	case "relevance":
		// For relevance, we'll sort after scoring
		orderClause = "updated_at"
	default:
		orderClause = "updated_at"
	}

	if req.SortOrder == "asc" {
		orderClause += " ASC"
	} else {
		orderClause += " DESC"
	}

	// Always prioritize pinned notes
	return query.Order("is_pinned DESC, " + orderClause)
}

// calculateRelevanceScore calculates a relevance score for search results
func (s *SearchService) calculateRelevanceScore(note models.Note, query string) float64 {
	if query == "" {
		return 1.0
	}

	query = strings.ToLower(query)
	title := strings.ToLower(note.Title)
	
	score := 0.0

	// Title exact match gets highest score
	if title == query {
		score += 10.0
	} else if strings.Contains(title, query) {
		// Title contains query
		score += 5.0
		// Bonus for query at start of title
		if strings.HasPrefix(title, query) {
			score += 2.0
		}
	}

	// Content match (simplified - would need to extract text from JSONB)
	if note.Content != nil {
		contentStr := strings.ToLower(fmt.Sprintf("%v", note.Content))
		if strings.Contains(contentStr, query) {
			score += 1.0
		}
	}

	// Category match
	if strings.ToLower(note.Category) == query {
		score += 3.0
	}

	// Tag match
	for _, tag := range note.Tags {
		if strings.ToLower(tag) == query {
			score += 2.0
		} else if strings.Contains(strings.ToLower(tag), query) {
			score += 1.0
		}
	}

	// Recency bonus (newer notes get slight boost)
	daysSinceUpdate := time.Since(note.UpdatedAt).Hours() / 24
	if daysSinceUpdate < 7 {
		score += 0.5
	}

	// Pinned and favorite bonuses
	if note.IsPinned {
		score += 1.0
	}
	if note.IsFavorite {
		score += 0.5
	}

	return score
}

// calculateFuzzyScore calculates fuzzy matching score for quick switcher
func (s *SearchService) calculateFuzzyScore(title, query string) float64 {
	if query == "" {
		return 1.0
	}

	title = strings.ToLower(title)
	query = strings.ToLower(query)

	// Exact match
	if title == query {
		return 10.0
	}

	// Starts with query
	if strings.HasPrefix(title, query) {
		return 8.0
	}

	// Contains query as whole word
	if strings.Contains(title, " "+query+" ") || strings.Contains(title, " "+query) || strings.Contains(title, query+" ") {
		return 6.0
	}

	// Contains query
	if strings.Contains(title, query) {
		return 4.0
	}

	// Fuzzy matching - check if all characters of query appear in order
	titleRunes := []rune(title)
	queryRunes := []rune(query)
	
	if len(queryRunes) == 0 {
		return 1.0
	}

	matches := 0
	titleIndex := 0
	
	for _, queryChar := range queryRunes {
		found := false
		for titleIndex < len(titleRunes) {
			if titleRunes[titleIndex] == queryChar {
				matches++
				titleIndex++
				found = true
				break
			}
			titleIndex++
		}
		if !found {
			break
		}
	}

	if matches == len(queryRunes) {
		// All characters found in order
		ratio := float64(matches) / float64(len(titleRunes))
		return 2.0 * ratio
	}

	return 0.0
}

// determineMatchType determines what type of match occurred
func (s *SearchService) determineMatchType(note models.Note, query string) string {
	if query == "" {
		return "all"
	}

	query = strings.ToLower(query)
	
	// Check title match
	if strings.Contains(strings.ToLower(note.Title), query) {
		return "title"
	}

	// Check category match
	if strings.Contains(strings.ToLower(note.Category), query) {
		return "category"
	}

	// Check tag match
	for _, tag := range note.Tags {
		if strings.Contains(strings.ToLower(tag), query) {
			return "tag"
		}
	}

	// Default to content match
	return "content"
}

// generateSnippets generates text snippets showing search matches
func (s *SearchService) generateSnippets(note models.Note, query string) []string {
	snippets := []string{}
	query = strings.ToLower(query)

	// Title snippet
	if strings.Contains(strings.ToLower(note.Title), query) {
		snippets = append(snippets, s.highlightMatch(note.Title, query))
	}

	// Content snippets (simplified - would need proper JSONB text extraction)
	if note.Content != nil {
		contentStr := fmt.Sprintf("%v", note.Content)
		if strings.Contains(strings.ToLower(contentStr), query) {
			snippet := s.extractSnippet(contentStr, query, 150)
			if snippet != "" {
				snippets = append(snippets, snippet)
			}
		}
	}

	return snippets
}

// highlightMatch highlights the search query in text
func (s *SearchService) highlightMatch(text, query string) string {
	// Simple highlighting - in a real implementation you'd use proper HTML escaping
	lowerText := strings.ToLower(text)
	lowerQuery := strings.ToLower(query)
	
	index := strings.Index(lowerText, lowerQuery)
	if index == -1 {
		return text
	}

	return text[:index] + "**" + text[index:index+len(query)] + "**" + text[index+len(query):]
}

// extractSnippet extracts a snippet around the search match
func (s *SearchService) extractSnippet(text, query string, maxLength int) string {
	lowerText := strings.ToLower(text)
	lowerQuery := strings.ToLower(query)
	
	index := strings.Index(lowerText, lowerQuery)
	if index == -1 {
		// Return beginning of text if no match
		if len(text) > maxLength {
			return text[:maxLength] + "..."
		}
		return text
	}

	// Calculate snippet boundaries
	start := index - maxLength/2
	if start < 0 {
		start = 0
	}
	
	end := start + maxLength
	if end > len(text) {
		end = len(text)
		start = end - maxLength
		if start < 0 {
			start = 0
		}
	}

	snippet := text[start:end]
	
	// Add ellipsis if truncated
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(text) {
		snippet = snippet + "..."
	}

	return s.highlightMatch(snippet, query)
}
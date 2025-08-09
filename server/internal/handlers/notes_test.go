package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/middleware"
	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func setupNotesRouter(t *testing.T) (*gin.Engine, *gorm.DB, *models.User, string) {
	t.Helper()

	db := database.SetupTestDB(t)
	cfg := &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:      "test-secret",
			SessionTimeout: 24 * time.Hour,
		},
	}

	noteHandler := NewNoteHandler(db)
	authHandler := NewAuthHandler(db, cfg)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware(cfg.Auth.JWTSecret))

	notes := api.Group("/notes")
	{
		notes.GET("", noteHandler.GetNotes)
		notes.POST("", noteHandler.CreateNote)
		notes.GET("/search", noteHandler.SearchNotes)
		notes.GET("/archived", noteHandler.GetArchivedNotes)
		notes.GET("/category/:category", noteHandler.GetNotesByCategory)
		notes.GET("/tag/:tag", noteHandler.GetNotesByTag)
		notes.GET("/:id", noteHandler.GetNote)
		notes.PUT("/:id", noteHandler.UpdateNote)
		notes.POST("/:id/archive", noteHandler.ArchiveNote)
		notes.POST("/:id/restore", noteHandler.RestoreNote)
		notes.DELETE("/:id", noteHandler.DeleteNote)
	}

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

	token, _, _ := authHandler.generateToken(*user)

	return router, db, user, token
}

func makeRequest(t *testing.T, router *gin.Engine, method, url, token string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req := httptest.NewRequest(method, url, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	return w
}

func TestCreateNote(t *testing.T) {
	t.Parallel()
	router, _, user, token := setupNotesRouter(t)

	// Test successful note creation
	createReq := CreateNoteRequest{
		Title:      "Test Note",
		Content:    models.JSONB{"type": "doc", "content": []interface{}{}},
		Category:   "Meeting",
		Tags:       []string{"important", "work"},
		FolderPath: "/projects",
	}

	w := makeRequest(t, router, "POST", "/api/notes", token, createReq)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response models.Note
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Test Note", response.Title)
	assert.Equal(t, "Meeting", response.Category)
	assert.Equal(t, "/projects", response.FolderPath)
	assert.Equal(t, pq.StringArray{"important", "work"}, response.Tags)
	assert.Equal(t, user.ID, response.UserID)

	// Test validation error
	invalidReq := CreateNoteRequest{
		Title: "", // Empty title should fail
	}

	w = makeRequest(t, router, "POST", "/api/notes", token, invalidReq)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetNotes(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test notes
	notes := []models.Note{
		{
			UserID:     user.ID,
			Title:      "Note 1",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			Tags:       pq.StringArray{"tag1"},
			IsPinned:   true,
		},
		{
			UserID:     user.ID,
			Title:      "Note 2",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Meeting",
			Tags:       pq.StringArray{"tag2"},
			IsArchived: true,
		},
		{
			UserID:     user.ID,
			Title:      "Note 3",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			Tags:       pq.StringArray{"tag1", "tag3"},
		},
	}

	for i := range notes {
		err := db.Create(&notes[i]).Error
		assert.NoError(t, err)
	}

	// Test get all notes (should exclude archived)
	w := makeRequest(t, router, "GET", "/api/notes", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), response.Total) // Should exclude archived note
	assert.Len(t, response.Notes, 2)

	// Test filtering by category
	w = makeRequest(t, router, "GET", "/api/notes?categories=Meeting", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(0), response.Total) // Meeting note is archived

	// Test filtering by tags
	w = makeRequest(t, router, "GET", "/api/notes?tags=tag1", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), response.Total) // Two notes have tag1

	// Test pagination
	w = makeRequest(t, router, "GET", "/api/notes?limit=1&offset=0", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), response.Total)
	assert.Len(t, response.Notes, 1)
	assert.Equal(t, 1, response.Limit)
	assert.Equal(t, 0, response.Offset)
}

func TestGetNote(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test note
	note := models.Note{
		UserID:   user.ID,
		Title:    "Test Note",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
	}

	err := db.Create(&note).Error
	assert.NoError(t, err)

	// Test successful retrieval
	w := makeRequest(t, router, "GET", fmt.Sprintf("/api/notes/%s", note.ID), token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var response models.Note
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, note.ID, response.ID)
	assert.Equal(t, "Test Note", response.Title)

	// Test note not found
	w = makeRequest(t, router, "GET", fmt.Sprintf("/api/notes/%s", uuid.New()), token, nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateNote(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test note
	note := models.Note{
		UserID:   user.ID,
		Title:    "Original Title",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
		Version:  1,
	}

	err := db.Create(&note).Error
	assert.NoError(t, err)

	// Test successful update
	updateReq := UpdateNoteRequest{
		Title:      stringPtr("Updated Title"),
		Category:   stringPtr("Meeting"),
		Tags:       []string{"updated", "test"},
		IsPinned:   boolPtr(true),
		IsFavorite: boolPtr(true),
	}

	w := makeRequest(t, router, "PUT", fmt.Sprintf("/api/notes/%s", note.ID), token, updateReq)
	assert.Equal(t, http.StatusOK, w.Code)

	var response models.Note
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Updated Title", response.Title)
	assert.Equal(t, "Meeting", response.Category)
	assert.Equal(t, pq.StringArray{"updated", "test"}, response.Tags)
	assert.True(t, response.IsPinned)
	assert.True(t, response.IsFavorite)
	assert.Equal(t, 2, response.Version) // Version should increment

	// Test note not found
	w = makeRequest(t, router, "PUT", fmt.Sprintf("/api/notes/%s", uuid.New()), token, updateReq)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestDeleteNote(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test note
	note := models.Note{
		UserID:   user.ID,
		Title:    "Test Note",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
	}

	err := db.Create(&note).Error
	assert.NoError(t, err)

	// Test successful deletion
	w := makeRequest(t, router, "DELETE", fmt.Sprintf("/api/notes/%s", note.ID), token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	// Verify note is deleted
	var count int64
	db.Model(&models.Note{}).Where("id = ?", note.ID).Count(&count)
	assert.Equal(t, int64(0), count)

	// Test note not found
	w = makeRequest(t, router, "DELETE", fmt.Sprintf("/api/notes/%s", uuid.New()), token, nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSearchNotes(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test notes with different content
	notes := []models.Note{
		{
			UserID:   user.ID,
			Title:    "JavaScript Tutorial",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Learn JavaScript programming"}}},
			Category: "Tutorial",
			Tags:     pq.StringArray{"javascript", "programming"},
		},
		{
			UserID:   user.ID,
			Title:    "Meeting Notes",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Discussed JavaScript framework"}}},
			Category: "Meeting",
			Tags:     pq.StringArray{"meeting", "javascript"},
		},
		{
			UserID:   user.ID,
			Title:    "Python Guide",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Python programming basics"}}},
			Category: "Tutorial",
			Tags:     pq.StringArray{"python", "programming"},
		},
	}

	for i := range notes {
		err := db.Create(&notes[i]).Error
		assert.NoError(t, err)
	}

	// Test search by title
	w := makeRequest(t, router, "GET", "/api/notes/search?q=JavaScript", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), response.Total) // Should find 2 notes with JavaScript

	// Test search with category filter
	w = makeRequest(t, router, "GET", "/api/notes/search?q=JavaScript&categories=Tutorial", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), response.Total) // Should find 1 tutorial about JavaScript

	// Test search with tag filter
	w = makeRequest(t, router, "GET", "/api/notes/search?q=programming&tags=python", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), response.Total) // Should find 1 Python programming note

	// Test empty query
	w = makeRequest(t, router, "GET", "/api/notes/search", token, nil)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestArchiveAndRestoreNote(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test note
	note := models.Note{
		UserID:   user.ID,
		Title:    "Test Note",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
		Version:  1,
	}

	err := db.Create(&note).Error
	assert.NoError(t, err)

	// Test archive note
	w := makeRequest(t, router, "POST", fmt.Sprintf("/api/notes/%s/archive", note.ID), token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	// Verify note is archived
	var updatedNote models.Note
	err = db.First(&updatedNote, note.ID).Error
	assert.NoError(t, err)
	assert.True(t, updatedNote.IsArchived)
	assert.Equal(t, 2, updatedNote.Version)

	// Test restore note
	w = makeRequest(t, router, "POST", fmt.Sprintf("/api/notes/%s/restore", note.ID), token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	// Verify note is restored
	err = db.First(&updatedNote, note.ID).Error
	assert.NoError(t, err)
	assert.False(t, updatedNote.IsArchived)
	assert.Equal(t, 3, updatedNote.Version)

	// Test archive non-existent note
	w = makeRequest(t, router, "POST", fmt.Sprintf("/api/notes/%s/archive", uuid.New()), token, nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetArchivedNotes(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test notes
	notes := []models.Note{
		{
			UserID:     user.ID,
			Title:      "Active Note",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			IsArchived: false,
		},
		{
			UserID:     user.ID,
			Title:      "Archived Note 1",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			IsArchived: true,
		},
		{
			UserID:     user.ID,
			Title:      "Archived Note 2",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Meeting",
			IsArchived: true,
		},
	}

	for i := range notes {
		err := db.Create(&notes[i]).Error
		assert.NoError(t, err)
	}

	// Test get archived notes
	w := makeRequest(t, router, "GET", "/api/notes/archived", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), response.Total) // Should find 2 archived notes
	assert.Len(t, response.Notes, 2)

	// Verify all returned notes are archived
	for _, note := range response.Notes {
		assert.True(t, note.IsArchived)
	}
}

func TestGetNotesByCategory(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test notes
	notes := []models.Note{
		{
			UserID:   user.ID,
			Title:    "Meeting Note 1",
			Content:  models.JSONB{"type": "doc"},
			Category: "Meeting",
		},
		{
			UserID:   user.ID,
			Title:    "Meeting Note 2",
			Content:  models.JSONB{"type": "doc"},
			Category: "Meeting",
		},
		{
			UserID:   user.ID,
			Title:    "Regular Note",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
		},
	}

	for i := range notes {
		err := db.Create(&notes[i]).Error
		assert.NoError(t, err)
	}

	// Test get notes by category
	w := makeRequest(t, router, "GET", "/api/notes/category/Meeting", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), response.Total)
	assert.Len(t, response.Notes, 2)

	// Verify all returned notes have the correct category
	for _, note := range response.Notes {
		assert.Equal(t, "Meeting", note.Category)
	}

	// Test empty category - Gin redirects empty path params
	w = makeRequest(t, router, "GET", "/api/notes/category/", token, nil)
	assert.Equal(t, http.StatusMovedPermanently, w.Code) // Gin returns 301 for trailing slash
}

func TestGetNotesByTag(t *testing.T) {
	t.Parallel()
	router, db, user, token := setupNotesRouter(t)

	// Create test notes
	notes := []models.Note{
		{
			UserID:   user.ID,
			Title:    "Note 1",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
			Tags:     pq.StringArray{"important", "work"},
		},
		{
			UserID:   user.ID,
			Title:    "Note 2",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
			Tags:     pq.StringArray{"important", "personal"},
		},
		{
			UserID:   user.ID,
			Title:    "Note 3",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
			Tags:     pq.StringArray{"work", "project"},
		},
	}

	for i := range notes {
		err := db.Create(&notes[i]).Error
		assert.NoError(t, err)
	}

	// Test get notes by tag
	w := makeRequest(t, router, "GET", "/api/notes/tag/important", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), response.Total)
	assert.Len(t, response.Notes, 2)

	// Verify all returned notes have the tag
	for _, note := range response.Notes {
		assert.Contains(t, []string(note.Tags), "important")
	}

	// Test tag that doesn't exist
	w = makeRequest(t, router, "GET", "/api/notes/tag/nonexistent", token, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(0), response.Total)
	assert.Len(t, response.Notes, 0)
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}

func timePtr(t time.Time) *time.Time {
	return &t
}

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
	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"
)

type NotesTestSuite struct {
	suite.Suite
	db          *gorm.DB
	router      *gin.Engine
	noteHandler *NoteHandler
	authHandler *AuthHandler
	testUser    *models.User
	authToken   string
}

func (suite *NotesTestSuite) SetupSuite() {
	// Initialize test database
	cfg := config.DatabaseConfig{
		Type: "sqlite",
		Name: ":memory:",
	}
	
	db, err := database.Initialize(cfg)
	suite.Require().NoError(err)
	suite.db = db
	
	// Run migrations
	err = database.Migrate(db)
	suite.Require().NoError(err)
	
	// Initialize handlers
	suite.noteHandler = NewNoteHandler(db)
	suite.authHandler = NewAuthHandler(db, &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:      "test-secret",
			SessionTimeout: 24 * time.Hour,
		},
	})
	
	// Setup router
	gin.SetMode(gin.TestMode)
	suite.router = gin.New()
	suite.setupRoutes()
	
	// Create test user and get auth token
	suite.createTestUser()
}

func (suite *NotesTestSuite) TearDownSuite() {
	// Clean up test user
	suite.db.Delete(&models.User{}, suite.testUser.ID)
	sqlDB, _ := suite.db.DB()
	sqlDB.Close()
}

func (suite *NotesTestSuite) SetupTest() {
	// Clean up notes before each test
	suite.db.Where("user_id = ?", suite.testUser.ID).Delete(&models.Note{})
}

func (suite *NotesTestSuite) TearDownTest() {
	// Clean up after each test
	suite.db.Where("user_id = ?", suite.testUser.ID).Delete(&models.Note{})
}

func (suite *NotesTestSuite) setupRoutes() {
	api := suite.router.Group("/api")
	api.Use(middleware.AuthMiddleware("test-secret"))
	
	notes := api.Group("/notes")
	{
		notes.GET("", suite.noteHandler.GetNotes)
		notes.POST("", suite.noteHandler.CreateNote)
		notes.GET("/search", suite.noteHandler.SearchNotes)
		notes.GET("/archived", suite.noteHandler.GetArchivedNotes)
		notes.GET("/category/:category", suite.noteHandler.GetNotesByCategory)
		notes.GET("/tag/:tag", suite.noteHandler.GetNotesByTag)
		notes.GET("/:id", suite.noteHandler.GetNote)
		notes.PUT("/:id", suite.noteHandler.UpdateNote)
		notes.POST("/:id/archive", suite.noteHandler.ArchiveNote)
		notes.POST("/:id/restore", suite.noteHandler.RestoreNote)
		notes.DELETE("/:id", suite.noteHandler.DeleteNote)
	}
}

func (suite *NotesTestSuite) createTestUser() {
	// Clean up any existing test user first
	suite.db.Where("email = ?", "test@example.com").Delete(&models.User{})
	
	user := &models.User{
		ID:       uuid.New(),
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	
	err := suite.db.Create(user).Error
	suite.Require().NoError(err)
	suite.testUser = user
	
	// Generate auth token
	token, _, err := suite.authHandler.generateToken(*user)
	suite.Require().NoError(err)
	suite.authToken = token
}

func (suite *NotesTestSuite) makeRequest(method, url string, body interface{}) *httptest.ResponseRecorder {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}
	
	req := httptest.NewRequest(method, url, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+suite.authToken)
	
	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)
	
	return w
}

func (suite *NotesTestSuite) TestCreateNote() {
	// Test successful note creation
	createReq := CreateNoteRequest{
		Title:      "Test Note",
		Content:    models.JSONB{"type": "doc", "content": []interface{}{}},
		Category:   "Meeting",
		Tags:       []string{"important", "work"},
		FolderPath: "/projects",
	}
	
	w := suite.makeRequest("POST", "/api/notes", createReq)
	
	assert.Equal(suite.T(), http.StatusCreated, w.Code)
	
	var response models.Note
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "Test Note", response.Title)
	assert.Equal(suite.T(), "Meeting", response.Category)
	assert.Equal(suite.T(), "/projects", response.FolderPath)
	assert.Equal(suite.T(), pq.StringArray{"important", "work"}, response.Tags)
	assert.Equal(suite.T(), suite.testUser.ID, response.UserID)
	
	// Test validation error
	invalidReq := CreateNoteRequest{
		Title: "", // Empty title should fail
	}
	
	w = suite.makeRequest("POST", "/api/notes", invalidReq)
	assert.Equal(suite.T(), http.StatusBadRequest, w.Code)
}

func (suite *NotesTestSuite) TestGetNotes() {
	// Create test notes
	notes := []models.Note{
		{
			UserID:     suite.testUser.ID,
			Title:      "Note 1",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			Tags:       pq.StringArray{"tag1"},
			IsPinned:   true,
		},
		{
			UserID:     suite.testUser.ID,
			Title:      "Note 2",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Meeting",
			Tags:       pq.StringArray{"tag2"},
			IsArchived: true,
		},
		{
			UserID:     suite.testUser.ID,
			Title:      "Note 3",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			Tags:       pq.StringArray{"tag1", "tag3"},
		},
	}
	
	for i := range notes {
		err := suite.db.Create(&notes[i]).Error
		suite.Require().NoError(err)
	}
	
	// Test get all notes (should exclude archived)
	w := suite.makeRequest("GET", "/api/notes", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), response.Total) // Should exclude archived note
	assert.Len(suite.T(), response.Notes, 2)
	
	// Test filtering by category
	w = suite.makeRequest("GET", "/api/notes?categories=Meeting", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(0), response.Total) // Meeting note is archived
	
	// Test filtering by tags
	w = suite.makeRequest("GET", "/api/notes?tags=tag1", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), response.Total) // Two notes have tag1
	
	// Test pagination
	w = suite.makeRequest("GET", "/api/notes?limit=1&offset=0", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), response.Total)
	assert.Len(suite.T(), response.Notes, 1)
	assert.Equal(suite.T(), 1, response.Limit)
	assert.Equal(suite.T(), 0, response.Offset)
}

func (suite *NotesTestSuite) TestGetNote() {
	// Create test note
	note := models.Note{
		UserID:   suite.testUser.ID,
		Title:    "Test Note",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
	}
	
	err := suite.db.Create(&note).Error
	suite.Require().NoError(err)
	
	// Test successful retrieval
	w := suite.makeRequest("GET", fmt.Sprintf("/api/notes/%s", note.ID), nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var response models.Note
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), note.ID, response.ID)
	assert.Equal(suite.T(), "Test Note", response.Title)
	
	// Test note not found
	w = suite.makeRequest("GET", fmt.Sprintf("/api/notes/%s", uuid.New()), nil)
	assert.Equal(suite.T(), http.StatusNotFound, w.Code)
}

func (suite *NotesTestSuite) TestUpdateNote() {
	// Create test note
	note := models.Note{
		UserID:   suite.testUser.ID,
		Title:    "Original Title",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
		Version:  1,
	}
	
	err := suite.db.Create(&note).Error
	suite.Require().NoError(err)
	
	// Test successful update
	updateReq := UpdateNoteRequest{
		Title:      stringPtr("Updated Title"),
		Category:   stringPtr("Meeting"),
		Tags:       []string{"updated", "test"},
		IsPinned:   boolPtr(true),
		IsFavorite: boolPtr(true),
	}
	
	w := suite.makeRequest("PUT", fmt.Sprintf("/api/notes/%s", note.ID), updateReq)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var response models.Note
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "Updated Title", response.Title)
	assert.Equal(suite.T(), "Meeting", response.Category)
	assert.Equal(suite.T(), pq.StringArray{"updated", "test"}, response.Tags)
	assert.True(suite.T(), response.IsPinned)
	assert.True(suite.T(), response.IsFavorite)
	assert.Equal(suite.T(), 2, response.Version) // Version should increment
	
	// Test note not found
	w = suite.makeRequest("PUT", fmt.Sprintf("/api/notes/%s", uuid.New()), updateReq)
	assert.Equal(suite.T(), http.StatusNotFound, w.Code)
}

func (suite *NotesTestSuite) TestDeleteNote() {
	// Create test note
	note := models.Note{
		UserID:   suite.testUser.ID,
		Title:    "Test Note",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
	}
	
	err := suite.db.Create(&note).Error
	suite.Require().NoError(err)
	
	// Test successful deletion
	w := suite.makeRequest("DELETE", fmt.Sprintf("/api/notes/%s", note.ID), nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	// Verify note is deleted
	var count int64
	suite.db.Model(&models.Note{}).Where("id = ?", note.ID).Count(&count)
	assert.Equal(suite.T(), int64(0), count)
	
	// Test note not found
	w = suite.makeRequest("DELETE", fmt.Sprintf("/api/notes/%s", uuid.New()), nil)
	assert.Equal(suite.T(), http.StatusNotFound, w.Code)
}

func (suite *NotesTestSuite) TestSearchNotes() {
	// Create test notes with different content
	notes := []models.Note{
		{
			UserID:   suite.testUser.ID,
			Title:    "JavaScript Tutorial",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Learn JavaScript programming"}}},
			Category: "Tutorial",
			Tags:     pq.StringArray{"javascript", "programming"},
		},
		{
			UserID:   suite.testUser.ID,
			Title:    "Meeting Notes",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Discussed JavaScript framework"}}},
			Category: "Meeting",
			Tags:     pq.StringArray{"meeting", "javascript"},
		},
		{
			UserID:   suite.testUser.ID,
			Title:    "Python Guide",
			Content:  models.JSONB{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "text", "text": "Python programming basics"}}},
			Category: "Tutorial",
			Tags:     pq.StringArray{"python", "programming"},
		},
	}
	
	for i := range notes {
		err := suite.db.Create(&notes[i]).Error
		suite.Require().NoError(err)
	}
	
	// Test search by title
	w := suite.makeRequest("GET", "/api/notes/search?q=JavaScript", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), response.Total) // Should find 2 notes with JavaScript
	
	// Test search with category filter
	w = suite.makeRequest("GET", "/api/notes/search?q=JavaScript&categories=Tutorial", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), response.Total) // Should find 1 tutorial about JavaScript
	
	// Test search with tag filter
	w = suite.makeRequest("GET", "/api/notes/search?q=programming&tags=python", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), response.Total) // Should find 1 Python programming note
	
	// Test empty query
	w = suite.makeRequest("GET", "/api/notes/search", nil)
	assert.Equal(suite.T(), http.StatusBadRequest, w.Code)
}

func (suite *NotesTestSuite) TestArchiveAndRestoreNote() {
	// Create test note
	note := models.Note{
		UserID:   suite.testUser.ID,
		Title:    "Test Note",
		Content:  models.JSONB{"type": "doc"},
		Category: "Note",
		Version:  1,
	}
	
	err := suite.db.Create(&note).Error
	suite.Require().NoError(err)
	
	// Test archive note
	w := suite.makeRequest("POST", fmt.Sprintf("/api/notes/%s/archive", note.ID), nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	// Verify note is archived
	var updatedNote models.Note
	err = suite.db.First(&updatedNote, note.ID).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), updatedNote.IsArchived)
	assert.Equal(suite.T(), 2, updatedNote.Version)
	
	// Test restore note
	w = suite.makeRequest("POST", fmt.Sprintf("/api/notes/%s/restore", note.ID), nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	// Verify note is restored
	err = suite.db.First(&updatedNote, note.ID).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), updatedNote.IsArchived)
	assert.Equal(suite.T(), 3, updatedNote.Version)
	
	// Test archive non-existent note
	w = suite.makeRequest("POST", fmt.Sprintf("/api/notes/%s/archive", uuid.New()), nil)
	assert.Equal(suite.T(), http.StatusNotFound, w.Code)
}

func (suite *NotesTestSuite) TestGetArchivedNotes() {
	// Create test notes
	notes := []models.Note{
		{
			UserID:     suite.testUser.ID,
			Title:      "Active Note",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			IsArchived: false,
		},
		{
			UserID:     suite.testUser.ID,
			Title:      "Archived Note 1",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Note",
			IsArchived: true,
		},
		{
			UserID:     suite.testUser.ID,
			Title:      "Archived Note 2",
			Content:    models.JSONB{"type": "doc"},
			Category:   "Meeting",
			IsArchived: true,
		},
	}
	
	for i := range notes {
		err := suite.db.Create(&notes[i]).Error
		suite.Require().NoError(err)
	}
	
	// Test get archived notes
	w := suite.makeRequest("GET", "/api/notes/archived", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), response.Total) // Should find 2 archived notes
	assert.Len(suite.T(), response.Notes, 2)
	
	// Verify all returned notes are archived
	for _, note := range response.Notes {
		assert.True(suite.T(), note.IsArchived)
	}
}

func (suite *NotesTestSuite) TestGetNotesByCategory() {
	// Create test notes
	notes := []models.Note{
		{
			UserID:   suite.testUser.ID,
			Title:    "Meeting Note 1",
			Content:  models.JSONB{"type": "doc"},
			Category: "Meeting",
		},
		{
			UserID:   suite.testUser.ID,
			Title:    "Meeting Note 2",
			Content:  models.JSONB{"type": "doc"},
			Category: "Meeting",
		},
		{
			UserID:   suite.testUser.ID,
			Title:    "Regular Note",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
		},
	}
	
	for i := range notes {
		err := suite.db.Create(&notes[i]).Error
		suite.Require().NoError(err)
	}
	
	// Test get notes by category
	w := suite.makeRequest("GET", "/api/notes/category/Meeting", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), response.Total)
	assert.Len(suite.T(), response.Notes, 2)
	
	// Verify all returned notes have the correct category
	for _, note := range response.Notes {
		assert.Equal(suite.T(), "Meeting", note.Category)
	}
	
	// Test empty category - Gin redirects empty path params
	w = suite.makeRequest("GET", "/api/notes/category/", nil)
	assert.Equal(suite.T(), http.StatusMovedPermanently, w.Code) // Gin returns 301 for trailing slash
}

func (suite *NotesTestSuite) TestGetNotesByTag() {
	// Create test notes
	notes := []models.Note{
		{
			UserID:   suite.testUser.ID,
			Title:    "Note 1",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
			Tags:     pq.StringArray{"important", "work"},
		},
		{
			UserID:   suite.testUser.ID,
			Title:    "Note 2",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
			Tags:     pq.StringArray{"important", "personal"},
		},
		{
			UserID:   suite.testUser.ID,
			Title:    "Note 3",
			Content:  models.JSONB{"type": "doc"},
			Category: "Note",
			Tags:     pq.StringArray{"work", "project"},
		},
	}
	
	for i := range notes {
		err := suite.db.Create(&notes[i]).Error
		suite.Require().NoError(err)
	}
	
	// Test get notes by tag
	w := suite.makeRequest("GET", "/api/notes/tag/important", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var response NotesResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), response.Total)
	assert.Len(suite.T(), response.Notes, 2)
	
	// Verify all returned notes have the tag
	for _, note := range response.Notes {
		assert.Contains(suite.T(), []string(note.Tags), "important")
	}
	
	// Test tag that doesn't exist
	w = suite.makeRequest("GET", "/api/notes/tag/nonexistent", nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(0), response.Total)
	assert.Len(suite.T(), response.Notes, 0)
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

func TestNotesTestSuite(t *testing.T) {
	suite.Run(t, new(NotesTestSuite))
}
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"notesage-server/internal/database"
	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPeopleTestDB(t *testing.T) (*gorm.DB, uuid.UUID) {
	db := database.SetupTestDB(t)
	
	// Create test user with unique email
	userID := uuid.New()
	testUser := &models.User{
		ID:       userID,
		Username: "testuser_" + userID.String()[:8],
		Email:    "test_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	require.NoError(t, db.Create(testUser).Error)
	
	return db, userID
}

func createTestPerson(t *testing.T, db *gorm.DB, userID uuid.UUID) *models.Person {
	person := &models.Person{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        "John Doe",
		Email:       "john@example.com",
		Phone:       "+1234567890",
		Company:     "Test Company",
		Title:       "Software Engineer",
		LinkedinURL: "https://linkedin.com/in/johndoe",
		AvatarURL:   "https://example.com/avatar.jpg",
		Notes:       "Test notes about John",
	}
	require.NoError(t, db.Create(person).Error)
	return person
}

func createTestNote(t *testing.T, db *gorm.DB, userID uuid.UUID) *models.Note {
	note := &models.Note{
		ID:      uuid.New(),
		UserID:  userID,
		Title:   "Test Note",
		Content: models.JSONB{"type": "doc", "content": []interface{}{}},
	}
	require.NoError(t, db.Create(note).Error)
	return note
}

func TestPersonHandler_GetPeople(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	// Create test people
	person1 := createTestPerson(t, db, userID)
	person2 := &models.Person{
		ID:      uuid.New(),
		UserID:  userID,
		Name:    "Jane Smith",
		Email:   "jane@example.com",
		Company: "Another Company",
	}
	require.NoError(t, db.Create(person2).Error)
	
	tests := []struct {
		name           string
		queryParams    string
		expectedCount  int
		expectedStatus int
	}{
		{
			name:           "Get all people",
			queryParams:    "",
			expectedCount:  2,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Search by name",
			queryParams:    "?search=john",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Search by company",
			queryParams:    "?company=Test%20Company",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Search with limit",
			queryParams:    "?limit=1",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			req := httptest.NewRequest("GET", "/people"+tt.queryParams, nil)
			c.Request = req
			c.Set("userID", userID.String())
			
			handler.GetPeople(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var people []models.Person
				err := json.Unmarshal(w.Body.Bytes(), &people)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedCount, len(people))
				
				if tt.queryParams == "?search=john" {
					assert.Equal(t, person1.Name, people[0].Name)
				}
			}
		})
	}
}

func TestPersonHandler_CreatePerson(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	tests := []struct {
		name           string
		request        CreatePersonRequest
		expectedStatus int
		expectedError  string
	}{
		{
			name: "Valid person creation",
			request: CreatePersonRequest{
				Name:        "Test Person",
				Email:       "test@example.com",
				Phone:       "+1234567890",
				Company:     "Test Company",
				Title:       "Engineer",
				LinkedinURL: "https://linkedin.com/in/test",
				AvatarURL:   "https://example.com/avatar.jpg",
				Notes:       "Test notes",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "Missing required name",
			request: CreatePersonRequest{
				Email: "test@example.com",
			},
			expectedStatus: http.StatusBadRequest,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			body, _ := json.Marshal(tt.request)
			req := httptest.NewRequest("POST", "/people", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			c.Request = req
			c.Set("userID", userID.String())
			
			handler.CreatePerson(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusCreated {
				var person models.Person
				err := json.Unmarshal(w.Body.Bytes(), &person)
				require.NoError(t, err)
				assert.Equal(t, tt.request.Name, person.Name)
				assert.Equal(t, tt.request.Email, person.Email)
				assert.Equal(t, userID, person.UserID)
			}
		})
	}
}

func TestPersonHandler_GetPerson(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	person := createTestPerson(t, db, userID)
	
	tests := []struct {
		name           string
		personID       string
		expectedStatus int
	}{
		{
			name:           "Valid person ID",
			personID:       person.ID.String(),
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Invalid person ID",
			personID:       uuid.New().String(),
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Invalid UUID format",
			personID:       "invalid-uuid",
			expectedStatus: http.StatusNotFound,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			req := httptest.NewRequest("GET", "/people/"+tt.personID, nil)
			c.Request = req
			c.Set("userID", userID.String())
			c.Params = []gin.Param{{Key: "id", Value: tt.personID}}
			
			handler.GetPerson(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var returnedPerson models.Person
				err := json.Unmarshal(w.Body.Bytes(), &returnedPerson)
				require.NoError(t, err)
				assert.Equal(t, person.ID, returnedPerson.ID)
				assert.Equal(t, person.Name, returnedPerson.Name)
			}
		})
	}
}

func TestPersonHandler_UpdatePerson(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	person := createTestPerson(t, db, userID)
	
	tests := []struct {
		name           string
		personID       string
		request        UpdatePersonRequest
		expectedStatus int
	}{
		{
			name:     "Valid update",
			personID: person.ID.String(),
			request: UpdatePersonRequest{
				Name:    stringPtr("Updated Name"),
				Email:   stringPtr("updated@example.com"),
				Company: stringPtr("Updated Company"),
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Person not found",
			personID:       uuid.New().String(),
			request:        UpdatePersonRequest{Name: stringPtr("Test")},
			expectedStatus: http.StatusNotFound,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			body, _ := json.Marshal(tt.request)
			req := httptest.NewRequest("PUT", "/people/"+tt.personID, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			c.Request = req
			c.Set("userID", userID.String())
			c.Params = []gin.Param{{Key: "id", Value: tt.personID}}
			
			handler.UpdatePerson(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var updatedPerson models.Person
				err := json.Unmarshal(w.Body.Bytes(), &updatedPerson)
				require.NoError(t, err)
				if tt.request.Name != nil {
					assert.Equal(t, *tt.request.Name, updatedPerson.Name)
				}
				if tt.request.Email != nil {
					assert.Equal(t, *tt.request.Email, updatedPerson.Email)
				}
			}
		})
	}
}

func TestPersonHandler_DeletePerson(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	person := createTestPerson(t, db, userID)
	
	tests := []struct {
		name           string
		personID       string
		expectedStatus int
	}{
		{
			name:           "Valid deletion",
			personID:       person.ID.String(),
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Person not found",
			personID:       uuid.New().String(),
			expectedStatus: http.StatusNotFound,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			req := httptest.NewRequest("DELETE", "/people/"+tt.personID, nil)
			c.Request = req
			c.Set("userID", userID.String())
			c.Params = []gin.Param{{Key: "id", Value: tt.personID}}
			
			handler.DeletePerson(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				// Verify person was deleted
				var count int64
				db.Model(&models.Person{}).Where("id = ?", tt.personID).Count(&count)
				assert.Equal(t, int64(0), count)
			}
		})
	}
}

func TestPersonHandler_SearchPeople(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	// Create test people
	person1 := createTestPerson(t, db, userID)
	person2 := &models.Person{
		ID:      uuid.New(),
		UserID:  userID,
		Name:    "Jane Smith",
		Email:   "jane@example.com",
		Company: "Different Company",
	}
	require.NoError(t, db.Create(person2).Error)
	
	tests := []struct {
		name           string
		query          string
		expectedCount  int
		expectedStatus int
	}{
		{
			name:           "Search by name",
			query:          "john",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Search by email",
			query:          "jane@example.com",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Search by company",
			query:          "Test%20Company",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "No results",
			query:          "nonexistent",
			expectedCount:  0,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Empty query",
			query:          "",
			expectedStatus: http.StatusBadRequest,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			req := httptest.NewRequest("GET", "/people/search?q="+tt.query, nil)
			c.Request = req
			c.Set("userID", userID.String())
			
			handler.SearchPeople(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var people []models.Person
				err := json.Unmarshal(w.Body.Bytes(), &people)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedCount, len(people))
				
				if tt.query == "john" && len(people) > 0 {
					assert.Equal(t, person1.Name, people[0].Name)
				}
			}
		})
	}
}

func TestPersonHandler_GetPersonConnections(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	person := createTestPerson(t, db, userID)
	note := createTestNote(t, db, userID)
	
	// Create a connection
	connection := &models.Connection{
		ID:         uuid.New(),
		UserID:     userID,
		SourceID:   person.ID,
		SourceType: "person",
		TargetID:   note.ID,
		TargetType: "note",
		Strength:   1,
	}
	require.NoError(t, db.Create(connection).Error)
	
	// Create a todo assigned to the person
	todo := &models.Todo{
		ID:               uuid.New(),
		NoteID:           note.ID,
		TodoID:           "t1",
		Text:             "Test todo",
		AssignedPersonID: &person.ID,
	}
	require.NoError(t, db.Create(todo).Error)
	
	tests := []struct {
		name           string
		personID       string
		expectedStatus int
	}{
		{
			name:           "Valid person connections",
			personID:       person.ID.String(),
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Person not found",
			personID:       uuid.New().String(),
			expectedStatus: http.StatusNotFound,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			req := httptest.NewRequest("GET", "/people/"+tt.personID+"/connections", nil)
			c.Request = req
			c.Set("userID", userID.String())
			c.Params = []gin.Param{{Key: "id", Value: tt.personID}}
			
			handler.GetPersonConnections(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response PersonConnectionsResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				assert.Equal(t, person.ID, response.Person.ID)
				assert.Equal(t, 1, response.TotalNotes)
				assert.Equal(t, 1, response.TotalTodos)
				assert.Equal(t, 1, len(response.Notes))
				assert.Equal(t, note.ID, response.Notes[0].NoteID)
			}
		})
	}
}

func TestPersonHandler_CreatePersonConnection(t *testing.T) {
	db, userID := setupPeopleTestDB(t)
	handler := NewPersonHandler(db)
	
	person := createTestPerson(t, db, userID)
	note := createTestNote(t, db, userID)
	
	tests := []struct {
		name           string
		personID       string
		request        map[string]string
		expectedStatus int
	}{
		{
			name:     "Valid connection creation",
			personID: person.ID.String(),
			request: map[string]string{
				"note_id": note.ID.String(),
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:     "Person not found",
			personID: uuid.New().String(),
			request: map[string]string{
				"note_id": note.ID.String(),
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:     "Note not found",
			personID: person.ID.String(),
			request: map[string]string{
				"note_id": uuid.New().String(),
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Missing note_id",
			personID:       person.ID.String(),
			request:        map[string]string{},
			expectedStatus: http.StatusBadRequest,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			
			body, _ := json.Marshal(tt.request)
			req := httptest.NewRequest("POST", "/people/"+tt.personID+"/connections", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			c.Request = req
			c.Set("userID", userID.String())
			c.Params = []gin.Param{{Key: "id", Value: tt.personID}}
			
			handler.CreatePersonConnection(c)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusCreated {
				var connection models.Connection
				err := json.Unmarshal(w.Body.Bytes(), &connection)
				require.NoError(t, err)
				assert.Equal(t, userID, connection.UserID)
				assert.Equal(t, "person", connection.SourceType)
				assert.Equal(t, "note", connection.TargetType)
			}
		})
	}
}


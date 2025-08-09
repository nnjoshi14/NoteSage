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

func setupPeopleRouter(t *testing.T) (*gin.Engine, *gorm.DB, *models.User) {
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

	personHandler := NewPersonHandler(db)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	people := router.Group("/people")
	{
		people.GET("", personHandler.GetPeople)
		people.POST("", personHandler.CreatePerson)
		people.GET("/search", personHandler.SearchPeople)
		people.GET("/:id", personHandler.GetPerson)
		people.PUT("/:id", personHandler.UpdatePerson)
		people.DELETE("/:id", personHandler.DeletePerson)
		people.GET("/:id/connections", personHandler.GetPersonConnections)
		people.POST("/:id/connections", personHandler.CreatePersonConnection)
	}

	return router, db, user
}

func TestGetPeople(t *testing.T) {
	t.Parallel()
	router, db, user := setupPeopleRouter(t)

	// Create test people
	_ = createTestPerson(t, db, user.ID)
	person2 := &models.Person{
		ID:      uuid.New(),
		UserID:  user.ID,
		Name:    "Jane Smith",
		Email:   "jane@example.com",
		Company: "Another Company",
	}
	require.NoError(t, db.Create(person2).Error)

	w := makePeopleRequest(t, router, "GET", "/people", user.ID, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var people []models.Person
	err := json.Unmarshal(w.Body.Bytes(), &people)
	require.NoError(t, err)
	assert.Len(t, people, 2)
}

func TestCreatePerson(t *testing.T) {
	t.Parallel()
	router, _, user := setupPeopleRouter(t)

	createReq := CreatePersonRequest{
		Name:  "Test Person",
		Email: "test@example.com",
	}

	w := makePeopleRequest(t, router, "POST", "/people", user.ID, createReq)
	assert.Equal(t, http.StatusCreated, w.Code)

	var person models.Person
	err := json.Unmarshal(w.Body.Bytes(), &person)
	require.NoError(t, err)
	assert.Equal(t, createReq.Name, person.Name)
	assert.Equal(t, createReq.Email, person.Email)
	assert.Equal(t, user.ID, person.UserID)
}

func TestGetPerson(t *testing.T) {
	t.Parallel()
	router, db, user := setupPeopleRouter(t)

	person := createTestPerson(t, db, user.ID)

	w := makePeopleRequest(t, router, "GET", "/people/"+person.ID.String(), user.ID, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var returnedPerson models.Person
	err := json.Unmarshal(w.Body.Bytes(), &returnedPerson)
	require.NoError(t, err)
	assert.Equal(t, person.ID, returnedPerson.ID)
}

func TestUpdatePerson(t *testing.T) {
	t.Parallel()
	router, db, user := setupPeopleRouter(t)

	person := createTestPerson(t, db, user.ID)

	updateReq := UpdatePersonRequest{
		Name: stringPtr("Updated Name"),
	}

	w := makePeopleRequest(t, router, "PUT", "/people/"+person.ID.String(), user.ID, updateReq)
	assert.Equal(t, http.StatusOK, w.Code)

	var updatedPerson models.Person
	err := json.Unmarshal(w.Body.Bytes(), &updatedPerson)
	require.NoError(t, err)
	assert.Equal(t, *updateReq.Name, updatedPerson.Name)
}

func TestDeletePerson(t *testing.T) {
	t.Parallel()
	router, db, user := setupPeopleRouter(t)

	person := createTestPerson(t, db, user.ID)

	w := makePeopleRequest(t, router, "DELETE", "/people/"+person.ID.String(), user.ID, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var count int64
	db.Model(&models.Person{}).Where("id = ?", person.ID).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestSearchPeople(t *testing.T) {
	t.Parallel()
	router, db, user := setupPeopleRouter(t)

	createTestPerson(t, db, user.ID)

	w := makePeopleRequest(t, router, "GET", "/people/search?q=john", user.ID, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var people []models.Person
	err := json.Unmarshal(w.Body.Bytes(), &people)
	require.NoError(t, err)
	assert.Len(t, people, 1)
}

func TestGetPersonConnections(t *testing.T) {
	t.Parallel()
	router, db, user := setupPeopleRouter(t)

	person := createTestPerson(t, db, user.ID)
	note := createTestNote(t, db, user.ID)

	connection := &models.Connection{
		ID:         uuid.New(),
		UserID:     user.ID,
		SourceID:   person.ID,
		SourceType: "person",
		TargetID:   note.ID,
		TargetType: "note",
		Strength:   1,
	}
	require.NoError(t, db.Create(connection).Error)

	w := makePeopleRequest(t, router, "GET", "/people/"+person.ID.String()+"/connections", user.ID, nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var response PersonConnectionsResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, person.ID, response.Person.ID)
	assert.Equal(t, 1, response.TotalNotes)
}

func TestCreatePersonConnection(t *testing.T) {
	t.Parallel()
	router, db, user := setupPeopleRouter(t)

	person := createTestPerson(t, db, user.ID)
	note := createTestNote(t, db, user.ID)

	createReq := map[string]string{
		"note_id": note.ID.String(),
	}

	w := makePeopleRequest(t, router, "POST", "/people/"+person.ID.String()+"/connections", user.ID, createReq)
	assert.Equal(t, http.StatusCreated, w.Code)

	var connection models.Connection
	err := json.Unmarshal(w.Body.Bytes(), &connection)
	require.NoError(t, err)
	assert.Equal(t, user.ID, connection.UserID)
	assert.Equal(t, person.ID, connection.SourceID)
	assert.Equal(t, note.ID, connection.TargetID)
}

// Helper function to make requests to the people handler
func makePeopleRequest(t *testing.T, router *gin.Engine, method, url string, userID uuid.UUID, body interface{}) *httptest.ResponseRecorder {
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

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID.String())

	// This is a hack to set the URL parameter for tests
	if method != "POST" && method != "GET" {
		// get id from url
		parts := bytes.Split([]byte(url), []byte("/"))
		id := string(parts[len(parts)-1])
		c.Params = gin.Params{{Key: "id", Value: id}}
	}

	router.ServeHTTP(w, c.Request)
	return w
}

func createTestPerson(t *testing.T, db *gorm.DB, userID uuid.UUID) *models.Person {
	t.Helper()
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
	t.Helper()
	note := &models.Note{
		ID:      uuid.New(),
		UserID:  userID,
		Title:   "Test Note",
		Content: models.JSONB{"type": "doc", "content": []interface{}{}},
	}
	require.NoError(t, db.Create(note).Error)
	return note
}

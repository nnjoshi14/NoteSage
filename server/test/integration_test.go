package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/models"
	"notesage-server/internal/router"
)

func setupIntegrationTest(t *testing.T) (*httptest.Server, *gorm.DB, string) {
	t.Helper()

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			Type: "sqlite",
			Name: ":memory:",
		},
		Auth: config.AuthConfig{
			JWTSecret: "test-secret",
		},
		Features: config.FeaturesConfig{
			AIEnabled: false,
		},
		AI: config.AIConfig{
			Provider: "disabled",
			APIKey:   "",
		},
	}

	db := database.SetupTestDB(t)

	// Setup router
	gin.SetMode(gin.TestMode)
	appRouter := router.Setup(db, cfg)
	server := httptest.NewServer(appRouter)

	// Create test user
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	// Create user
	userJSON, _ := json.Marshal(user)
	resp, err := http.Post(server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Login to get token
	loginData := map[string]string{
		"username": "testuser",
		"password": "password123",
	}
	loginJSON, _ := json.Marshal(loginData)
	resp, err = http.Post(server.URL+"/api/auth/login", "application/json", bytes.NewBuffer(loginJSON))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var loginResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResp)
	token := loginResp["token"].(string)

	t.Cleanup(func() {
		server.Close()
	})

	return server, db, token
}

func makeAuthenticatedRequest(t *testing.T, server *httptest.Server, token, method, path string, body interface{}) *http.Response {
	t.Helper()

	var reqBody *bytes.Buffer
	if body != nil {
		bodyJSON, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(bodyJSON)
	} else {
		reqBody = bytes.NewBuffer([]byte{})
	}

	req, err := http.NewRequest(method, server.URL+path, reqBody)
	require.NoError(t, err)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)

	return resp
}

func TestNoteWorkflow(t *testing.T) {
	t.Parallel()
	server, _, token := setupIntegrationTest(t)

	// Create note
	note := map[string]interface{}{
		"title":   "Integration Test Note",
		"content": map[string]interface{}{"type": "doc", "content": []interface{}{}},
	}

	resp := makeAuthenticatedRequest(t, server, token, "POST", "/api/notes", note)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var createdNote map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdNote)
	noteID := createdNote["id"].(string)

	// Get note
	resp = makeAuthenticatedRequest(t, server, token, "GET", "/api/notes/"+noteID, nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Update note
	updateData := map[string]interface{}{
		"title": "Updated Integration Test Note",
	}

	resp = makeAuthenticatedRequest(t, server, token, "PUT", "/api/notes/"+noteID, updateData)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Delete note
	resp = makeAuthenticatedRequest(t, server, token, "DELETE", "/api/notes/"+noteID, nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestPeopleWorkflow(t *testing.T) {
	t.Parallel()
	server, _, token := setupIntegrationTest(t)

	// Create person
	person := map[string]interface{}{
		"name":  "John Doe",
		"email": "john.doe@example.com",
	}

	resp := makeAuthenticatedRequest(t, server, token, "POST", "/api/people", person)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var createdPerson map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdPerson)
	personID := createdPerson["id"].(string)

	// Get person
	resp = makeAuthenticatedRequest(t, server, token, "GET", "/api/people/"+personID, nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Update person
	updateData := map[string]interface{}{
		"title": "Senior Developer",
	}

	resp = makeAuthenticatedRequest(t, server, token, "PUT", "/api/people/"+personID, updateData)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Delete person
	resp = makeAuthenticatedRequest(t, server, token, "DELETE", "/api/people/"+personID, nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

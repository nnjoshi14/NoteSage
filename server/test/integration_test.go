package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/models"
	"notesage-server/internal/router"
)

type IntegrationTestSuite struct {
	suite.Suite
	db     *gorm.DB
	router *gin.Engine
	server *httptest.Server
	token  string
	userID string
}

func (suite *IntegrationTestSuite) SetupSuite() {
	// Setup test database
	cfg := &config.Config{
		Database: config.DatabaseConfig{
			Type: "sqlite",
			Name: ":memory:",
		},
		Auth: config.AuthConfig{
			JWTSecret: "test-secret",
		},
		Features: config.FeaturesConfig{
		AI: config.AIConfig{
			Provider: "disabled",
			APIKey:   "",
		},			AIEnabled: false,
		},
	}

	var err error
	suite.db, err = database.Initialize(cfg.Database)
	suite.Require().NoError(err)

	// Run migrations
	err = database.Migrate(suite.db)
	suite.Require().NoError(err)

	// Setup router
	suite.router = router.Setup(suite.db, cfg)
	suite.server = httptest.NewServer(suite.router)

	// Create test user and get auth token
	suite.createTestUser()
}

func (suite *IntegrationTestSuite) TearDownSuite() {
	suite.server.Close()
}

func (suite *IntegrationTestSuite) createTestUser() {
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	// Create user
	userJSON, _ := json.Marshal(user)
	resp, err := http.Post(suite.server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusCreated, resp.StatusCode)

	// Login to get token
	loginData := map[string]string{
		"username": "testuser",
		"password": "password123",
	}
	loginJSON, _ := json.Marshal(loginData)
	resp, err = http.Post(suite.server.URL+"/api/auth/login", "application/json", bytes.NewBuffer(loginJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusOK, resp.StatusCode)

	var loginResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResp)
	suite.token = loginResp["token"].(string)
	suite.userID = loginResp["user"].(map[string]interface{})["id"].(string)
}

func (suite *IntegrationTestSuite) makeAuthenticatedRequest(method, path string, body interface{}) (*http.Response, error) {
	var reqBody *bytes.Buffer
	if body != nil {
		bodyJSON, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(bodyJSON)
	} else {
		reqBody = bytes.NewBuffer([]byte{})
	}

	req, err := http.NewRequest(method, suite.server.URL+path, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+suite.token)

	client := &http.Client{}
	return client.Do(req)
}

// Test complete note workflow
func (suite *IntegrationTestSuite) TestNoteWorkflow() {
	// Create note
	note := map[string]interface{}{
		"title":   "Integration Test Note",
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": "This is a test note with @john-doe mention"},
					},
				},
			},
		},
		"category": "Note",
		"tags":     []string{"test", "integration"},
	}

	resp, err := suite.makeAuthenticatedRequest("POST", "/api/notes", note)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

	var createdNote map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdNote)
	noteID := createdNote["id"].(string)

	// Get note
	resp, err = suite.makeAuthenticatedRequest("GET", "/api/notes/"+noteID, nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// Update note
	updateData := map[string]interface{}{
		"title": "Updated Integration Test Note",
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": "Updated content with todo: - [ ][t1] Complete integration tests @john-doe 2024-01-15"},
					},
				},
			},
		},
	}

	resp, err = suite.makeAuthenticatedRequest("PUT", "/api/notes/"+noteID, updateData)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// Search notes
	resp, err = suite.makeAuthenticatedRequest("GET", "/api/notes/search?q=integration", nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	var searchResults map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&searchResults)
	suite.Assert().Greater(len(searchResults["notes"].([]interface{})), 0)

	// Delete note
	resp, err = suite.makeAuthenticatedRequest("DELETE", "/api/notes/"+noteID, nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

// Test people management workflow
func (suite *IntegrationTestSuite) TestPeopleWorkflow() {
	// Create person
	person := map[string]interface{}{
		"name":        "John Doe",
		"email":       "john.doe@example.com",
		"company":     "Test Corp",
		"title":       "Developer",
		"linkedin_url": "https://linkedin.com/in/johndoe",
	}

	resp, err := suite.makeAuthenticatedRequest("POST", "/api/people", person)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

	var createdPerson map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdPerson)
	personID := createdPerson["id"].(string)

	// Get person
	resp, err = suite.makeAuthenticatedRequest("GET", "/api/people/"+personID, nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// Update person
	updateData := map[string]interface{}{
		"title": "Senior Developer",
	}

	resp, err = suite.makeAuthenticatedRequest("PUT", "/api/people/"+personID, updateData)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// List people
	resp, err = suite.makeAuthenticatedRequest("GET", "/api/people", nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// Delete person
	resp, err = suite.makeAuthenticatedRequest("DELETE", "/api/people/"+personID, nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

// Test todo workflow
func (suite *IntegrationTestSuite) TestTodoWorkflow() {
	// First create a note with todos
	note := map[string]interface{}{
		"title": "Todo Test Note",
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": "- [ ][t1] First todo item @john-doe 2024-01-15"},
						{"type": "text", "text": "- [ ][t2] Second todo item"},
					},
				},
			},
		},
	}

	resp, err := suite.makeAuthenticatedRequest("POST", "/api/notes", note)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

	var createdNote map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdNote)
	_ = createdNote["id"].(string)

	// Trigger todo sync
	resp, err = suite.makeAuthenticatedRequest("POST", "/api/todos/sync", nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// Get todos
	resp, err = suite.makeAuthenticatedRequest("GET", "/api/todos", nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	var todos map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&todos)
	suite.Assert().Greater(len(todos["todos"].([]interface{})), 0)

	// Update todo status
	todoList := todos["todos"].([]interface{})
	firstTodo := todoList[0].(map[string]interface{})
	todoID := firstTodo["id"].(string)

	updateData := map[string]interface{}{
		"is_completed": true,
	}

	resp, err = suite.makeAuthenticatedRequest("PUT", "/api/todos/"+todoID, updateData)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

// Test knowledge graph workflow
func (suite *IntegrationTestSuite) TestKnowledgeGraphWorkflow() {
	// Create notes with connections
	note1 := map[string]interface{}{
		"title": "Graph Test Note 1",
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": "This note mentions @alice and references #graph-test-note-2"},
					},
				},
			},
		},
	}

	resp, err := suite.makeAuthenticatedRequest("POST", "/api/notes", note1)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

	note2 := map[string]interface{}{
		"title": "Graph Test Note 2",
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": "This note also mentions @alice"},
					},
				},
			},
		},
	}

	resp, err = suite.makeAuthenticatedRequest("POST", "/api/notes", note2)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

	// Get graph data
	resp, err = suite.makeAuthenticatedRequest("GET", "/api/graph", nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	var graphData map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&graphData)
	suite.Assert().Greater(len(graphData["nodes"].([]interface{})), 0)
	suite.Assert().Greater(len(graphData["links"].([]interface{})), 0)
}

// Test AI integration workflow
func (suite *IntegrationTestSuite) TestAIWorkflow() {
	// Test AI configuration
	aiConfig := map[string]interface{}{
		"provider": "openai",
		"api_key":  "test-key",
		"enabled":  true,
	}

	resp, err := suite.makeAuthenticatedRequest("POST", "/api/ai/config", aiConfig)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// Test AI insights (will fail gracefully without real API key)
	resp, err = suite.makeAuthenticatedRequest("GET", "/api/ai/insights", nil)
	suite.Require().NoError(err)
	// Should return 200 even if AI is unavailable (graceful degradation)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

func TestIntegrationSuite(t *testing.T) {
	suite.Run(t, new(IntegrationTestSuite))
}
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"notesage-server/internal/database"
	"notesage-server/internal/models"
	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAIHandlerTest(t *testing.T) (*gorm.DB, *AIHandler, *gin.Engine) {
	db := database.SetupTestDB(t)

	// Create AI service with disabled config for testing
	aiService := services.NewAIService(db, nil)
	handler := NewAIHandler(aiService)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	return db, handler, router
}

func setupAIHandlerTestWithMockAI(t *testing.T) (*gorm.DB, *AIHandler, *gin.Engine, *httptest.Server) {
	db := database.SetupTestDB(t)

	// Create a mock AI server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Default mock response
		mockResponse := map[string]interface{}{
			"choices": []map[string]interface{}{
				{
					"message": map[string]string{
						"content": `{"todos": [{"text": "Test todo", "priority": "high"}]}`,
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))

	// Create AI service with mock server
	config := &services.AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
		BaseURL:  mockServer.URL,
	}
	aiService := services.NewAIService(db, config)
	handler := NewAIHandler(aiService)

	gin.SetMode(gin.TestMode)
	router := gin.New()

	return db, handler, router, mockServer
}

func addAuthMiddleware(router *gin.Engine, userID uuid.UUID) {
	router.Use(func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	})
}

func TestAIHandler_GetAIStatus(t *testing.T) {
	tests := []struct {
		name           string
		setupService   func(*gorm.DB) *services.AIService
		expectedStatus int
		expectedEnabled bool
	}{
		{
			name: "disabled AI service",
			setupService: func(db *gorm.DB) *services.AIService {
				return services.NewAIService(db, nil)
			},
			expectedStatus:  http.StatusOK,
			expectedEnabled: false,
		},
		{
			name: "enabled AI service",
			setupService: func(db *gorm.DB) *services.AIService {
				config := &services.AIConfig{
					Provider: "openai",
					APIKey:   "test-key",
				}
				return services.NewAIService(db, config)
			},
			expectedStatus:  http.StatusOK,
			expectedEnabled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := database.SetupTestDB(t)

			aiService := tt.setupService(db)
			handler := NewAIHandler(aiService)

			gin.SetMode(gin.TestMode)
			router := gin.New()
			router.GET("/ai/status", handler.GetAIStatus)

			req, _ := http.NewRequest("GET", "/ai/status", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response AIStatusResponse
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedEnabled, response.Enabled)
		})
	}
}

func TestAIHandler_ExtractTodos(t *testing.T) {
	_, handler, router, mockServer := setupAIHandlerTestWithMockAI(t)
	defer mockServer.Close()

	router.POST("/ai/extract-todos", handler.ExtractTodos)

	tests := []struct {
		name           string
		requestBody    interface{}
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name: "valid request",
			requestBody: ExtractTodosRequest{
				Content: models.JSONB{
					"type": "doc",
					"content": []interface{}{
						map[string]interface{}{
							"type": "paragraph",
							"content": []interface{}{
								map[string]interface{}{
									"type": "text",
									"text": "Need to complete the project",
								},
							},
						},
					},
				},
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var response services.TodoExtractionResult
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Empty(t, response.Error)
				assert.Len(t, response.Todos, 1)
				assert.Equal(t, "Test todo", response.Todos[0].Text)
			},
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			expectedStatus: http.StatusBadRequest,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]string
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], "Invalid request format")
			},
		},
		{
			name: "missing content",
			requestBody: map[string]interface{}{
				"invalid": "field",
			},
			expectedStatus: http.StatusBadRequest,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]string
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], "Invalid request format")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var reqBody []byte
			var err error

			if str, ok := tt.requestBody.(string); ok {
				reqBody = []byte(str)
			} else {
				reqBody, err = json.Marshal(tt.requestBody)
				require.NoError(t, err)
			}

			req, _ := http.NewRequest("POST", "/ai/extract-todos", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			tt.checkResponse(t, w.Body.Bytes())
		})
	}
}

func TestAIHandler_AnalyzePeople(t *testing.T) {
	db, handler, router, mockServer := setupAIHandlerTestWithMockAI(t)
	defer mockServer.Close()

	userID := uuid.New()
	addAuthMiddleware(router, userID)
	router.POST("/ai/analyze-people", handler.AnalyzePeople)

	// Create test user first
	user := models.User{
		ID:       userID,
		Username: "testuser_handler_" + userID.String()[:8],
		Email:    "test_handler_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)

	// Create test person
	person := models.Person{
		ID:     uuid.New(),
		UserID: userID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)

	tests := []struct {
		name           string
		requestBody    interface{}
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name: "valid request",
			requestBody: AnalyzePeopleRequest{
				Content: models.JSONB{
					"type": "doc",
					"content": []interface{}{
						map[string]interface{}{
							"type": "paragraph",
							"content": []interface{}{
								map[string]interface{}{
									"type": "text",
									"text": "Had a meeting with John Doe about the project",
								},
							},
						},
					},
				},
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var response services.PeopleAnalysisResult
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Empty(t, response.Error)
				// Note: The mock server returns todo extraction format, 
				// but in real usage it would return people analysis format
			},
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			expectedStatus: http.StatusBadRequest,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]string
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], "Invalid request format")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var reqBody []byte
			var err error

			if str, ok := tt.requestBody.(string); ok {
				reqBody = []byte(str)
			} else {
				reqBody, err = json.Marshal(tt.requestBody)
				require.NoError(t, err)
			}

			req, _ := http.NewRequest("POST", "/ai/analyze-people", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			tt.checkResponse(t, w.Body.Bytes())
		})
	}
}

func TestAIHandler_AnalyzePeople_NoAuth(t *testing.T) {
	_, handler, router, mockServer := setupAIHandlerTestWithMockAI(t)
	defer mockServer.Close()

	router.POST("/ai/analyze-people", handler.AnalyzePeople)

	requestBody := AnalyzePeopleRequest{
		Content: models.JSONB{
			"type": "doc",
			"content": []interface{}{},
		},
	}

	reqBody, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req, _ := http.NewRequest("POST", "/ai/analyze-people", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var response map[string]string
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "User not authenticated")
}

func TestAIHandler_GenerateInsights(t *testing.T) {
	db, handler, router, mockServer := setupAIHandlerTestWithMockAI(t)
	defer mockServer.Close()

	userID := uuid.New()
	addAuthMiddleware(router, userID)
	router.GET("/ai/insights", handler.GenerateInsights)

	// Create test user first
	user := models.User{
		ID:       userID,
		Username: "testuser_insights_" + userID.String()[:8],
		Email:    "test_insights_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)

	// Create test data
	note := models.Note{
		ID:      uuid.New(),
		UserID:  userID,
		Title:   "Test Note",
		Content: models.JSONB{"type": "doc", "content": []interface{}{}},
	}
	require.NoError(t, db.Create(&note).Error)

	tests := []struct {
		name           string
		queryParams    string
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:           "default limit",
			queryParams:    "",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var response services.InsightResult
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Empty(t, response.Error)
				// Note: Mock server returns todo format, but structure is similar
			},
		},
		{
			name:           "custom limit",
			queryParams:    "?limit=10",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var response services.InsightResult
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Empty(t, response.Error)
			},
		},
		{
			name:           "invalid limit ignored",
			queryParams:    "?limit=invalid",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var response services.InsightResult
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Empty(t, response.Error)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/ai/insights"+tt.queryParams, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			tt.checkResponse(t, w.Body.Bytes())
		})
	}
}

func TestAIHandler_GenerateInsights_NoAuth(t *testing.T) {
	_, handler, router, mockServer := setupAIHandlerTestWithMockAI(t)
	defer mockServer.Close()

	router.GET("/ai/insights", handler.GenerateInsights)

	req, _ := http.NewRequest("GET", "/ai/insights", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "User not authenticated")
}

func TestAIHandler_ExtractTodosFromNote(t *testing.T) {
	_, handler, router, mockServer := setupAIHandlerTestWithMockAI(t)
	defer mockServer.Close()

	userID := uuid.New()
	noteID := uuid.New()
	addAuthMiddleware(router, userID)
	router.POST("/ai/notes/:noteId/extract-todos", handler.ExtractTodosFromNote)

	tests := []struct {
		name           string
		noteID         string
		requestBody    interface{}
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:   "valid request",
			noteID: noteID.String(),
			requestBody: ExtractTodosRequest{
				Content: models.JSONB{
					"type": "doc",
					"content": []interface{}{
						map[string]interface{}{
							"type": "paragraph",
							"content": []interface{}{
								map[string]interface{}{
									"type": "text",
									"text": "Need to complete the project",
								},
							},
						},
					},
				},
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]interface{}
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Equal(t, noteID.String(), response["note_id"])
				assert.Equal(t, userID.String(), response["user_id"])
				assert.Contains(t, response, "result")
			},
		},
		{
			name:           "invalid note ID",
			noteID:         "invalid-uuid",
			requestBody:    ExtractTodosRequest{Content: models.JSONB{}},
			expectedStatus: http.StatusBadRequest,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]string
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], "Invalid note ID")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reqBody, err := json.Marshal(tt.requestBody)
			require.NoError(t, err)

			req, _ := http.NewRequest("POST", "/ai/notes/"+tt.noteID+"/extract-todos", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			tt.checkResponse(t, w.Body.Bytes())
		})
	}
}

func TestAIHandler_AnalyzePeopleInNote(t *testing.T) {
	db, handler, router, mockServer := setupAIHandlerTestWithMockAI(t)
	defer mockServer.Close()

	userID := uuid.New()
	noteID := uuid.New()
	addAuthMiddleware(router, userID)
	router.POST("/ai/notes/:noteId/analyze-people", handler.AnalyzePeopleInNote)

	// Create test user first
	user := models.User{
		ID:       userID,
		Username: "testuser_note_" + userID.String()[:8],
		Email:    "test_note_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)

	// Create test person
	person := models.Person{
		ID:     uuid.New(),
		UserID: userID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)

	tests := []struct {
		name           string
		noteID         string
		requestBody    interface{}
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:   "valid request",
			noteID: noteID.String(),
			requestBody: AnalyzePeopleRequest{
				Content: models.JSONB{
					"type": "doc",
					"content": []interface{}{
						map[string]interface{}{
							"type": "paragraph",
							"content": []interface{}{
								map[string]interface{}{
									"type": "text",
									"text": "Had a meeting with John Doe",
								},
							},
						},
					},
				},
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]interface{}
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Equal(t, noteID.String(), response["note_id"])
				assert.Equal(t, userID.String(), response["user_id"])
				assert.Contains(t, response, "result")
			},
		},
		{
			name:           "invalid note ID",
			noteID:         "invalid-uuid",
			requestBody:    AnalyzePeopleRequest{Content: models.JSONB{}},
			expectedStatus: http.StatusBadRequest,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]string
				err := json.Unmarshal(body, &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], "Invalid note ID")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reqBody, err := json.Marshal(tt.requestBody)
			require.NoError(t, err)

			req, _ := http.NewRequest("POST", "/ai/notes/"+tt.noteID+"/analyze-people", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			tt.checkResponse(t, w.Body.Bytes())
		})
	}
}

func TestAIHandler_DisabledService(t *testing.T) {
	_, handler, router := setupAIHandlerTest(t)

	router.POST("/ai/extract-todos", handler.ExtractTodos)

	requestBody := ExtractTodosRequest{
		Content: models.JSONB{
			"type": "doc",
			"content": []interface{}{},
		},
	}

	reqBody, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req, _ := http.NewRequest("POST", "/ai/extract-todos", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response services.TodoExtractionResult
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "AI service not available", response.Error)
	assert.Empty(t, response.Todos)
}
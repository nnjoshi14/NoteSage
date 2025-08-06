package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notesage-server/internal/database"
	"notesage-server/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAITestDB(t *testing.T) *gorm.DB {
	return database.SetupTestDB(t)
}

func TestNewAIService(t *testing.T) {
	db := setupAITestDB(t)
	
	tests := []struct {
		name     string
		config   *AIConfig
		expected bool
	}{
		{
			name:     "nil config should disable service",
			config:   nil,
			expected: false,
		},
		{
			name: "empty API key should disable service",
			config: &AIConfig{
				Provider: "openai",
				APIKey:   "",
			},
			expected: false,
		},
		{
			name: "valid config should enable service",
			config: &AIConfig{
				Provider: "openai",
				APIKey:   "test-key",
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := NewAIService(db, tt.config)
			assert.Equal(t, tt.expected, service.IsEnabled())
		})
	}
}

func TestAIService_ExtractTextFromContent(t *testing.T) {
	db := setupAITestDB(t)
	config := &AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}
	service := NewAIService(db, config)

	tests := []struct {
		name     string
		content  models.JSONB
		expected string
	}{
		{
			name: "simple text content",
			content: models.JSONB{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{
								"type": "text",
								"text": "Hello world",
							},
						},
					},
				},
			},
			expected: "Hello world",
		},
		{
			name: "multiple paragraphs",
			content: models.JSONB{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{
								"type": "text",
								"text": "First paragraph",
							},
						},
					},
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{
								"type": "text",
								"text": "Second paragraph",
							},
						},
					},
				},
			},
			expected: "First paragraph\nSecond paragraph",
		},
		{
			name:     "empty content",
			content:  models.JSONB{},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.extractTextFromContent(tt.content)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestAIService_ExtractTodosFromNote_Disabled(t *testing.T) {
	db := setupAITestDB(t)
	service := NewAIService(db, nil) // disabled service

	content := models.JSONB{
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
	}

	result, err := service.ExtractTodosFromNote(context.Background(), content)
	require.NoError(t, err)
	assert.Equal(t, "AI service not available", result.Error)
	assert.Empty(t, result.Todos)
}

func TestAIService_CallOpenAI_MockServer(t *testing.T) {
	// Create a mock OpenAI server
	mockResponse := map[string]interface{}{
		"choices": []map[string]interface{}{
			{
				"message": map[string]string{
					"content": `{"todos": [{"text": "Complete the project", "priority": "high"}]}`,
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/chat/completions", r.URL.Path)
		assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	db := setupAITestDB(t)
	config := &AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
		BaseURL:  server.URL,
		Model:    "gpt-3.5-turbo",
		Timeout:  5,
	}
	service := NewAIService(db, config)

	result, err := service.callOpenAI(context.Background(), "test prompt")
	require.NoError(t, err)
	assert.Contains(t, result, "Complete the project")
}

func TestAIService_CallGemini_MockServer(t *testing.T) {
	// Create a mock Gemini server
	mockResponse := map[string]interface{}{
		"candidates": []map[string]interface{}{
			{
				"content": map[string]interface{}{
					"parts": []map[string]string{
						{
							"text": `{"mentions": [{"name": "John Doe", "context": "meeting", "strength": 8}]}`,
						},
					},
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Contains(t, r.URL.Path, "/models/gemini-pro:generateContent")
		assert.Contains(t, r.URL.RawQuery, "key=test-key")
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	db := setupAITestDB(t)
	config := &AIConfig{
		Provider: "gemini",
		APIKey:   "test-key",
		BaseURL:  server.URL,
		Model:    "gemini-pro",
		Timeout:  5,
	}
	service := NewAIService(db, config)

	result, err := service.callGemini(context.Background(), "test prompt")
	require.NoError(t, err)
	assert.Contains(t, result, "John Doe")
}

func TestAIService_CallGrok_MockServer(t *testing.T) {
	// Create a mock Grok server
	mockResponse := map[string]interface{}{
		"choices": []map[string]interface{}{
			{
				"message": map[string]string{
					"content": `{"insights": [{"type": "pattern", "title": "Meeting Pattern", "description": "You have many meetings on Mondays", "confidence": 0.9}]}`,
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/chat/completions", r.URL.Path)
		assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	db := setupAITestDB(t)
	config := &AIConfig{
		Provider: "grok",
		APIKey:   "test-key",
		BaseURL:  server.URL,
		Model:    "grok-beta",
		Timeout:  5,
	}
	service := NewAIService(db, config)

	result, err := service.callGrok(context.Background(), "test prompt")
	require.NoError(t, err)
	assert.Contains(t, result, "Meeting Pattern")
}

func TestAIService_ExtractTodosFromNote_WithMockAI(t *testing.T) {
	// Create a mock AI server that returns todo extraction results
	mockResponse := map[string]interface{}{
		"choices": []map[string]interface{}{
			{
				"message": map[string]string{
					"content": `{
						"todos": [
							{
								"text": "Complete the project documentation",
								"assigned_person_id": "john_doe",
								"due_date": "2024-01-15",
								"priority": "high",
								"context": "project meeting notes"
							},
							{
								"text": "Review code changes",
								"priority": "medium",
								"context": "development tasks"
							}
						]
					}`,
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	db := setupAITestDB(t)
	config := &AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
		BaseURL:  server.URL,
	}
	service := NewAIService(db, config)

	content := models.JSONB{
		"type": "doc",
		"content": []interface{}{
			map[string]interface{}{
				"type": "paragraph",
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "Meeting notes: Need to complete the project documentation by January 15th. John should handle this. Also need to review code changes.",
					},
				},
			},
		},
	}

	result, err := service.ExtractTodosFromNote(context.Background(), content)
	require.NoError(t, err)
	assert.Empty(t, result.Error)
	assert.Len(t, result.Todos, 2)
	
	assert.Equal(t, "Complete the project documentation", result.Todos[0].Text)
	assert.Equal(t, "john_doe", result.Todos[0].AssignedPersonID)
	assert.Equal(t, "2024-01-15", result.Todos[0].DueDate)
	assert.Equal(t, "high", result.Todos[0].Priority)
	
	assert.Equal(t, "Review code changes", result.Todos[1].Text)
	assert.Equal(t, "medium", result.Todos[1].Priority)
}

func TestAIService_AnalyzePeopleMentions_WithMockAI(t *testing.T) {
	// Create test user and people
	db := setupAITestDB(t)
	userID := uuid.New()
	
	// Create test user first
	user := models.User{
		ID:       userID,
		Username: "testuser_people_" + userID.String()[:8],
		Email:    "test_people_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test people
	person1 := models.Person{
		ID:     uuid.New(),
		UserID: userID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	person2 := models.Person{
		ID:     uuid.New(),
		UserID: userID,
		Name:   "Jane Smith",
		Email:  "jane@example.com",
	}
	
	require.NoError(t, db.Create(&person1).Error)
	require.NoError(t, db.Create(&person2).Error)

	// Create a mock AI server
	mockResponse := map[string]interface{}{
		"choices": []map[string]interface{}{
			{
				"message": map[string]string{
					"content": `{
						"mentions": [
							{
								"name": "John Doe",
								"context": "discussed project timeline",
								"strength": 8
							},
							{
								"name": "Jane Smith", 
								"context": "assigned to review task",
								"strength": 6
							}
						],
						"relationships": [
							{
								"person1": "John Doe",
								"person2": "Jane Smith",
								"relationship": "colleague",
								"confidence": 0.9
							}
						]
					}`,
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	config := &AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
		BaseURL:  server.URL,
	}
	service := NewAIService(db, config)

	content := models.JSONB{
		"type": "doc",
		"content": []interface{}{
			map[string]interface{}{
				"type": "paragraph",
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "Had a meeting with John Doe about the project timeline. Jane Smith will review the implementation.",
					},
				},
			},
		},
	}

	result, err := service.AnalyzePeopleMentions(context.Background(), content, userID)
	require.NoError(t, err)
	assert.Empty(t, result.Error)
	assert.Len(t, result.Mentions, 2)
	assert.Len(t, result.Relationships, 1)
	
	assert.Equal(t, "John Doe", result.Mentions[0].Name)
	assert.Equal(t, 8, result.Mentions[0].Strength)
	
	assert.Equal(t, "Jane Smith", result.Mentions[1].Name)
	assert.Equal(t, 6, result.Mentions[1].Strength)
	
	assert.Equal(t, "John Doe", result.Relationships[0].Person1)
	assert.Equal(t, "Jane Smith", result.Relationships[0].Person2)
	assert.Equal(t, "colleague", result.Relationships[0].Relationship)
	assert.Equal(t, 0.9, result.Relationships[0].Confidence)
}

func TestAIService_GenerateInsights_WithMockAI(t *testing.T) {
	// Create test data
	db := setupAITestDB(t)
	userID := uuid.New()
	
	// Create test user first
	user := models.User{
		ID:       userID,
		Username: "testuser_insights_" + userID.String()[:8],
		Email:    "test_insights_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test note
	note := models.Note{
		ID:      uuid.New(),
		UserID:  userID,
		Title:   "Test Note",
		Content: models.JSONB{"type": "doc", "content": []interface{}{}},
	}
	require.NoError(t, db.Create(&note).Error)

	// Create a mock AI server
	mockResponse := map[string]interface{}{
		"choices": []map[string]interface{}{
			{
				"message": map[string]string{
					"content": `{
						"insights": [
							{
								"type": "pattern",
								"title": "High Meeting Frequency",
								"description": "You have 3x more meetings on Mondays than other days",
								"confidence": 0.85,
								"data": {
									"monday_meetings": 12,
									"average_other_days": 4
								}
							},
							{
								"type": "suggestion",
								"title": "Incomplete Tasks",
								"description": "You have 5 overdue tasks that might need attention",
								"confidence": 0.92,
								"data": {
									"overdue_count": 5
								}
							}
						]
					}`,
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	config := &AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
		BaseURL:  server.URL,
	}
	service := NewAIService(db, config)

	result, err := service.GenerateInsights(context.Background(), userID, 10)
	require.NoError(t, err)
	assert.Empty(t, result.Error)
	assert.Len(t, result.Insights, 2)
	
	assert.Equal(t, "pattern", result.Insights[0].Type)
	assert.Equal(t, "High Meeting Frequency", result.Insights[0].Title)
	assert.Equal(t, 0.85, result.Insights[0].Confidence)
	
	assert.Equal(t, "suggestion", result.Insights[1].Type)
	assert.Equal(t, "Incomplete Tasks", result.Insights[1].Title)
	assert.Equal(t, 0.92, result.Insights[1].Confidence)
}

func TestAIService_GatherUserData(t *testing.T) {
	db := setupAITestDB(t)
	userID := uuid.New()
	
	config := &AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
	}
	service := NewAIService(db, config)

	// Create test user first
	user := models.User{
		ID:       userID,
		Username: "testuser_gather_" + userID.String()[:8],
		Email:    "test_gather_" + userID.String()[:8] + "@example.com",
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

	person := models.Person{
		ID:     uuid.New(),
		UserID: userID,
		Name:   "Test Person",
	}
	require.NoError(t, db.Create(&person).Error)

	todo := models.Todo{
		ID:     uuid.New(),
		NoteID: note.ID,
		TodoID: "t1",
		Text:   "Test todo",
	}
	require.NoError(t, db.Create(&todo).Error)

	connection := models.Connection{
		ID:         uuid.New(),
		UserID:     userID,
		SourceID:   note.ID,
		SourceType: "note",
		TargetID:   person.ID,
		TargetType: "person",
	}
	require.NoError(t, db.Create(&connection).Error)

	// Test gathering user data
	data, err := service.gatherUserData(userID, 10)
	require.NoError(t, err)
	
	assert.Contains(t, data, "notes")
	assert.Contains(t, data, "people")
	assert.Contains(t, data, "todos")
	assert.Contains(t, data, "connections")
	assert.Contains(t, data, "summary")
	
	summary := data["summary"].(map[string]int)
	assert.Equal(t, 1, summary["total_notes"])
	assert.Equal(t, 1, summary["total_people"])
	assert.Equal(t, 1, summary["total_todos"])
	assert.Equal(t, 1, summary["total_connections"])
}

func TestAIService_ErrorHandling(t *testing.T) {
	db := setupAITestDB(t)
	
	tests := []struct {
		name           string
		serverResponse func(w http.ResponseWriter, r *http.Request)
		expectError    bool
	}{
		{
			name: "server returns 500 error",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte("Internal server error"))
			},
			expectError: true,
		},
		{
			name: "server returns invalid JSON",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte("invalid json"))
			},
			expectError: true,
		},
		{
			name: "server returns empty choices",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"choices": []interface{}{},
				})
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
			defer server.Close()

			config := &AIConfig{
				Provider: "openai",
				APIKey:   "test-key",
				BaseURL:  server.URL,
				Timeout:  1, // short timeout for faster tests
			}
			service := NewAIService(db, config)

			_, err := service.callOpenAI(context.Background(), "test prompt")
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAIService_ContextTimeout(t *testing.T) {
	db := setupAITestDB(t)
	
	// Create a server that delays response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond) // delay longer than context timeout
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"choices": []map[string]interface{}{
				{"message": map[string]string{"content": "response"}},
			},
		})
	}))
	defer server.Close()

	config := &AIConfig{
		Provider: "openai",
		APIKey:   "test-key",
		BaseURL:  server.URL,
		Timeout:  1, // 1 second timeout
	}
	service := NewAIService(db, config)

	// Create a context with very short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := service.callOpenAI(ctx, "test prompt")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "context deadline exceeded")
}

func TestAIService_UnsupportedProvider(t *testing.T) {
	db := setupAITestDB(t)
	config := &AIConfig{
		Provider: "unsupported",
		APIKey:   "test-key",
	}
	service := NewAIService(db, config)

	_, err := service.callAI(context.Background(), "test prompt")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported AI provider")
}
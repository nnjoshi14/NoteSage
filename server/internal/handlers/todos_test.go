package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notesage-server/internal/database"
	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTodoHandler_CreateTodo(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	// Clean up any existing data
	db.Exec("DELETE FROM todos")
	db.Exec("DELETE FROM people")
	db.Exec("DELETE FROM notes")
	db.Exec("DELETE FROM users")
	
	handler := NewTodoHandler(db)
	
	// Create test user
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test note
	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
	}
	require.NoError(t, db.Create(&note).Error)
	
	// Create test person
	person := models.Person{
		UserID: user.ID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)
	
	tests := []struct {
		name           string
		request        CreateTodoRequest
		expectedStatus int
		expectedTodoID string
	}{
		{
			name: "Create simple todo",
			request: CreateTodoRequest{
				NoteID: note.ID.String(),
				Text:   "Test todo",
			},
			expectedStatus: http.StatusCreated,
			expectedTodoID: "t1",
		},
		{
			name: "Create todo with specific ID",
			request: CreateTodoRequest{
				NoteID: note.ID.String(),
				TodoID: "t5",
				Text:   "Test todo with ID",
			},
			expectedStatus: http.StatusCreated,
			expectedTodoID: "t5",
		},
		{
			name: "Create todo with assignment and due date",
			request: CreateTodoRequest{
				NoteID:           note.ID.String(),
				Text:             "Assigned todo",
				AssignedPersonID: person.ID.String(),
				DueDate:          "2024-01-15",
			},
			expectedStatus: http.StatusCreated,
			expectedTodoID: "t6", // Auto-generated (after t1 and t5 from previous tests)
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup request
			reqBody, _ := json.Marshal(tt.request)
			req := httptest.NewRequest(http.MethodPost, "/api/todos", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")
			
			// Setup response recorder
			w := httptest.NewRecorder()
			
			// Setup Gin context
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Set("userID", user.ID)
			
			// Call handler
			handler.CreateTodo(c)
			
			// Assert response
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusCreated {
				var response models.Todo
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				
				assert.Equal(t, tt.expectedTodoID, response.TodoID)
				assert.Equal(t, tt.request.Text, response.Text)
				assert.Equal(t, note.ID, response.NoteID)
				assert.False(t, response.IsCompleted)
				
				if tt.request.AssignedPersonID != "" {
					assert.NotNil(t, response.AssignedPersonID)
					assert.Equal(t, person.ID, *response.AssignedPersonID)
				}
				
				if tt.request.DueDate != "" {
					assert.NotNil(t, response.DueDate)
					expectedDate, _ := time.Parse("2006-01-02", tt.request.DueDate)
					assert.Equal(t, expectedDate.Format("2006-01-02"), response.DueDate.Format("2006-01-02"))
				}
			}
		})
	}
}

func TestTodoHandler_GetTodos(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	// Clean up any existing data
	db.Exec("DELETE FROM todos")
	db.Exec("DELETE FROM people")
	db.Exec("DELETE FROM notes")
	db.Exec("DELETE FROM users")
	
	handler := NewTodoHandler(db)
	
	// Create test user
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test notes
	note1 := models.Note{UserID: user.ID, Title: "Note 1"}
	note2 := models.Note{UserID: user.ID, Title: "Note 2"}
	require.NoError(t, db.Create(&note1).Error)
	require.NoError(t, db.Create(&note2).Error)
	
	// Create test person
	person := models.Person{
		UserID: user.ID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)
	
	// Create test todos
	dueDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	todos := []models.Todo{
		{NoteID: note1.ID, TodoID: "t1", Text: "Incomplete todo", IsCompleted: false},
		{NoteID: note1.ID, TodoID: "t2", Text: "Complete todo", IsCompleted: true},
		{NoteID: note2.ID, TodoID: "t1", Text: "Assigned todo", IsCompleted: false, AssignedPersonID: &person.ID},
		{NoteID: note2.ID, TodoID: "t2", Text: "Todo with due date", IsCompleted: false, DueDate: &dueDate},
	}
	
	for _, todo := range todos {
		require.NoError(t, db.Create(&todo).Error)
	}
	
	tests := []struct {
		name           string
		queryParams    string
		expectedCount  int
		expectedStatus int
	}{
		{
			name:           "Get all todos",
			queryParams:    "",
			expectedCount:  4,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by note ID",
			queryParams:    fmt.Sprintf("note_id=%s", note1.ID.String()),
			expectedCount:  2,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by completed status",
			queryParams:    "completed=true",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by incomplete status",
			queryParams:    "completed=false",
			expectedCount:  3,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by assigned person",
			queryParams:    fmt.Sprintf("assigned_person_id=%s", person.ID.String()),
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by has due date",
			queryParams:    "has_due_date=true",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Search filter",
			queryParams:    "search=Assigned",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup request
			url := "/api/todos"
			if tt.queryParams != "" {
				url += "?" + tt.queryParams
			}
			req := httptest.NewRequest(http.MethodGet, url, nil)
			
			// Setup response recorder
			w := httptest.NewRecorder()
			
			// Setup Gin context
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Set("userID", user.ID)
			
			// Call handler
			handler.GetTodos(c)
			
			// Assert response
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response []models.Todo
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				assert.Len(t, response, tt.expectedCount)
			}
		})
	}
}

func TestTodoHandler_UpdateTodo(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	// Clean up any existing data
	db.Exec("DELETE FROM todos")
	db.Exec("DELETE FROM people")
	db.Exec("DELETE FROM notes")
	db.Exec("DELETE FROM users")
	
	handler := NewTodoHandler(db)
	
	// Create test user
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test note
	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
	}
	require.NoError(t, db.Create(&note).Error)
	
	// Create test person
	person := models.Person{
		UserID: user.ID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)
	
	// Create test todo
	todo := models.Todo{
		NoteID:      note.ID,
		TodoID:      "t1",
		Text:        "Original text",
		IsCompleted: false,
	}
	require.NoError(t, db.Create(&todo).Error)
	
	// Test update
	updateReq := UpdateTodoRequest{
		Text:             todoStringPtr("Updated text"),
		IsCompleted:      todoBoolPtr(true),
		AssignedPersonID: todoStringPtr(person.ID.String()),
		DueDate:          todoStringPtr("2024-01-15"),
	}
	
	// Setup request
	reqBody, _ := json.Marshal(updateReq)
	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/todos/%s", todo.ID.String()), bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	
	// Setup response recorder
	w := httptest.NewRecorder()
	
	// Setup Gin context
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)
	c.Params = gin.Params{{Key: "id", Value: todo.ID.String()}}
	
	// Call handler
	handler.UpdateTodo(c)
	
	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response models.Todo
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Equal(t, "Updated text", response.Text)
	assert.True(t, response.IsCompleted)
	assert.NotNil(t, response.AssignedPersonID)
	assert.Equal(t, person.ID, *response.AssignedPersonID)
	assert.NotNil(t, response.DueDate)
	assert.Equal(t, "2024-01-15", response.DueDate.Format("2006-01-02"))
}

func TestTodoHandler_SyncNoteTodos(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	// Clean up any existing data
	db.Exec("DELETE FROM todos")
	db.Exec("DELETE FROM people")
	db.Exec("DELETE FROM notes")
	db.Exec("DELETE FROM users")
	
	handler := NewTodoHandler(db)
	
	// Create test user
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test note with todo content
	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
		Content: models.JSONB{
			"type": "doc",
			"content": []interface{}{
				map[string]interface{}{
					"type": "paragraph",
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": "- [ ][t1] New todo item",
						},
					},
				},
				map[string]interface{}{
					"type": "paragraph",
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": "- [x][t2] Completed todo",
						},
					},
				},
			},
		},
	}
	require.NoError(t, db.Create(&note).Error)
	
	// Test sync request
	syncReq := SyncNoteTodosRequest{
		NoteID: note.ID.String(),
	}
	
	// Setup request
	reqBody, _ := json.Marshal(syncReq)
	req := httptest.NewRequest(http.MethodPost, "/api/todos/sync", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	
	// Setup response recorder
	w := httptest.NewRecorder()
	
	// Setup Gin context
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)
	
	// Call handler
	handler.SyncNoteTodos(c)
	
	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "Todos synchronized successfully", response["message"])
	
	// Verify todos were created
	var todos []models.Todo
	require.NoError(t, db.Where("note_id = ?", note.ID).Find(&todos).Error)
	assert.Len(t, todos, 2)
	
	// Find todos by ID
	var t1Todo, t2Todo models.Todo
	for _, todo := range todos {
		if todo.TodoID == "t1" {
			t1Todo = todo
		} else if todo.TodoID == "t2" {
			t2Todo = todo
		}
	}
	
	assert.Equal(t, "New todo item", t1Todo.Text)
	assert.False(t, t1Todo.IsCompleted)
	
	assert.Equal(t, "Completed todo", t2Todo.Text)
	assert.True(t, t2Todo.IsCompleted)
}

func TestTodoHandler_GetCalendarTodos(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	// Clean up any existing data
	db.Exec("DELETE FROM todos")
	db.Exec("DELETE FROM people")
	db.Exec("DELETE FROM notes")
	db.Exec("DELETE FROM users")
	
	handler := NewTodoHandler(db)
	
	// Create test user
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test note
	note := models.Note{UserID: user.ID, Title: "Test Note"}
	require.NoError(t, db.Create(&note).Error)
	
	// Create todos with different due dates
	date1 := time.Date(2024, 1, 10, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	date3 := time.Date(2024, 1, 20, 0, 0, 0, 0, time.UTC)
	date4 := time.Date(2024, 1, 25, 0, 0, 0, 0, time.UTC)
	
	todos := []models.Todo{
		{NoteID: note.ID, TodoID: "t1", Text: "Before range", DueDate: &date1},
		{NoteID: note.ID, TodoID: "t2", Text: "In range 1", DueDate: &date2},
		{NoteID: note.ID, TodoID: "t3", Text: "In range 2", DueDate: &date3},
		{NoteID: note.ID, TodoID: "t4", Text: "After range", DueDate: &date4},
		{NoteID: note.ID, TodoID: "t5", Text: "No due date"},
	}
	
	for _, todo := range todos {
		require.NoError(t, db.Create(&todo).Error)
	}
	
	// Setup request for calendar todos
	req := httptest.NewRequest(http.MethodGet, "/api/todos/calendar?start_date=2024-01-12&end_date=2024-01-22", nil)
	
	// Setup response recorder
	w := httptest.NewRecorder()
	
	// Setup Gin context
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)
	
	// Call handler
	handler.GetCalendarTodos(c)
	
	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response []models.Todo
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 2) // Should only include t2 and t3
	
	// Verify the todos are in the correct order (by due date)
	assert.Equal(t, "t2", response[0].TodoID)
	assert.Equal(t, "t3", response[1].TodoID)
}

func TestTodoHandler_UpdateTodoByCompositeKey(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	// Clean up any existing data
	db.Exec("DELETE FROM todos")
	db.Exec("DELETE FROM people")
	db.Exec("DELETE FROM notes")
	db.Exec("DELETE FROM users")
	
	handler := NewTodoHandler(db)
	
	// Create test user
	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test note
	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
	}
	require.NoError(t, db.Create(&note).Error)
	
	// Create test todo
	todo := models.Todo{
		NoteID:      note.ID,
		TodoID:      "t1",
		Text:        "Original text",
		IsCompleted: false,
	}
	require.NoError(t, db.Create(&todo).Error)
	
	// Test update using composite key
	updateReq := UpdateTodoRequest{
		Text:        todoStringPtr("Updated via composite key"),
		IsCompleted: todoBoolPtr(true),
	}
	
	// Setup request
	reqBody, _ := json.Marshal(updateReq)
	url := fmt.Sprintf("/api/todos/note/%s/todo/%s", note.ID.String(), "t1")
	req := httptest.NewRequest(http.MethodPut, url, bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	
	// Setup response recorder
	w := httptest.NewRecorder()
	
	// Setup Gin context
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)
	c.Params = gin.Params{
		{Key: "note_id", Value: note.ID.String()},
		{Key: "todo_id", Value: "t1"},
	}
	
	// Call handler
	handler.UpdateTodoByCompositeKey(c)
	
	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response models.Todo
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Equal(t, "Updated via composite key", response.Text)
	assert.True(t, response.IsCompleted)
	assert.Equal(t, "t1", response.TodoID)
	assert.Equal(t, note.ID, response.NoteID)
}

// Helper functions for todos_test.go
func todoStringPtr(s string) *string {
	return &s
}

func todoBoolPtr(b bool) *bool {
	return &b
}
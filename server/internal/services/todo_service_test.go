package services

import (
	"testing"
	"time"

	"notesage-server/internal/database"
	"notesage-server/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTodoService_ParseTodoLine(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	// Clean up any existing data
	db.Exec("DELETE FROM todos")
	db.Exec("DELETE FROM people")
	db.Exec("DELETE FROM notes")
	db.Exec("DELETE FROM users")
	
	service := NewTodoService(db)
	
	// Create test user and person for assignment tests
	user := models.User{
		Username: "testuser_parse",
		Email:    "test_parse@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	person := models.Person{
		UserID: user.ID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)
	
	tests := []struct {
		name        string
		line        string
		lineNumber  int
		expected    *TodoParseResult
		expectError bool
	}{
		{
			name:       "Simple incomplete todo",
			line:       "- [ ][t1] Complete the project",
			lineNumber: 1,
			expected: &TodoParseResult{
				TodoID:      "t1",
				Text:        "Complete the project",
				IsCompleted: false,
				LineNumber:  1,
			},
		},
		{
			name:       "Simple completed todo",
			line:       "- [x][t2] Review the code",
			lineNumber: 2,
			expected: &TodoParseResult{
				TodoID:      "t2",
				Text:        "Review the code",
				IsCompleted: true,
				LineNumber:  2,
			},
		},
		{
			name:       "Todo with person assignment",
			line:       "- [ ][t3] Meet with client @john",
			lineNumber: 3,
			expected: &TodoParseResult{
				TodoID:           "t3",
				Text:             "Meet with client",
				IsCompleted:      false,
				AssignedPersonID: &person.ID,
				LineNumber:       3,
			},
		},
		{
			name:       "Todo with due date",
			line:       "- [ ][t4] Submit report 2024-01-15",
			lineNumber: 4,
			expected: &TodoParseResult{
				TodoID:      "t4",
				Text:        "Submit report",
				IsCompleted: false,
				DueDate:     parseDate("2024-01-15"),
				LineNumber:  4,
			},
		},
		{
			name:       "Todo with person and due date",
			line:       "- [x][t5] Call customer @john 2024-01-20",
			lineNumber: 5,
			expected: &TodoParseResult{
				TodoID:           "t5",
				Text:             "Call customer",
				IsCompleted:      true,
				AssignedPersonID: &person.ID,
				DueDate:          parseDate("2024-01-20"),
				LineNumber:       5,
			},
		},
		{
			name:        "Invalid format - no todo ID",
			line:        "- [ ] Complete the project",
			lineNumber:  6,
			expectError: true,
		},
		{
			name:        "Invalid format - wrong checkbox format",
			line:        "- [t1] Complete the project",
			lineNumber:  7,
			expectError: true,
		},
		{
			name:        "Not a todo line",
			line:        "This is just regular text",
			lineNumber:  8,
			expectError: true,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.ParseTodoLine(tt.line, tt.lineNumber)
			
			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.expected.TodoID, result.TodoID)
				assert.Equal(t, tt.expected.Text, result.Text)
				assert.Equal(t, tt.expected.IsCompleted, result.IsCompleted)
				assert.Equal(t, tt.expected.LineNumber, result.LineNumber)
				
				if tt.expected.AssignedPersonID != nil {
					assert.NotNil(t, result.AssignedPersonID)
					assert.Equal(t, *tt.expected.AssignedPersonID, *result.AssignedPersonID)
				} else {
					assert.Nil(t, result.AssignedPersonID)
				}
				
				if tt.expected.DueDate != nil {
					assert.NotNil(t, result.DueDate)
					assert.Equal(t, *tt.expected.DueDate, *result.DueDate)
				} else {
					assert.Nil(t, result.DueDate)
				}
			}
		})
	}
}

func TestTodoService_ScanNoteForTodos(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewTodoService(db)
	
	// Create test content with mixed todo and non-todo lines
	content := models.JSONB{
		"type": "doc",
		"content": []interface{}{
			map[string]interface{}{
				"type": "paragraph",
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "- [ ][t1] First todo item",
					},
				},
			},
			map[string]interface{}{
				"type": "paragraph",
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "Regular paragraph text",
					},
				},
			},
			map[string]interface{}{
				"type": "paragraph",
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "- [x][t2] Completed todo item",
					},
				},
			},
		},
	}
	
	result := service.ScanNoteForTodos(content)
	
	assert.Len(t, result.ParsedTodos, 2)
	assert.Empty(t, result.Errors)
	
	// Check first todo
	assert.Equal(t, "t1", result.ParsedTodos[0].TodoID)
	assert.Equal(t, "First todo item", result.ParsedTodos[0].Text)
	assert.False(t, result.ParsedTodos[0].IsCompleted)
	
	// Check second todo
	assert.Equal(t, "t2", result.ParsedTodos[1].TodoID)
	assert.Equal(t, "Completed todo item", result.ParsedTodos[1].Text)
	assert.True(t, result.ParsedTodos[1].IsCompleted)
}

func TestTodoService_SyncNoteTodos(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewTodoService(db)
	
	// Create test user
	user := models.User{
		Username: "testuser_sync",
		Email:    "test_sync@example.com",
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
	
	// Create an existing todo that should be updated
	existingTodo := models.Todo{
		NoteID:      note.ID,
		TodoID:      "t1",
		Text:        "Old text",
		IsCompleted: true, // This should be updated to false
	}
	require.NoError(t, db.Create(&existingTodo).Error)
	
	// Create a todo that should be deleted (not in note content)
	todoToDelete := models.Todo{
		NoteID:      note.ID,
		TodoID:      "t3",
		Text:        "This should be deleted",
		IsCompleted: false,
	}
	require.NoError(t, db.Create(&todoToDelete).Error)
	
	// Sync todos
	err := service.SyncNoteTodos(note.ID, user.ID)
	assert.NoError(t, err)
	
	// Verify results
	var todos []models.Todo
	require.NoError(t, db.Where("note_id = ?", note.ID).Find(&todos).Error)
	
	assert.Len(t, todos, 2) // Should have 2 todos now
	
	// Find todos by ID
	var t1Todo, t2Todo models.Todo
	for _, todo := range todos {
		if todo.TodoID == "t1" {
			t1Todo = todo
		} else if todo.TodoID == "t2" {
			t2Todo = todo
		}
	}
	
	// Verify t1 was updated
	assert.Equal(t, "t1", t1Todo.TodoID)
	assert.Equal(t, "New todo item", t1Todo.Text)
	assert.False(t, t1Todo.IsCompleted) // Should be updated from true to false
	
	// Verify t2 was created
	assert.Equal(t, "t2", t2Todo.TodoID)
	assert.Equal(t, "Completed todo", t2Todo.Text)
	assert.True(t, t2Todo.IsCompleted)
	
	// Verify t3 was deleted
	var deletedTodo models.Todo
	err = db.Where("note_id = ? AND todo_id = ?", note.ID, "t3").First(&deletedTodo).Error
	assert.Error(t, err) // Should not be found
}

func TestTodoService_GenerateNextTodoID(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewTodoService(db)
	
	// Create test user and note
	user := models.User{
		Username: "testuser_generate",
		Email:    "test_generate@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
	}
	require.NoError(t, db.Create(&note).Error)
	
	// Test with no existing todos
	todoID, err := service.GenerateNextTodoID(note.ID)
	assert.NoError(t, err)
	assert.Equal(t, "t1", todoID)
	
	// Create some todos
	todos := []models.Todo{
		{NoteID: note.ID, TodoID: "t1", Text: "First"},
		{NoteID: note.ID, TodoID: "t3", Text: "Third"},
		{NoteID: note.ID, TodoID: "t2", Text: "Second"},
	}
	
	for _, todo := range todos {
		require.NoError(t, db.Create(&todo).Error)
	}
	
	// Test with existing todos
	todoID, err = service.GenerateNextTodoID(note.ID)
	assert.NoError(t, err)
	assert.Equal(t, "t4", todoID) // Should be next after highest (t3)
}

func TestTodoService_GetTodosWithFilters(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewTodoService(db)
	
	// Create test user
	user := models.User{
		Username: "testuser_filters",
		Email:    "test_filters@example.com",
		Password: "hashedpassword",
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test person
	person := models.Person{
		UserID: user.ID,
		Name:   "John Doe",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)
	
	// Create test notes
	note1 := models.Note{UserID: user.ID, Title: "Note 1"}
	note2 := models.Note{UserID: user.ID, Title: "Note 2"}
	require.NoError(t, db.Create(&note1).Error)
	require.NoError(t, db.Create(&note2).Error)
	
	// Create test todos
	dueDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	todos := []models.Todo{
		{NoteID: note1.ID, TodoID: "t1", Text: "Incomplete todo", IsCompleted: false},
		{NoteID: note1.ID, TodoID: "t2", Text: "Complete todo", IsCompleted: true},
		{NoteID: note2.ID, TodoID: "t1", Text: "Assigned todo", IsCompleted: false, AssignedPersonID: &person.ID},
		{NoteID: note2.ID, TodoID: "t2", Text: "Todo with due date", IsCompleted: false, DueDate: &dueDate},
		{NoteID: note2.ID, TodoID: "t3", Text: "Search this text", IsCompleted: false},
	}
	
	for _, todo := range todos {
		require.NoError(t, db.Create(&todo).Error)
	}
	
	tests := []struct {
		name           string
		filters        TodoFilters
		expectedCount  int
		expectedTodoID string
	}{
		{
			name:          "No filters",
			filters:       TodoFilters{},
			expectedCount: 5,
		},
		{
			name:          "Filter by note ID",
			filters:       TodoFilters{NoteID: &note1.ID},
			expectedCount: 2,
		},
		{
			name:          "Filter by completed status",
			filters:       TodoFilters{IsCompleted: boolPtr(true)},
			expectedCount: 1,
		},
		{
			name:          "Filter by incomplete status",
			filters:       TodoFilters{IsCompleted: boolPtr(false)},
			expectedCount: 4,
		},
		{
			name:          "Filter by assigned person",
			filters:       TodoFilters{AssignedPersonID: &person.ID},
			expectedCount: 1,
		},
		{
			name:          "Filter by has due date",
			filters:       TodoFilters{HasDueDate: boolPtr(true)},
			expectedCount: 1,
		},
		{
			name:          "Filter by no due date",
			filters:       TodoFilters{HasDueDate: boolPtr(false)},
			expectedCount: 4,
		},
		{
			name:          "Search filter",
			filters:       TodoFilters{Search: "Search"},
			expectedCount: 1,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.GetTodosWithFilters(user.ID, tt.filters)
			assert.NoError(t, err)
			assert.Len(t, result, tt.expectedCount)
		})
	}
}

func TestTodoService_GetCalendarTodos(t *testing.T) {
	db := database.SetupTestDB(t)
	defer database.CleanupTestDB(db)
	
	service := NewTodoService(db)
	
	// Create test user
	user := models.User{
		Username: "testuser_calendar",
		Email:    "test_calendar@example.com",
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
	
	// Query calendar todos for range 2024-01-12 to 2024-01-22
	startDate := time.Date(2024, 1, 12, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 1, 22, 0, 0, 0, 0, time.UTC)
	
	result, err := service.GetCalendarTodos(user.ID, startDate, endDate)
	assert.NoError(t, err)
	assert.Len(t, result, 2) // Should only include t2 and t3
	
	// Verify the todos are in the correct order (by due date)
	assert.Equal(t, "t2", result[0].TodoID)
	assert.Equal(t, "t3", result[1].TodoID)
}

// Helper functions
func parseDate(dateStr string) *time.Time {
	date, _ := time.Parse("2006-01-02", dateStr)
	return &date
}

func boolPtr(b bool) *bool {
	return &b
}
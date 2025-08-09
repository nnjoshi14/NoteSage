package database

import (
	"testing"

	"notesage-server/internal/config"
	"notesage-server/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestInitialize(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		cfg     config.DatabaseConfig
		wantErr bool
	}{
		{
			name: "sqlite in-memory",
			cfg: config.DatabaseConfig{
				Type: "sqlite",
				Name: ":memory:",
			},
			wantErr: false,
		},
		{
			name: "unsupported database type",
			cfg: config.DatabaseConfig{
				Type: "mysql",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, err := Initialize(tt.cfg)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, db)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, db)
				
				// Test connection
				sqlDB, err := db.DB()
				require.NoError(t, err)
				assert.NoError(t, sqlDB.Ping())
				
				// Cleanup
				sqlDB.Close()
			}
		})
	}
}

func TestMigrate(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	// Check that all tables exist
	tables := []string{"users", "notes", "people", "todos", "connections", "migrations"}
	
	for _, table := range tables {
		assert.True(t, db.Migrator().HasTable(table), "Table %s should exist", table)
	}

	// Check that migration records exist
	var count int64
	err := db.Model(&models.Migration{}).Count(&count).Error
	assert.NoError(t, err)
	assert.Greater(t, count, int64(0), "Should have migration records")
}

func TestUserCRUD(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	// Create user
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	require.NoError(t, err)

	user := models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: string(hashedPassword),
	}

	err = db.Create(&user).Error
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, user.ID)

	// Read user
	var foundUser models.User
	err = db.Where("username = ?", "testuser").First(&foundUser).Error
	assert.NoError(t, err)
	assert.Equal(t, user.Username, foundUser.Username)
	assert.Equal(t, user.Email, foundUser.Email)

	// Update user
	foundUser.Email = "updated@example.com"
	err = db.Save(&foundUser).Error
	assert.NoError(t, err)

	// Verify update
	var updatedUser models.User
	err = db.First(&updatedUser, foundUser.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, "updated@example.com", updatedUser.Email)

	// Delete user
	err = db.Delete(&updatedUser).Error
	assert.NoError(t, err)

	// Verify deletion
	var deletedUser models.User
	err = db.First(&deletedUser, updatedUser.ID).Error
	assert.Error(t, err)
}

func TestNoteCRUD(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	// Create user first
	user := models.User{
		Username: "testuser_note",
		Email:    "test_note@example.com",
		Password: "password123",
	}
	err := db.Create(&user).Error
	require.NoError(t, err)

	// Create note
	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
		Content: models.JSONB{
			"type": "doc",
			"content": []interface{}{
				map[string]interface{}{
					"type": "paragraph",
					"content": []interface{}{
						map[string]interface{}{"type": "text", "text": "Hello World"},
					},
				},
			},
		},
		Category: "Note",
		Tags:     []string{"test", "example"},
	}

	err = db.Create(&note).Error
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, note.ID)

	// Read note
	var foundNote models.Note
	err = db.Where("title = ?", "Test Note").First(&foundNote).Error
	assert.NoError(t, err)
	assert.Equal(t, note.Title, foundNote.Title)
	assert.Equal(t, note.UserID, foundNote.UserID)
	assert.Equal(t, "Note", foundNote.Category)
	assert.Contains(t, foundNote.Tags, "test")

	// Update note
	foundNote.Title = "Updated Note"
	foundNote.IsPinned = true
	err = db.Save(&foundNote).Error
	assert.NoError(t, err)

	// Verify update
	var updatedNote models.Note
	err = db.First(&updatedNote, foundNote.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, "Updated Note", updatedNote.Title)
	assert.True(t, updatedNote.IsPinned)

	// Delete note
	err = db.Delete(&updatedNote).Error
	assert.NoError(t, err)

	// Verify deletion
	var deletedNote models.Note
	err = db.First(&deletedNote, updatedNote.ID).Error
	assert.Error(t, err)
}

func TestPersonCRUD(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	// Create user first
	user := models.User{
		Username: "testuser_person",
		Email:    "test_person@example.com",
		Password: "password123",
	}
	err := db.Create(&user).Error
	require.NoError(t, err)

	// Create person
	person := models.Person{
		UserID:      user.ID,
		Name:        "John Doe",
		Email:       "john@example.com",
		Phone:       "+1-555-0123",
		Company:     "Test Corp",
		Title:       "Developer",
		LinkedinURL: "https://linkedin.com/in/johndoe",
		Notes:       "Great developer",
	}

	err = db.Create(&person).Error
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, person.ID)

	// Read person
	var foundPerson models.Person
	err = db.Where("name = ?", "John Doe").First(&foundPerson).Error
	assert.NoError(t, err)
	assert.Equal(t, person.Name, foundPerson.Name)
	assert.Equal(t, person.Email, foundPerson.Email)
	assert.Equal(t, person.Company, foundPerson.Company)

	// Update person
	foundPerson.Title = "Senior Developer"
	err = db.Save(&foundPerson).Error
	assert.NoError(t, err)

	// Verify update
	var updatedPerson models.Person
	err = db.First(&updatedPerson, foundPerson.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, "Senior Developer", updatedPerson.Title)

	// Delete person
	err = db.Delete(&updatedPerson).Error
	assert.NoError(t, err)

	// Verify deletion
	var deletedPerson models.Person
	err = db.First(&deletedPerson, updatedPerson.ID).Error
	assert.Error(t, err)
}

func TestTodoCRUD(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	// Create user and note first
	user := models.User{
		Username: "testuser_todo",
		Email:    "test_todo@example.com",
		Password: "password123",
	}
	err := db.Create(&user).Error
	require.NoError(t, err)

	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
	}
	err = db.Create(&note).Error
	require.NoError(t, err)

	// Create todo
	todo := models.Todo{
		NoteID:      note.ID,
		TodoID:      "t1",
		Text:        "Complete task",
		IsCompleted: false,
	}

	err = db.Create(&todo).Error
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, todo.ID)

	// Read todo
	var foundTodo models.Todo
	err = db.Where("todo_id = ? AND note_id = ?", "t1", note.ID).First(&foundTodo).Error
	assert.NoError(t, err)
	assert.Equal(t, todo.Text, foundTodo.Text)
	assert.Equal(t, todo.TodoID, foundTodo.TodoID)
	assert.False(t, foundTodo.IsCompleted)

	// Update todo
	foundTodo.IsCompleted = true
	err = db.Save(&foundTodo).Error
	assert.NoError(t, err)

	// Verify update
	var updatedTodo models.Todo
	err = db.First(&updatedTodo, foundTodo.ID).Error
	assert.NoError(t, err)
	assert.True(t, updatedTodo.IsCompleted)

	// Test unique constraint
	duplicateTodo := models.Todo{
		NoteID: note.ID,
		TodoID: "t1", // Same todo_id for same note
		Text:   "Duplicate task",
	}
	err = db.Create(&duplicateTodo).Error
	assert.Error(t, err, "Should fail due to unique constraint")

	// Delete todo
	err = db.Delete(&updatedTodo).Error
	assert.NoError(t, err)

	// Verify deletion
	var deletedTodo models.Todo
	err = db.First(&deletedTodo, updatedTodo.ID).Error
	assert.Error(t, err)
}

func TestConnectionCRUD(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	// Create user, note, and person first
	user := models.User{
		Username: "testuser_connection",
		Email:    "test_connection@example.com",
		Password: "password123",
	}
	err := db.Create(&user).Error
	require.NoError(t, err)

	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
	}
	err = db.Create(&note).Error
	require.NoError(t, err)

	person := models.Person{
		UserID: user.ID,
		Name:   "John Doe",
	}
	err = db.Create(&person).Error
	require.NoError(t, err)

	// Create connection
	connection := models.Connection{
		UserID:     user.ID,
		SourceID:   note.ID,
		SourceType: "note",
		TargetID:   person.ID,
		TargetType: "person",
		Strength:   2,
	}

	err = db.Create(&connection).Error
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, connection.ID)

	// Read connection
	var foundConnection models.Connection
	err = db.Where("source_id = ? AND target_id = ?", note.ID, person.ID).First(&foundConnection).Error
	assert.NoError(t, err)
	assert.Equal(t, connection.SourceType, foundConnection.SourceType)
	assert.Equal(t, connection.TargetType, foundConnection.TargetType)
	assert.Equal(t, connection.Strength, foundConnection.Strength)

	// Update connection
	foundConnection.Strength = 3
	err = db.Save(&foundConnection).Error
	assert.NoError(t, err)

	// Verify update
	var updatedConnection models.Connection
	err = db.First(&updatedConnection, foundConnection.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, 3, updatedConnection.Strength)

	// Delete connection
	err = db.Delete(&updatedConnection).Error
	assert.NoError(t, err)

	// Verify deletion
	var deletedConnection models.Connection
	err = db.First(&deletedConnection, updatedConnection.ID).Error
	assert.Error(t, err)
}

func TestForeignKeyConstraints(t *testing.T) {
	t.Parallel()
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	// Create user
	user := models.User{
		Username: "testuser_fk",
		Email:    "test_fk@example.com",
		Password: "password123",
	}
	err := db.Create(&user).Error
	require.NoError(t, err)

	// Create note
	note := models.Note{
		UserID: user.ID,
		Title:  "Test Note",
	}
	err = db.Create(&note).Error
	require.NoError(t, err)

	// Create todo
	todo := models.Todo{
		NoteID: note.ID,
		TodoID: "t1",
		Text:   "Test todo",
	}
	err = db.Create(&todo).Error
	require.NoError(t, err)

	// Delete note (should cascade delete todo)
	err = db.Delete(&note).Error
	assert.NoError(t, err)

	// Verify todo was deleted due to cascade
	var foundTodo models.Todo
	err = db.First(&foundTodo, todo.ID).Error
	assert.Error(t, err, "Todo should be deleted due to cascade")

	// Delete user (should cascade delete remaining records)
	err = db.Delete(&user).Error
	assert.NoError(t, err)
}
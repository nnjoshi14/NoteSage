package database

import (
	"testing"

	"notesage-server/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSeeder(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)
	assert.NotNil(t, seeder)
	assert.NotNil(t, seeder.db)
}

func TestSeeder_SeedUsers(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Seed users
	err := seeder.SeedUsers()
	assert.NoError(t, err)

	// Check that users were created
	var count int64
	err = db.Model(&models.User{}).Count(&count).Error
	assert.NoError(t, err)
	assert.Greater(t, count, int64(0))

	// Check specific user
	var user models.User
	err = db.Where("username = ?", "testuser").First(&user).Error
	assert.NoError(t, err)
	assert.Equal(t, "testuser", user.Username)
	assert.Equal(t, "test@example.com", user.Email)

	// Test idempotency - running again should not create duplicates
	err = seeder.SeedUsers()
	assert.NoError(t, err)

	var newCount int64
	err = db.Model(&models.User{}).Count(&newCount).Error
	assert.NoError(t, err)
	assert.Equal(t, count, newCount)
}

func TestSeeder_SeedPeople(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Seed users first (required for foreign key)
	err := seeder.SeedUsers()
	require.NoError(t, err)

	// Seed people
	err = seeder.SeedPeople()
	assert.NoError(t, err)

	// Check that people were created
	var count int64
	err = db.Model(&models.Person{}).Count(&count).Error
	assert.NoError(t, err)
	assert.Greater(t, count, int64(0))

	// Check specific person
	var person models.Person
	err = db.Where("name = ?", "John Smith").First(&person).Error
	assert.NoError(t, err)
	assert.Equal(t, "John Smith", person.Name)
	assert.Equal(t, "john.smith@company.com", person.Email)
	assert.Equal(t, "Tech Corp", person.Company)

	// Test idempotency
	err = seeder.SeedPeople()
	assert.NoError(t, err)

	var newCount int64
	err = db.Model(&models.Person{}).Count(&newCount).Error
	assert.NoError(t, err)
	assert.Equal(t, count, newCount)
}

func TestSeeder_SeedNotes(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Seed users first (required for foreign key)
	err := seeder.SeedUsers()
	require.NoError(t, err)

	// Seed notes
	err = seeder.SeedNotes()
	assert.NoError(t, err)

	// Check that notes were created
	var count int64
	err = db.Model(&models.Note{}).Count(&count).Error
	assert.NoError(t, err)
	assert.Greater(t, count, int64(0))

	// Check specific note
	var note models.Note
	err = db.Where("title = ?", "Project Planning Meeting").First(&note).Error
	assert.NoError(t, err)
	assert.Equal(t, "Project Planning Meeting", note.Title)
	assert.Equal(t, "Meeting", note.Category)
	assert.Contains(t, note.Tags, "planning")
	assert.True(t, note.IsPinned)

	// Check content structure
	assert.NotNil(t, note.Content)
	contentType, exists := note.Content["type"]
	assert.True(t, exists)
	assert.Equal(t, "doc", contentType)

	// Test idempotency
	err = seeder.SeedNotes()
	assert.NoError(t, err)

	var newCount int64
	err = db.Model(&models.Note{}).Count(&newCount).Error
	assert.NoError(t, err)
	assert.Equal(t, count, newCount)
}

func TestSeeder_SeedTodos(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Seed prerequisites
	err := seeder.SeedUsers()
	require.NoError(t, err)
	err = seeder.SeedPeople()
	require.NoError(t, err)
	err = seeder.SeedNotes()
	require.NoError(t, err)

	// Seed todos
	err = seeder.SeedTodos()
	assert.NoError(t, err)

	// Check that todos were created
	var count int64
	err = db.Model(&models.Todo{}).Count(&count).Error
	assert.NoError(t, err)
	assert.Greater(t, count, int64(0))

	// Check specific todo
	var todo models.Todo
	err = db.Where("text = ?", "Finalize project requirements").First(&todo).Error
	assert.NoError(t, err)
	assert.Equal(t, "Finalize project requirements", todo.Text)
	assert.Equal(t, "t1", todo.TodoID)
	assert.False(t, todo.IsCompleted)
	assert.NotNil(t, todo.AssignedPersonID)
	assert.NotNil(t, todo.DueDate)

	// Check completed todo
	var completedTodo models.Todo
	err = db.Where("text = ?", "Schedule follow-up meeting").First(&completedTodo).Error
	assert.NoError(t, err)
	assert.True(t, completedTodo.IsCompleted)

	// Test idempotency
	err = seeder.SeedTodos()
	assert.NoError(t, err)

	var newCount int64
	err = db.Model(&models.Todo{}).Count(&newCount).Error
	assert.NoError(t, err)
	assert.Equal(t, count, newCount)
}

func TestSeeder_SeedConnections(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Seed prerequisites
	err := seeder.SeedUsers()
	require.NoError(t, err)
	err = seeder.SeedPeople()
	require.NoError(t, err)
	err = seeder.SeedNotes()
	require.NoError(t, err)

	// Seed connections
	err = seeder.SeedConnections()
	assert.NoError(t, err)

	// Check that connections were created
	var count int64
	err = db.Model(&models.Connection{}).Count(&count).Error
	assert.NoError(t, err)
	assert.Greater(t, count, int64(0))

	// Check specific connection
	var connection models.Connection
	err = db.Where("source_type = ? AND target_type = ?", "note", "person").First(&connection).Error
	assert.NoError(t, err)
	assert.Equal(t, "note", connection.SourceType)
	assert.Equal(t, "person", connection.TargetType)
	assert.Greater(t, connection.Strength, 0)

	// Test idempotency
	err = seeder.SeedConnections()
	assert.NoError(t, err)

	var newCount int64
	err = db.Model(&models.Connection{}).Count(&newCount).Error
	assert.NoError(t, err)
	assert.Equal(t, count, newCount)
}

func TestSeeder_SeedAll(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Seed all data
	err := seeder.SeedAll()
	assert.NoError(t, err)

	// Check that all tables have data
	tables := []interface{}{
		&models.User{},
		&models.Person{},
		&models.Note{},
		&models.Todo{},
		&models.Connection{},
	}

	for _, table := range tables {
		var count int64
		err = db.Model(table).Count(&count).Error
		assert.NoError(t, err)
		assert.Greater(t, count, int64(0), "Table %T should have data", table)
	}
}

func TestSeeder_ClearAll(t *testing.T) {
	db := SetupTestDBWithSeed(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Verify data exists
	var userCount int64
	err := db.Model(&models.User{}).Count(&userCount).Error
	require.NoError(t, err)
	require.Greater(t, userCount, int64(0))

	// Clear all data
	err = seeder.ClearAll()
	assert.NoError(t, err)

	// Check that all tables are empty
	tables := []interface{}{
		&models.User{},
		&models.Person{},
		&models.Note{},
		&models.Todo{},
		&models.Connection{},
	}

	for _, table := range tables {
		var count int64
		err = db.Model(table).Count(&count).Error
		assert.NoError(t, err)
		assert.Equal(t, int64(0), count, "Table %T should be empty", table)
	}
}

func TestSeeder_ForeignKeyRelationships(t *testing.T) {
	t.Parallel()
	db := SetupTestDB(t)
	defer CleanupTestDB(db)

	seeder := NewSeeder(db)

	// Seed all data
	err := seeder.SeedAll()
	require.NoError(t, err)

	// Test that foreign key relationships work
	var note models.Note
	err = db.Preload("User").Where("title = ?", "Project Planning Meeting").First(&note).Error
	assert.NoError(t, err)
	assert.NotNil(t, note.User)
	assert.Equal(t, "testuser", note.User.Username)

	var todo models.Todo
	err = db.Preload("Note").Preload("AssignedPerson").Where("text = ?", "Finalize project requirements").First(&todo).Error
	assert.NoError(t, err)
	assert.NotNil(t, todo.Note)
	assert.NotNil(t, todo.AssignedPerson)
	assert.Equal(t, "Project Planning Meeting", todo.Note.Title)
	assert.Equal(t, "Sarah Johnson", todo.AssignedPerson.Name)

	var connection models.Connection
	err = db.Preload("User").First(&connection).Error
	assert.NoError(t, err)
	assert.NotNil(t, connection.User)
	assert.Equal(t, "testuser", connection.User.Username)
}
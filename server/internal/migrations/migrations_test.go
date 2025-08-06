package migrations

import (
	"testing"

	"notesage-server/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	return db
}

func TestNewMigrator(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	migrator := NewMigrator(db)
	assert.NotNil(t, migrator)
	assert.NotNil(t, migrator.db)
	assert.Greater(t, len(migrator.migrations), 0)
}

func TestMigrator_Migrate(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	migrator := NewMigrator(db)

	// Run migrations
	err := migrator.Migrate()
	assert.NoError(t, err)

	// Check that migrations table exists
	assert.True(t, db.Migrator().HasTable("migrations"))

	// Check that all expected tables exist
	expectedTables := []string{"users", "notes", "people", "todos", "connections"}
	for _, table := range expectedTables {
		assert.True(t, db.Migrator().HasTable(table), "Table %s should exist", table)
	}

	// Check that migration records were created
	var count int64
	err = db.Model(&models.Migration{}).Count(&count).Error
	assert.NoError(t, err)
	assert.Greater(t, count, int64(0))

	// Run migrations again (should be idempotent)
	err = migrator.Migrate()
	assert.NoError(t, err)

	// Count should remain the same
	var newCount int64
	err = db.Model(&models.Migration{}).Count(&newCount).Error
	assert.NoError(t, err)
	assert.Equal(t, count, newCount)
}

func TestMigrator_Status(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	migrator := NewMigrator(db)

	// Run migrations first
	err := migrator.Migrate()
	require.NoError(t, err)

	// Check status
	err = migrator.Status()
	assert.NoError(t, err)
}

func TestMigrator_Rollback(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	migrator := NewMigrator(db)

	// Run migrations first
	err := migrator.Migrate()
	require.NoError(t, err)

	// Get initial migration count
	var initialCount int64
	err = db.Model(&models.Migration{}).Count(&initialCount).Error
	require.NoError(t, err)
	require.Greater(t, initialCount, int64(0))

	// Rollback last migration
	err = migrator.Rollback()
	assert.NoError(t, err)

	// Check that migration count decreased
	var newCount int64
	err = db.Model(&models.Migration{}).Count(&newCount).Error
	assert.NoError(t, err)
	assert.Equal(t, initialCount-1, newCount)
}

func TestMigrator_RollbackNoMigrations(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	migrator := NewMigrator(db)

	// Ensure migrations table exists
	err := db.AutoMigrate(&models.Migration{})
	require.NoError(t, err)

	// Try to rollback without any migrations
	err = migrator.Rollback()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no migrations to rollback")
}

func TestGetAllMigrations(t *testing.T) {
	migrations := getAllMigrations()
	
	assert.Greater(t, len(migrations), 0)
	
	// Check that all migrations have required fields
	for _, migration := range migrations {
		assert.NotEmpty(t, migration.Version)
		assert.NotEmpty(t, migration.Name)
		assert.NotNil(t, migration.Up)
		// Down function is optional for some migrations
	}
	
	// Check that versions are unique
	versions := make(map[string]bool)
	for _, migration := range migrations {
		assert.False(t, versions[migration.Version], "Version %s should be unique", migration.Version)
		versions[migration.Version] = true
	}
}

func TestMigration001(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	// Run migration 001
	err := migration001Up(db)
	assert.NoError(t, err)

	// Check that all tables exist
	expectedTables := []string{"users", "notes", "people", "todos", "connections"}
	for _, table := range expectedTables {
		assert.True(t, db.Migrator().HasTable(table), "Table %s should exist", table)
	}

	// Test rollback
	err = migration001Down(db)
	assert.NoError(t, err)

	// Check that tables are dropped
	for _, table := range expectedTables {
		assert.False(t, db.Migrator().HasTable(table), "Table %s should not exist after rollback", table)
	}
}

func TestMigration002(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	// Run migration 001 first
	err := migration001Up(db)
	require.NoError(t, err)

	// Run migration 002
	err = migration002Up(db)
	assert.NoError(t, err)

	// Test rollback
	err = migration002Down(db)
	assert.NoError(t, err)
}

func TestMigration003(t *testing.T) {
	db := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	// Run migrations 001 and 002 first
	err := migration001Up(db)
	require.NoError(t, err)
	
	err = migration002Up(db)
	require.NoError(t, err)

	// Run migration 003
	err = migration003Up(db)
	assert.NoError(t, err)

	// Test rollback
	err = migration003Down(db)
	assert.NoError(t, err)
}
package database

import (
	"fmt"
	"os"
	"testing"

	"notesage-server/internal/config"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SetupTestDB creates a unique, in-memory test database for each test.
func SetupTestDB(t *testing.T) *gorm.DB {
	// Create a unique database name for each test to ensure isolation.
	dbName := fmt.Sprintf("testdb_%s", uuid.New().String())

	cfg := config.DatabaseConfig{
		Type: "sqlite",
		Name: dbName,
	}

	db, err := Initialize(cfg)
	if err != nil {
		t.Fatalf("Failed to initialize test database: %v", err)
	}

	// Run migrations
	if err := Migrate(db); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	// The CleanupTestDB function will be called automatically by t.Cleanup.
	t.Cleanup(func() {
		CleanupTestDB(db)
	})

	return db
}

// SetupTestDBWithSeed creates a test database with seed data
func SetupTestDBWithSeed(t *testing.T) *gorm.DB {
	db := SetupTestDB(t)

	// Create a test user first
	seeder := NewSeeder(db)
	if err := seeder.SeedAll(); err != nil {
		t.Fatalf("Failed to seed test database: %v", err)
	}

	return db
}

// CleanupTestDB cleans up the test database
func CleanupTestDB(db *gorm.DB) {
	if db != nil {
		sqlDB, err := db.DB()
		if err == nil {
			sqlDB.Close()
		}
	}
}

// TestMain sets up and tears down test environment
func TestMain(m *testing.M) {
	// Setup
	fmt.Println("Setting up test environment...")

	// Run tests
	code := m.Run()

	// Teardown
	fmt.Println("Tearing down test environment...")

	os.Exit(code)
}

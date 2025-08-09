package database

import (
	"fmt"
	"os"
	"testing"

	"notesage-server/internal/config"

	"gorm.io/gorm"
)

// SetupTestDB creates a test database connection
func SetupTestDB(t *testing.T) *gorm.DB {
	// Use in-memory SQLite for tests
	cfg := config.DatabaseConfig{
		Type: "sqlite",
		Name: ":memory:",
	}

	db, err := Initialize(cfg)
	if err != nil {
		t.Fatalf("Failed to initialize test database: %v", err)
	}

	// Run migrations
	if err := Migrate(db); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

// SetupTestDBWithSeed creates a test database with seed data
func SetupTestDBWithSeed(t *testing.T) *gorm.DB {
	db := SetupTestDB(t)

	// Create a test user first
	seeder := NewSeeder(db)
	if err := seeder.SeedUsers(); err != nil {
		t.Fatalf("Failed to seed test users: %v", err)
	}

	// Seed test data
	if err := Seed(db); err != nil {
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
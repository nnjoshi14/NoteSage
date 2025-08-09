package database

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"notesage-server/internal/config"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// testDBInfo stores information about a test database for cleanup
type testDBInfo struct {
	db     *gorm.DB
	dbName string
}

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

	// Store the database info for cleanup
	info := &testDBInfo{db: db, dbName: dbName}

	// The cleanup function will be called automatically by t.Cleanup.
	t.Cleanup(func() {
		cleanupTestDBInternal(info)
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

// cleanupTestDBInternal cleans up the test database and removes files
func cleanupTestDBInternal(info *testDBInfo) {
	if info == nil || info.db == nil {
		return
	}

	// Close the database connection
	sqlDB, err := info.db.DB()
	if err == nil {
		sqlDB.Close()
	}

	// Remove the database file and its associated files
	if info.dbName != "" {
		// Remove the main database file
		dbFile := info.dbName + ".db"
		os.Remove(dbFile)

		// Remove WAL and SHM files if they exist
		walFile := info.dbName + ".db-wal"
		shmFile := info.dbName + ".db-shm"
		os.Remove(walFile)
		os.Remove(shmFile)

		// Also check for files in current directory with the pattern
		pattern := info.dbName + ".db*"
		if matches, err := filepath.Glob(pattern); err == nil {
			for _, match := range matches {
				os.Remove(match)
			}
		}
	}
}

// cleanupMemoryDBFiles cleans up any :memory:.db files that might be left behind
func cleanupMemoryDBFiles() {
	// Remove :memory:.db files and their associated files
	memoryFiles := []string{
		":memory:.db",
		":memory:.db-wal",
		":memory:.db-shm",
	}

	for _, file := range memoryFiles {
		os.Remove(file)
	}

	// Also check for any files matching the pattern in subdirectories
	if matches, err := filepath.Glob("**/:memory:.db*"); err == nil {
		for _, match := range matches {
			os.Remove(match)
		}
	}
}

// CleanupTestDBLegacy is a legacy function for backward compatibility
// It will be removed in future versions
func CleanupTestDBLegacy(db *gorm.DB) {
	// This function is kept for backward compatibility
	// It only closes the connection but doesn't remove files
	if db != nil {
		sqlDB, err := db.DB()
		if err == nil {
			sqlDB.Close()
		}
	}
}

// CleanupTestDB is a backward-compatible function that cleans up test databases
// This function maintains the same signature as the original for compatibility
func CleanupTestDB(db *gorm.DB) {
	// Close the database connection
	if db != nil {
		sqlDB, err := db.DB()
		if err == nil {
			sqlDB.Close()
		}
	}

	// Note: File cleanup is now handled automatically by SetupTestDB
	// This function is kept for backward compatibility with existing test code
}

// TestMain sets up and tears down test environment
func TestMain(m *testing.M) {
	// Setup
	fmt.Println("Setting up test environment...")

	// Run tests
	code := m.Run()

	// Teardown
	fmt.Println("Tearing down test environment...")

	// Clean up any remaining test database files
	cleanupTestFiles()

	os.Exit(code)
}

// cleanupTestFiles removes any remaining test database files
func cleanupTestFiles() {
	// Remove any remaining testdb_*.db files
	pattern := "testdb_*.db*"
	if matches, err := filepath.Glob(pattern); err == nil {
		for _, match := range matches {
			os.Remove(match)
		}
	}

	// Also clean up :memory:.db files
	cleanupMemoryDBFiles()
}

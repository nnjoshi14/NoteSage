package migrations

import (
	"fmt"
	"sort"
	"time"

	"notesage-server/internal/models"

	"gorm.io/gorm"
)

// MigrationFunc represents a migration function
type MigrationFunc func(*gorm.DB) error

// MigrationEntry represents a single migration
type MigrationEntry struct {
	Version string
	Name    string
	Up      MigrationFunc
	Down    MigrationFunc
}

// Migrator handles database migrations
type Migrator struct {
	db         *gorm.DB
	migrations []MigrationEntry
}

// NewMigrator creates a new migrator instance
func NewMigrator(db *gorm.DB) *Migrator {
	return &Migrator{
		db:         db,
		migrations: getAllMigrations(),
	}
}

// Migrate runs all pending migrations
func (m *Migrator) Migrate() error {
	// Ensure migrations table exists
	if err := m.db.AutoMigrate(&models.Migration{}); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get applied migrations
	var appliedMigrations []models.Migration
	if err := m.db.Find(&appliedMigrations).Error; err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	appliedVersions := make(map[string]bool)
	for _, migration := range appliedMigrations {
		appliedVersions[migration.Version] = true
	}

	// Sort migrations by version
	sort.Slice(m.migrations, func(i, j int) bool {
		return m.migrations[i].Version < m.migrations[j].Version
	})

	// Run pending migrations
	for _, migration := range m.migrations {
		if !appliedVersions[migration.Version] {
			fmt.Printf("Running migration %s: %s\n", migration.Version, migration.Name)
			
			// Start transaction
			tx := m.db.Begin()
			if tx.Error != nil {
				return fmt.Errorf("failed to start transaction: %w", tx.Error)
			}

			// Run migration
			if err := migration.Up(tx); err != nil {
				tx.Rollback()
				return fmt.Errorf("migration %s failed: %w", migration.Version, err)
			}

			// Record migration
			migrationRecord := models.Migration{
				Version:   migration.Version,
				Name:      migration.Name,
				AppliedAt: time.Now(),
			}
			if err := tx.Create(&migrationRecord).Error; err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to record migration %s: %w", migration.Version, err)
			}

			// Commit transaction
			if err := tx.Commit().Error; err != nil {
				return fmt.Errorf("failed to commit migration %s: %w", migration.Version, err)
			}

			fmt.Printf("Migration %s completed successfully\n", migration.Version)
		}
	}

	return nil
}

// Rollback rolls back the last migration
func (m *Migrator) Rollback() error {
	// Get the last applied migration
	var lastMigration models.Migration
	if err := m.db.Order("applied_at DESC").First(&lastMigration).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("no migrations to rollback")
		}
		return fmt.Errorf("failed to get last migration: %w", err)
	}

	// Find the migration entry
	var migrationEntry *MigrationEntry
	for _, migration := range m.migrations {
		if migration.Version == lastMigration.Version {
			migrationEntry = &migration
			break
		}
	}

	if migrationEntry == nil {
		return fmt.Errorf("migration %s not found in migration list", lastMigration.Version)
	}

	if migrationEntry.Down == nil {
		return fmt.Errorf("migration %s has no rollback function", lastMigration.Version)
	}

	fmt.Printf("Rolling back migration %s: %s\n", migrationEntry.Version, migrationEntry.Name)

	// Start transaction
	tx := m.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to start transaction: %w", tx.Error)
	}

	// Run rollback
	if err := migrationEntry.Down(tx); err != nil {
		tx.Rollback()
		return fmt.Errorf("rollback %s failed: %w", migrationEntry.Version, err)
	}

	// Remove migration record
	if err := tx.Delete(&lastMigration).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to remove migration record %s: %w", migrationEntry.Version, err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit rollback %s: %w", migrationEntry.Version, err)
	}

	fmt.Printf("Rollback %s completed successfully\n", migrationEntry.Version)
	return nil
}

// Status shows migration status
func (m *Migrator) Status() error {
	// Get applied migrations
	var appliedMigrations []models.Migration
	if err := m.db.Find(&appliedMigrations).Error; err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	appliedVersions := make(map[string]models.Migration)
	for _, migration := range appliedMigrations {
		appliedVersions[migration.Version] = migration
	}

	// Sort migrations by version
	sort.Slice(m.migrations, func(i, j int) bool {
		return m.migrations[i].Version < m.migrations[j].Version
	})

	fmt.Println("Migration Status:")
	fmt.Println("================")
	
	for _, migration := range m.migrations {
		if applied, exists := appliedVersions[migration.Version]; exists {
			fmt.Printf("✓ %s: %s (applied at %s)\n", 
				migration.Version, 
				migration.Name, 
				applied.AppliedAt.Format("2006-01-02 15:04:05"))
		} else {
			fmt.Printf("✗ %s: %s (pending)\n", migration.Version, migration.Name)
		}
	}

	return nil
}

// getAllMigrations returns all available migrations
func getAllMigrations() []MigrationEntry {
	return []MigrationEntry{
		{
			Version: "001",
			Name:    "Create initial tables",
			Up:      migration001Up,
			Down:    migration001Down,
		},
		{
			Version: "002",
			Name:    "Add indexes and constraints",
			Up:      migration002Up,
			Down:    migration002Down,
		},
		{
			Version: "003",
			Name:    "Add unique constraint for todos",
			Up:      migration003Up,
			Down:    migration003Down,
		},
		{
			Version: "004",
			Name:    "Add user role and activity fields",
			Up:      migration004Up,
			Down:    migration004Down,
		},
	}
}
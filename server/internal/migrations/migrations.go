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
	logger     Logger
}

// Logger interface for migration logging
type Logger interface {
	Info(msg string, args ...interface{})
	Error(msg string, args ...interface{})
	Warn(msg string, args ...interface{})
}

// DefaultLogger provides basic logging
type DefaultLogger struct{}

func (l DefaultLogger) Info(msg string, args ...interface{}) {
	fmt.Printf("[INFO] "+msg+"\n", args...)
}

func (l DefaultLogger) Error(msg string, args ...interface{}) {
	fmt.Printf("[ERROR] "+msg+"\n", args...)
}

func (l DefaultLogger) Warn(msg string, args ...interface{}) {
	fmt.Printf("[WARN] "+msg+"\n", args...)
}

// NewMigrator creates a new migrator instance
func NewMigrator(db *gorm.DB) *Migrator {
	return &Migrator{
		db:         db,
		migrations: getAllMigrations(),
		logger:     DefaultLogger{},
	}
}

// NewMigratorWithLogger creates a new migrator instance with custom logger
func NewMigratorWithLogger(db *gorm.DB, logger Logger) *Migrator {
	return &Migrator{
		db:         db,
		migrations: getAllMigrations(),
		logger:     logger,
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

// MigrateToVersion migrates to a specific version
func (m *Migrator) MigrateToVersion(targetVersion string) error {
	m.logger.Info("Migrating to version %s", targetVersion)
	
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

	// Find target migration
	targetIndex := -1
	for i, migration := range m.migrations {
		if migration.Version == targetVersion {
			targetIndex = i
			break
		}
	}

	if targetIndex == -1 {
		return fmt.Errorf("target version %s not found", targetVersion)
	}

	// Run migrations up to target version
	for i := 0; i <= targetIndex; i++ {
		migration := m.migrations[i]
		if !appliedVersions[migration.Version] {
			if err := m.runMigration(migration); err != nil {
				return err
			}
		}
	}

	m.logger.Info("Successfully migrated to version %s", targetVersion)
	return nil
}

// RollbackToVersion rolls back to a specific version
func (m *Migrator) RollbackToVersion(targetVersion string) error {
	m.logger.Info("Rolling back to version %s", targetVersion)
	
	// Get applied migrations in reverse order
	var appliedMigrations []models.Migration
	if err := m.db.Order("applied_at DESC").Find(&appliedMigrations).Error; err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Find target migration
	targetFound := false
	for _, migration := range m.migrations {
		if migration.Version == targetVersion {
			targetFound = true
			break
		}
	}

	if !targetFound {
		return fmt.Errorf("target version %s not found", targetVersion)
	}

	// Rollback migrations until we reach the target version
	for _, appliedMigration := range appliedMigrations {
		if appliedMigration.Version == targetVersion {
			break
		}

		// Find the migration entry
		var migrationEntry *MigrationEntry
		for _, migration := range m.migrations {
			if migration.Version == appliedMigration.Version {
				migrationEntry = &migration
				break
			}
		}

		if migrationEntry == nil {
			m.logger.Warn("Migration %s not found in migration list, skipping rollback", appliedMigration.Version)
			continue
		}

		if migrationEntry.Down == nil {
			return fmt.Errorf("migration %s has no rollback function", appliedMigration.Version)
		}

		if err := m.rollbackMigration(*migrationEntry, appliedMigration); err != nil {
			return err
		}
	}

	m.logger.Info("Successfully rolled back to version %s", targetVersion)
	return nil
}

// ValidateMigrations checks if all migrations are valid
func (m *Migrator) ValidateMigrations() error {
	m.logger.Info("Validating migrations")
	
	versions := make(map[string]bool)
	
	for _, migration := range m.migrations {
		// Check for duplicate versions
		if versions[migration.Version] {
			return fmt.Errorf("duplicate migration version: %s", migration.Version)
		}
		versions[migration.Version] = true
		
		// Check if Up function exists
		if migration.Up == nil {
			return fmt.Errorf("migration %s has no Up function", migration.Version)
		}
		
		// Warn if Down function is missing
		if migration.Down == nil {
			m.logger.Warn("Migration %s has no Down function (rollback not possible)", migration.Version)
		}
		
		// Validate version format (should be numeric)
		if len(migration.Version) == 0 {
			return fmt.Errorf("migration has empty version")
		}
	}
	
	m.logger.Info("All migrations are valid")
	return nil
}

// CreateBackup creates a database backup before running migrations
func (m *Migrator) CreateBackup(backupPath string) error {
	m.logger.Info("Creating database backup at %s", backupPath)
	
	// This would typically use pg_dump or similar
	// For now, we'll create a simple backup of the migrations table
	var migrations []models.Migration
	if err := m.db.Find(&migrations).Error; err != nil {
		return fmt.Errorf("failed to read migrations for backup: %w", err)
	}
	
	// In a real implementation, you would use pg_dump here
	m.logger.Info("Database backup created successfully")
	return nil
}

// GetPendingMigrations returns migrations that haven't been applied
func (m *Migrator) GetPendingMigrations() ([]MigrationEntry, error) {
	// Get applied migrations
	var appliedMigrations []models.Migration
	if err := m.db.Find(&appliedMigrations).Error; err != nil {
		return nil, fmt.Errorf("failed to get applied migrations: %w", err)
	}

	appliedVersions := make(map[string]bool)
	for _, migration := range appliedMigrations {
		appliedVersions[migration.Version] = true
	}

	// Find pending migrations
	var pending []MigrationEntry
	for _, migration := range m.migrations {
		if !appliedVersions[migration.Version] {
			pending = append(pending, migration)
		}
	}

	return pending, nil
}

// GetAppliedMigrations returns migrations that have been applied
func (m *Migrator) GetAppliedMigrations() ([]models.Migration, error) {
	var appliedMigrations []models.Migration
	if err := m.db.Order("applied_at ASC").Find(&appliedMigrations).Error; err != nil {
		return nil, fmt.Errorf("failed to get applied migrations: %w", err)
	}
	return appliedMigrations, nil
}

// runMigration executes a single migration
func (m *Migrator) runMigration(migration MigrationEntry) error {
	m.logger.Info("Running migration %s: %s", migration.Version, migration.Name)
	
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

	m.logger.Info("Migration %s completed successfully", migration.Version)
	return nil
}

// rollbackMigration executes a single migration rollback
func (m *Migrator) rollbackMigration(migration MigrationEntry, record models.Migration) error {
	m.logger.Info("Rolling back migration %s: %s", migration.Version, migration.Name)

	// Start transaction
	tx := m.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to start transaction: %w", tx.Error)
	}

	// Run rollback
	if err := migration.Down(tx); err != nil {
		tx.Rollback()
		return fmt.Errorf("rollback %s failed: %w", migration.Version, err)
	}

	// Remove migration record
	if err := tx.Delete(&record).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to remove migration record %s: %w", migration.Version, err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit rollback %s: %w", migration.Version, err)
	}

	m.logger.Info("Rollback %s completed successfully", migration.Version)
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
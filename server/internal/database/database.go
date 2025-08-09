package database

import (
	"fmt"
	"time"

	"notesage-server/internal/config"
	"notesage-server/internal/migrations"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Initialize creates and configures the database connection
func Initialize(cfg config.DatabaseConfig) (*gorm.DB, error) {
	var db *gorm.DB
	var err error

	// Configure GORM logger
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	switch cfg.Type {
	case "postgres":
		dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=%s TimeZone=UTC",
			cfg.Host, cfg.User, cfg.Password, cfg.Name, cfg.Port, cfg.SSLMode)
		db, err = gorm.Open(postgres.Open(dsn), gormConfig)
	case "sqlite":
		var dsn string
		if cfg.Name == ":memory:" {
			// For true in-memory database, don't append .db
			dsn = ":memory:?_foreign_keys=on&_journal_mode=WAL&_synchronous=NORMAL&_cache_size=1000000000"
		} else {
			// For file-based database, append .db
			dsn = cfg.Name + ".db?_foreign_keys=on&_journal_mode=WAL&_synchronous=NORMAL&_cache_size=1000000000"
		}
		db, err = gorm.Open(sqlite.Open(dsn), gormConfig)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cfg.Type)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Test the connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	fmt.Printf("Successfully connected to %s database\n", cfg.Type)
	return db, nil
}

// Migrate runs database migrations
func Migrate(db *gorm.DB) error {
	migrator := migrations.NewMigrator(db)
	return migrator.Migrate()
}

// MigrateStatus shows migration status
func MigrateStatus(db *gorm.DB) error {
	migrator := migrations.NewMigrator(db)
	return migrator.Status()
}

// MigrateRollback rolls back the last migration
func MigrateRollback(db *gorm.DB) error {
	migrator := migrations.NewMigrator(db)
	return migrator.Rollback()
}

// Seed populates the database with test data
func Seed(db *gorm.DB) error {
	seeder := NewSeeder(db)
	return seeder.SeedAll()
}

// ClearSeedData removes all seeded data
func ClearSeedData(db *gorm.DB) error {
	seeder := NewSeeder(db)
	return seeder.ClearAll()
}

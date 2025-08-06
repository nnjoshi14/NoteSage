package migrations

import (
	"gorm.io/gorm"
)

// migration004Up adds user role and activity fields
func migration004Up(db *gorm.DB) error {
	// Check if columns already exist before adding them
	var count int64
	
	// Check if role column exists
	db.Raw("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'role'").Scan(&count)
	if count == 0 {
		if err := db.Exec("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL").Error; err != nil {
			return err
		}
	}
	
	// Check if is_active column exists
	db.Raw("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'is_active'").Scan(&count)
	if count == 0 {
		if err := db.Exec("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL").Error; err != nil {
			return err
		}
	}
	
	// Check if last_login column exists
	db.Raw("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'last_login'").Scan(&count)
	if count == 0 {
		if err := db.Exec("ALTER TABLE users ADD COLUMN last_login TIMESTAMP").Error; err != nil {
			return err
		}
	}

	// Create index on role for performance
	if err := db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)
	`).Error; err != nil {
		return err
	}

	// Create index on is_active for performance
	if err := db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)
	`).Error; err != nil {
		return err
	}

	return nil
}

// migration004Down removes user role and activity fields
func migration004Down(db *gorm.DB) error {
	// Remove indexes
	if err := db.Exec(`DROP INDEX IF EXISTS idx_users_role`).Error; err != nil {
		return err
	}
	if err := db.Exec(`DROP INDEX IF EXISTS idx_users_is_active`).Error; err != nil {
		return err
	}

	// SQLite doesn't support DROP COLUMN, so we need to recreate the table
	// This is a simplified approach - in production you'd want to preserve data
	if err := db.Exec(`
		CREATE TABLE users_backup AS SELECT id, username, email, password, created_at, updated_at FROM users
	`).Error; err != nil {
		return err
	}

	if err := db.Exec(`DROP TABLE users`).Error; err != nil {
		return err
	}

	if err := db.Exec(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			created_at DATETIME,
			updated_at DATETIME
		)
	`).Error; err != nil {
		return err
	}

	if err := db.Exec(`
		INSERT INTO users (id, username, email, password, created_at, updated_at)
		SELECT id, username, email, password, created_at, updated_at FROM users_backup
	`).Error; err != nil {
		return err
	}

	if err := db.Exec(`DROP TABLE users_backup`).Error; err != nil {
		return err
	}

	return nil
}
package migrations

import (
	"notesage-server/internal/models"

	"gorm.io/gorm"
)

// migration001Up creates the initial database tables
func migration001Up(db *gorm.DB) error {
	// Create tables with auto-migration
	return db.AutoMigrate(
		&models.User{},
		&models.Note{},
		&models.Person{},
		&models.Todo{},
		&models.Connection{},
	)
}

// migration001Down drops the initial database tables
func migration001Down(db *gorm.DB) error {
	// Drop tables in reverse order to handle foreign key constraints
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Migrator().DropTable(&models.Connection{}); err != nil {
			return err
		}
		if err := tx.Migrator().DropTable(&models.Todo{}); err != nil {
			return err
		}
		if err := tx.Migrator().DropTable(&models.Person{}); err != nil {
			return err
		}
		if err := tx.Migrator().DropTable(&models.Note{}); err != nil {
			return err
		}
		if err := tx.Migrator().DropTable(&models.User{}); err != nil {
			return err
		}
		return nil
	})
}
package migrations

import (
	"gorm.io/gorm"
)

// migration003Up adds unique constraint for todos (note_id, todo_id)
func migration003Up(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Add unique index for todo_id within a note (works for both SQLite and PostgreSQL)
		if err := tx.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_note_todo_unique ON todos(note_id, todo_id)").Error; err != nil {
			return err
		}
		
		// Add check constraint for todo_id format (PostgreSQL only)
		if tx.Dialector.Name() == "postgres" {
			if err := tx.Exec("ALTER TABLE todos ADD CONSTRAINT check_todo_id_format CHECK (todo_id ~ '^t[0-9]+$')").Error; err != nil {
				return err
			}
		}
		
		// Add check constraint for source_type and target_type in connections (PostgreSQL only)
		if tx.Dialector.Name() == "postgres" {
			if err := tx.Exec("ALTER TABLE connections ADD CONSTRAINT check_source_type CHECK (source_type IN ('note', 'person'))").Error; err != nil {
				return err
			}
			if err := tx.Exec("ALTER TABLE connections ADD CONSTRAINT check_target_type CHECK (target_type IN ('note', 'person'))").Error; err != nil {
				return err
			}
		}
		
		return nil
	})
}

// migration003Down removes the unique constraint for todos
func migration003Down(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Remove unique index
		if err := tx.Exec("DROP INDEX IF EXISTS idx_todos_note_todo_unique").Error; err != nil {
			// Continue even if index doesn't exist
		}
		
		// Remove PostgreSQL constraints
		if tx.Dialector.Name() == "postgres" {
			constraints := []string{
				"check_todo_id_format",
				"check_source_type",
				"check_target_type",
			}
			
			for _, constraint := range constraints {
				if err := tx.Exec("ALTER TABLE todos DROP CONSTRAINT IF EXISTS " + constraint).Error; err != nil {
					// Continue even if constraint doesn't exist
					continue
				}
			}
		}
		
		return nil
	})
}
package migrations

import (
	"gorm.io/gorm"
)

// migration002Up adds additional indexes and constraints
func migration002Up(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Add composite indexes for better query performance
		
		// Notes table indexes
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_notes_user_category ON notes(user_id, category)").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_notes_user_archived ON notes(user_id, is_archived)").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON notes(user_id, is_pinned)").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_notes_user_favorite ON notes(user_id, is_favorite)").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC)").Error; err != nil {
			return err
		}
		
		// People table indexes
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_people_user_name ON people(user_id, name)").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_people_user_company ON people(user_id, company)").Error; err != nil {
			return err
		}
		
		// Todos table indexes
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_todos_note_completed ON todos(note_id, is_completed)").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_todos_person_completed ON todos(assigned_person_id, is_completed) WHERE assigned_person_id IS NOT NULL").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date) WHERE due_date IS NOT NULL").Error; err != nil {
			return err
		}
		
		// Connections table indexes
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_connections_user_source ON connections(user_id, source_id, source_type)").Error; err != nil {
			return err
		}
		if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_connections_user_target ON connections(user_id, target_id, target_type)").Error; err != nil {
			return err
		}
		
		// Full-text search index for notes (PostgreSQL only)
		if tx.Dialector.Name() == "postgres" {
			// Create GIN index for full-text search on note content
			if err := tx.Exec("CREATE INDEX IF NOT EXISTS idx_notes_content_gin ON notes USING gin(to_tsvector('english', title || ' ' || coalesce(content::text, '')))").Error; err != nil {
				return err
			}
		}
		
		return nil
	})
}

// migration002Down removes the additional indexes and constraints
func migration002Down(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Drop composite indexes
		indexes := []string{
			"idx_notes_user_category",
			"idx_notes_user_archived",
			"idx_notes_user_pinned",
			"idx_notes_user_favorite",
			"idx_notes_user_updated",
			"idx_people_user_name",
			"idx_people_user_company",
			"idx_todos_note_completed",
			"idx_todos_person_completed",
			"idx_todos_due_date",
			"idx_connections_user_source",
			"idx_connections_user_target",
			"idx_notes_content_gin",
		}
		
		for _, index := range indexes {
			if err := tx.Exec("DROP INDEX IF EXISTS " + index).Error; err != nil {
				return err
			}
		}
		
		return nil
	})
}
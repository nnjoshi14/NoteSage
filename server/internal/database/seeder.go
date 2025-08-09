package database

import (
	"fmt"
	"time"

	"notesage-server/internal/models"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Seeder handles database seeding for development and testing
type Seeder struct {
	db *gorm.DB
}

// NewSeeder creates a new seeder instance
func NewSeeder(db *gorm.DB) *Seeder {
	return &Seeder{db: db}
}

// SeedAll seeds all data for development
func (s *Seeder) SeedAll() error {
	fmt.Println("Seeding database...")
	
	if err := s.SeedUsers(); err != nil {
		return fmt.Errorf("failed to seed users: %w", err)
	}
	
	if err := s.SeedPeople(); err != nil {
		return fmt.Errorf("failed to seed people: %w", err)
	}
	
	if err := s.SeedNotes(); err != nil {
		return fmt.Errorf("failed to seed notes: %w", err)
	}
	
	if err := s.SeedTodos(); err != nil {
		return fmt.Errorf("failed to seed todos: %w", err)
	}
	
	if err := s.SeedConnections(); err != nil {
		return fmt.Errorf("failed to seed connections: %w", err)
	}
	
	fmt.Println("Database seeding completed successfully!")
	return nil
}

// SeedUsers creates test users
func (s *Seeder) SeedUsers() error {
	// Check if users already exist
	var count int64
	if err := s.db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	
	if count > 0 {
		fmt.Println("Users already exist, skipping user seeding")
		return nil
	}
	
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	
	users := []models.User{
		{
			ID:       uuid.MustParse("550e8400-e29b-41d4-a716-446655440001"),
			Username: "testuser",
			Email:    "test@example.com",
			Password: string(hashedPassword),
		},
		{
			ID:       uuid.MustParse("550e8400-e29b-41d4-a716-446655440002"),
			Username: "demouser",
			Email:    "demo@example.com",
			Password: string(hashedPassword),
		},
	}
	
	for _, user := range users {
		if err := s.db.Create(&user).Error; err != nil {
			return err
		}
	}
	
	fmt.Printf("Created %d test users\n", len(users))
	return nil
}

// SeedPeople creates test people
func (s *Seeder) SeedPeople() error {
	// Check if people already exist
	var count int64
	if err := s.db.Model(&models.Person{}).Count(&count).Error; err != nil {
		return err
	}
	
	if count > 0 {
		fmt.Println("People already exist, skipping people seeding")
		return nil
	}
	
	// Get the first user from the database
	var testUser models.User
	if err := s.db.First(&testUser).Error; err != nil {
		return fmt.Errorf("no users found for seeding people: %w", err)
	}
	testUserID := testUser.ID
	
	people := []models.Person{
		{
			ID:          uuid.New(),
			UserID:      testUserID,
			Name:        "John Smith",
			Email:       "john.smith@company.com",
			Phone:       "+1-555-0123",
			Company:     "Tech Corp",
			Title:       "Senior Developer",
			LinkedinURL: "https://linkedin.com/in/johnsmith",
			Notes:       "Great developer, worked on the authentication system",
		},
		{
			ID:          uuid.New(),
			UserID:      testUserID,
			Name:        "Sarah Johnson",
			Email:       "sarah.johnson@company.com",
			Phone:       "+1-555-0124",
			Company:     "Tech Corp",
			Title:       "Product Manager",
			LinkedinURL: "https://linkedin.com/in/sarahjohnson",
			Notes:       "Product manager for the NoteSage project",
		},
		{
			ID:          uuid.New(),
			UserID:      testUserID,
			Name:        "Mike Wilson",
			Email:       "mike.wilson@design.com",
			Company:     "Design Studio",
			Title:       "UX Designer",
			Notes:       "Freelance designer, helped with UI mockups",
		},
	}
	
	for _, person := range people {
		if err := s.db.Create(&person).Error; err != nil {
			return err
		}
	}
	
	fmt.Printf("Created %d test people\n", len(people))
	return nil
}

// SeedNotes creates test notes
func (s *Seeder) SeedNotes() error {
	// Check if notes already exist
	var count int64
	if err := s.db.Model(&models.Note{}).Count(&count).Error; err != nil {
		return err
	}
	
	if count > 0 {
		fmt.Println("Notes already exist, skipping notes seeding")
		return nil
	}
	
	// Get the first user from the database
	var testUser models.User
	if err := s.db.First(&testUser).Error; err != nil {
		return fmt.Errorf("no users found for seeding notes: %w", err)
	}
	testUserID := testUser.ID
	
	notes := []models.Note{
		{
			ID:       uuid.New(),
			UserID:   testUserID,
			Title:    "Project Planning Meeting",
			Content: models.JSONB{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "heading",
						"attrs": map[string]interface{}{"level": 1},
						"content": []interface{}{
							map[string]interface{}{"type": "text", "text": "Project Planning Meeting"},
						},
					},
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{"type": "text", "text": "Meeting with "},
							map[string]interface{}{
								"type": "mention",
								"attrs": map[string]interface{}{
									"type": "person",
									"id":   "660e8400-e29b-41d4-a716-446655440002",
									"name": "Sarah Johnson",
								},
							},
							map[string]interface{}{"type": "text", "text": " about the new features."},
						},
					},
				},
			},
			Category:   "Meeting",
			Tags:       []string{"planning", "project", "meeting"},
			FolderPath: "/meetings",
			IsPinned:   true,
		},
		{
			ID:       uuid.New(),
			UserID:   testUserID,
			Title:    "Development Notes",
			Content: models.JSONB{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "heading",
						"attrs": map[string]interface{}{"level": 1},
						"content": []interface{}{
							map[string]interface{}{"type": "text", "text": "Development Notes"},
						},
					},
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{"type": "text", "text": "Working on the database models with "},
							map[string]interface{}{
								"type": "mention",
								"attrs": map[string]interface{}{
									"type": "person",
									"id":   "660e8400-e29b-41d4-a716-446655440001",
									"name": "John Smith",
								},
							},
						},
					},
				},
			},
			Category:   "Note",
			Tags:       []string{"development", "database", "models"},
			FolderPath: "/development",
			IsFavorite: true,
		},
		{
			ID:       uuid.New(),
			UserID:   testUserID,
			Title:    "Design Review",
			Content: models.JSONB{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "heading",
						"attrs": map[string]interface{}{"level": 1},
						"content": []interface{}{
							map[string]interface{}{"type": "text", "text": "Design Review"},
						},
					},
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{"type": "text", "text": "Reviewed mockups from "},
							map[string]interface{}{
								"type": "mention",
								"attrs": map[string]interface{}{
									"type": "person",
									"id":   "660e8400-e29b-41d4-a716-446655440003",
									"name": "Mike Wilson",
								},
							},
						},
					},
				},
			},
			Category:   "Meeting",
			Tags:       []string{"design", "review", "ui"},
			FolderPath: "/design",
		},
	}
	
	for _, note := range notes {
		if err := s.db.Create(&note).Error; err != nil {
			return err
		}
	}
	
	fmt.Printf("Created %d test notes\n", len(notes))
	return nil
}

// SeedTodos creates test todos
func (s *Seeder) SeedTodos() error {
	// Check if todos already exist
	var count int64
	if err := s.db.Model(&models.Todo{}).Count(&count).Error; err != nil {
		return err
	}
	
	if count > 0 {
		fmt.Println("Todos already exist, skipping todos seeding")
		return nil
	}
	
	// Get notes and people from database
	var notes []models.Note
	if err := s.db.Limit(2).Find(&notes).Error; err != nil || len(notes) < 2 {
		return fmt.Errorf("need at least 2 notes for seeding todos")
	}
	
	var people []models.Person
	if err := s.db.Limit(2).Find(&people).Error; err != nil || len(people) < 2 {
		return fmt.Errorf("need at least 2 people for seeding todos")
	}
	
	noteID1 := notes[0].ID
	noteID2 := notes[1].ID
	personID1 := people[0].ID
	personID2 := people[1].ID
	
	tomorrow := time.Now().AddDate(0, 0, 1)
	nextWeek := time.Now().AddDate(0, 0, 7)
	
	todos := []models.Todo{
		{
			ID:               uuid.New(),
			NoteID:           noteID1,
			TodoID:           "t1",
			Text:             "Finalize project requirements",
			IsCompleted:      false,
			AssignedPersonID: &personID2,
			DueDate:          &tomorrow,
		},
		{
			ID:               uuid.New(),
			NoteID:           noteID1,
			TodoID:           "t2",
			Text:             "Schedule follow-up meeting",
			IsCompleted:      true,
			AssignedPersonID: &personID2,
		},
		{
			ID:               uuid.New(),
			NoteID:           noteID2,
			TodoID:           "t1",
			Text:             "Complete database migration system",
			IsCompleted:      false,
			AssignedPersonID: &personID1,
			DueDate:          &nextWeek,
		},
		{
			ID:      uuid.New(),
			NoteID:  noteID2,
			TodoID:  "t2",
			Text:    "Write unit tests for models",
			IsCompleted: false,
		},
	}
	
	for _, todo := range todos {
		if err := s.db.Create(&todo).Error; err != nil {
			return err
		}
	}
	
	fmt.Printf("Created %d test todos\n", len(todos))
	return nil
}

// SeedConnections creates test connections
func (s *Seeder) SeedConnections() error {
	// Check if connections already exist
	var count int64
	if err := s.db.Model(&models.Connection{}).Count(&count).Error; err != nil {
		return err
	}
	
	if count > 0 {
		fmt.Println("Connections already exist, skipping connections seeding")
		return nil
	}
	
	// Get user, notes, and people from database
	var testUser models.User
	if err := s.db.First(&testUser).Error; err != nil {
		return fmt.Errorf("no users found for seeding connections: %w", err)
	}
	testUserID := testUser.ID
	
	var notes []models.Note
	if err := s.db.Limit(3).Find(&notes).Error; err != nil || len(notes) < 3 {
		return fmt.Errorf("need at least 3 notes for seeding connections")
	}
	
	var people []models.Person
	if err := s.db.Limit(3).Find(&people).Error; err != nil || len(people) < 3 {
		return fmt.Errorf("need at least 3 people for seeding connections")
	}
	
	connections := []models.Connection{
		{
			ID:         uuid.New(),
			UserID:     testUserID,
			SourceID:   notes[0].ID,
			SourceType: "note",
			TargetID:   people[0].ID,
			TargetType: "person",
			Strength:   2,
		},
		{
			ID:         uuid.New(),
			UserID:     testUserID,
			SourceID:   notes[1].ID,
			SourceType: "note",
			TargetID:   people[1].ID,
			TargetType: "person",
			Strength:   3,
		},
		{
			ID:         uuid.New(),
			UserID:     testUserID,
			SourceID:   notes[2].ID,
			SourceType: "note",
			TargetID:   people[2].ID,
			TargetType: "person",
			Strength:   1,
		},
	}
	
	for _, connection := range connections {
		if err := s.db.Create(&connection).Error; err != nil {
			return err
		}
	}
	
	fmt.Printf("Created %d test connections\n", len(connections))
	return nil
}

// ClearAll removes all seeded data (useful for testing)
func (s *Seeder) ClearAll() error {
	fmt.Println("Clearing all seeded data...")
	
	// Delete in reverse order to handle foreign key constraints
	tables := []interface{}{
		&models.Connection{},
		&models.Todo{},
		&models.Note{},
		&models.Person{},
		&models.User{},
	}
	
	for _, table := range tables {
		if err := s.db.Unscoped().Where("1 = 1").Delete(table).Error; err != nil {
			return fmt.Errorf("failed to clear table %T: %w", table, err)
		}
	}
	
	fmt.Println("All seeded data cleared successfully!")
	return nil
}
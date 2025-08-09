package services

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"notesage-server/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TodoService handles todo parsing, scanning, and management
type TodoService struct {
	db *gorm.DB
}

// NewTodoService creates a new todo service
func NewTodoService(db *gorm.DB) *TodoService {
	return &TodoService{db: db}
}

// TodoParseResult represents a parsed todo from note content
type TodoParseResult struct {
	TodoID           string
	Text             string
	IsCompleted      bool
	AssignedPersonID *uuid.UUID
	DueDate          *time.Time
	LineNumber       int
}

// TodoScanResult represents the result of scanning a note for todos
type TodoScanResult struct {
	ParsedTodos []TodoParseResult
	Errors      []string
}

// Regular expression for parsing todo format: - [ ][t1] text @person date
var todoRegex = regexp.MustCompile(`^-\s*\[([x\s])\]\[([t]\d+)\]\s*(.+?)(?:\s+@([a-zA-Z0-9\-_@.]+))?(?:\s+(\d{4}-\d{2}-\d{2}))?$`)

// ParseTodoLine parses a single line for todo format
func (s *TodoService) ParseTodoLine(line string, lineNumber int) (*TodoParseResult, error) {
	line = strings.TrimSpace(line)
	
	matches := todoRegex.FindStringSubmatch(line)
	if matches == nil {
		return nil, fmt.Errorf("line does not match todo format")
	}
	
	result := &TodoParseResult{
		TodoID:     matches[2],
		Text:       strings.TrimSpace(matches[3]),
		IsCompleted: matches[1] == "x",
		LineNumber: lineNumber,
	}
	
	// Parse assigned person if present
	if matches[4] != "" {
		personID, err := s.findPersonByIdentifier(matches[4])
		if err == nil && personID != uuid.Nil {
			result.AssignedPersonID = &personID
		}
	}
	
	// Parse due date if present
	if matches[5] != "" {
		if dueDate, err := time.Parse("2006-01-02", matches[5]); err == nil {
			result.DueDate = &dueDate
		}
	}
	
	return result, nil
}

// ScanNoteForTodos scans note content for todos in the structured format
func (s *TodoService) ScanNoteForTodos(noteContent models.JSONB) TodoScanResult {
	result := TodoScanResult{
		ParsedTodos: []TodoParseResult{},
		Errors:      []string{},
	}
	
	// Extract text content from structured JSON
	textContent := s.extractTextFromContent(noteContent)
	lines := strings.Split(textContent, "\n")
	
	for i, line := range lines {
		if parsed, err := s.ParseTodoLine(line, i+1); err == nil {
			result.ParsedTodos = append(result.ParsedTodos, *parsed)
		}
	}
	
	return result
}

// SyncNoteTodos synchronizes todos for a specific note
func (s *TodoService) SyncNoteTodos(noteID uuid.UUID, userID uuid.UUID) error {
	// Get the note
	var note models.Note
	if err := s.db.Where("id = ? AND user_id = ?", noteID, userID).First(&note).Error; err != nil {
		return fmt.Errorf("note not found: %w", err)
	}
	
	// Scan note content for todos
	scanResult := s.ScanNoteForTodos(note.Content)
	
	// Get existing todos for this note
	var existingTodos []models.Todo
	if err := s.db.Where("note_id = ?", noteID).Find(&existingTodos).Error; err != nil {
		return fmt.Errorf("failed to fetch existing todos: %w", err)
	}
	
	// Create map of existing todos by todo_id
	existingTodoMap := make(map[string]*models.Todo)
	for i := range existingTodos {
		existingTodoMap[existingTodos[i].TodoID] = &existingTodos[i]
	}
	
	// Track which todos we've seen in the scan
	seenTodoIDs := make(map[string]bool)
	
	// Process parsed todos
	for _, parsed := range scanResult.ParsedTodos {
		seenTodoIDs[parsed.TodoID] = true
		
		if existingTodo, exists := existingTodoMap[parsed.TodoID]; exists {
			// Update existing todo
			existingTodo.Text = parsed.Text
			existingTodo.IsCompleted = parsed.IsCompleted
			existingTodo.AssignedPersonID = parsed.AssignedPersonID
			existingTodo.DueDate = parsed.DueDate
			
			if err := s.db.Save(existingTodo).Error; err != nil {
				return fmt.Errorf("failed to update todo %s: %w", parsed.TodoID, err)
			}
		} else {
			// Create new todo
			newTodo := models.Todo{
				NoteID:           noteID,
				TodoID:           parsed.TodoID,
				Text:             parsed.Text,
				IsCompleted:      parsed.IsCompleted,
				AssignedPersonID: parsed.AssignedPersonID,
				DueDate:          parsed.DueDate,
			}
			
			if err := s.db.Create(&newTodo).Error; err != nil {
				return fmt.Errorf("failed to create todo %s: %w", parsed.TodoID, err)
			}
		}
	}
	
	// Remove todos that are no longer in the note content
	for todoID, existingTodo := range existingTodoMap {
		if !seenTodoIDs[todoID] {
			if err := s.db.Delete(existingTodo).Error; err != nil {
				return fmt.Errorf("failed to delete todo %s: %w", todoID, err)
			}
		}
	}
	
	return nil
}

// GenerateNextTodoID generates the next available todo ID for a note
func (s *TodoService) GenerateNextTodoID(noteID uuid.UUID) (string, error) {
	var todos []models.Todo
	if err := s.db.Where("note_id = ?", noteID).Find(&todos).Error; err != nil {
		return "", fmt.Errorf("failed to fetch existing todos: %w", err)
	}
	
	maxID := 0
	for _, todo := range todos {
		if strings.HasPrefix(todo.TodoID, "t") {
			if id, err := strconv.Atoi(todo.TodoID[1:]); err == nil && id > maxID {
				maxID = id
			}
		}
	}
	
	return fmt.Sprintf("t%d", maxID+1), nil
}

// GetTodosWithFilters retrieves todos with various filtering options
func (s *TodoService) GetTodosWithFilters(userID uuid.UUID, filters TodoFilters) ([]models.Todo, error) {
	query := s.db.Joins("JOIN notes ON todos.note_id = notes.id").
		Where("notes.user_id = ?", userID).
		Preload("Note").
		Preload("AssignedPerson")
	
	// Apply filters
	if filters.NoteID != nil {
		query = query.Where("todos.note_id = ?", *filters.NoteID)
	}
	
	if filters.IsCompleted != nil {
		query = query.Where("todos.is_completed = ?", *filters.IsCompleted)
	}
	
	if filters.AssignedPersonID != nil {
		query = query.Where("todos.assigned_person_id = ?", *filters.AssignedPersonID)
	}
	
	if filters.DueDateStart != nil {
		query = query.Where("todos.due_date >= ?", *filters.DueDateStart)
	}
	
	if filters.DueDateEnd != nil {
		query = query.Where("todos.due_date <= ?", *filters.DueDateEnd)
	}
	
	if filters.HasDueDate != nil {
		if *filters.HasDueDate {
			query = query.Where("todos.due_date IS NOT NULL")
		} else {
			query = query.Where("todos.due_date IS NULL")
		}
	}
	
	if filters.Search != "" {
		// Use LIKE for SQLite compatibility, ILIKE for PostgreSQL
		if s.db.Dialector.Name() == "postgres" {
			query = query.Where("todos.text ILIKE ?", "%"+filters.Search+"%")
		} else {
			query = query.Where("todos.text LIKE ?", "%"+filters.Search+"%")
		}
	}
	
	var todos []models.Todo
	if err := query.Order("todos.created_at DESC").Find(&todos).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch todos: %w", err)
	}
	
	return todos, nil
}

// GetCalendarTodos retrieves todos for calendar view within a date range
func (s *TodoService) GetCalendarTodos(userID uuid.UUID, startDate, endDate time.Time) ([]models.Todo, error) {
	var todos []models.Todo
	
	if err := s.db.Joins("JOIN notes ON todos.note_id = notes.id").
		Where("notes.user_id = ? AND todos.due_date BETWEEN ? AND ?", userID, startDate, endDate).
		Preload("Note").
		Preload("AssignedPerson").
		Order("todos.due_date ASC").
		Find(&todos).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch calendar todos: %w", err)
	}
	
	return todos, nil
}

// TodoFilters represents filtering options for todos
type TodoFilters struct {
	NoteID           *uuid.UUID
	IsCompleted      *bool
	AssignedPersonID *uuid.UUID
	DueDateStart     *time.Time
	DueDateEnd       *time.Time
	HasDueDate       *bool
	Search           string
}

// Helper function to find person by identifier (name, email, or username)
func (s *TodoService) findPersonByIdentifier(identifier string) (uuid.UUID, error) {
	var person models.Person
	
	// Try to find by exact name match, partial name match, or email
	if err := s.db.Where("LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?) OR LOWER(email) = LOWER(?)", 
		identifier, "%"+identifier+"%", identifier).
		First(&person).Error; err != nil {
		return uuid.Nil, err
	}
	
	return person.ID, nil
}

// Helper function to extract text content from structured JSON
func (s *TodoService) extractTextFromContent(content models.JSONB) string {
	var textParts []string
	
	if contentArray, ok := content["content"].([]interface{}); ok {
		for _, item := range contentArray {
			if itemMap, ok := item.(map[string]interface{}); ok {
				text := s.extractTextFromNode(itemMap)
				if text != "" {
					textParts = append(textParts, text)
				}
			}
		}
	}
	
	return strings.Join(textParts, "\n")
}

// Helper function to extract text from a content node recursively
func (s *TodoService) extractTextFromNode(node map[string]interface{}) string {
	var textParts []string
	
	// If this is a text node, return its text
	if nodeType, ok := node["type"].(string); ok && nodeType == "text" {
		if text, ok := node["text"].(string); ok {
			return text
		}
	}
	
	// If this node has content, recursively extract text
	if content, ok := node["content"].([]interface{}); ok {
		for _, item := range content {
			if itemMap, ok := item.(map[string]interface{}); ok {
				text := s.extractTextFromNode(itemMap)
				if text != "" {
					textParts = append(textParts, text)
				}
			}
		}
	}
	
	return strings.Join(textParts, " ")
}
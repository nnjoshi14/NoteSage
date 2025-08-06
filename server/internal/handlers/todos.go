package handlers

import (
	"net/http"
	"strconv"
	"time"

	"notesage-server/internal/models"
	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TodoHandler struct {
	db          *gorm.DB
	todoService *services.TodoService
}

func NewTodoHandler(db *gorm.DB) *TodoHandler {
	return &TodoHandler{
		db:          db,
		todoService: services.NewTodoService(db),
	}
}

type CreateTodoRequest struct {
	NoteID           string `json:"note_id" binding:"required"`
	TodoID           string `json:"todo_id"`
	Text             string `json:"text" binding:"required"`
	AssignedPersonID string `json:"assigned_person_id"`
	DueDate          string `json:"due_date"`
}

type UpdateTodoRequest struct {
	Text             *string `json:"text"`
	IsCompleted      *bool   `json:"is_completed"`
	AssignedPersonID *string `json:"assigned_person_id"`
	DueDate          *string `json:"due_date"`
}

type SyncNoteTodosRequest struct {
	NoteID string `json:"note_id" binding:"required"`
}

func (h *TodoHandler) GetTodos(c *gin.Context) {
	userID, _ := c.Get("userID")
	
	// Build filters from query parameters
	filters := services.TodoFilters{}
	
	if noteID := c.Query("note_id"); noteID != "" {
		if id, err := uuid.Parse(noteID); err == nil {
			filters.NoteID = &id
		}
	}
	
	if completed := c.Query("completed"); completed != "" {
		if isCompleted, err := strconv.ParseBool(completed); err == nil {
			filters.IsCompleted = &isCompleted
		}
	}
	
	if personID := c.Query("assigned_person_id"); personID != "" {
		if id, err := uuid.Parse(personID); err == nil {
			filters.AssignedPersonID = &id
		}
	}
	
	if dueDateStart := c.Query("due_date_start"); dueDateStart != "" {
		if date, err := time.Parse("2006-01-02", dueDateStart); err == nil {
			filters.DueDateStart = &date
		}
	}
	
	if dueDateEnd := c.Query("due_date_end"); dueDateEnd != "" {
		if date, err := time.Parse("2006-01-02", dueDateEnd); err == nil {
			filters.DueDateEnd = &date
		}
	}
	
	if hasDueDate := c.Query("has_due_date"); hasDueDate != "" {
		if hasDate, err := strconv.ParseBool(hasDueDate); err == nil {
			filters.HasDueDate = &hasDate
		}
	}
	
	filters.Search = c.Query("search")
	
	todos, err := h.todoService.GetTodosWithFilters(userID.(uuid.UUID), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todos"})
		return
	}
	
	c.JSON(http.StatusOK, todos)
}

func (h *TodoHandler) CreateTodo(c *gin.Context) {
	userID, _ := c.Get("userID")
	
	var req CreateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Verify note belongs to user
	var note models.Note
	if err := h.db.Where("id = ? AND user_id = ?", req.NoteID, userID).First(&note).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}
	
	noteID := uuid.MustParse(req.NoteID)
	
	// Generate todo ID if not provided
	todoID := req.TodoID
	if todoID == "" {
		var err error
		todoID, err = h.todoService.GenerateNextTodoID(noteID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate todo ID"})
			return
		}
	}
	
	todo := models.Todo{
		NoteID: noteID,
		TodoID: todoID,
		Text:   req.Text,
	}
	
	if req.AssignedPersonID != "" {
		personID := uuid.MustParse(req.AssignedPersonID)
		todo.AssignedPersonID = &personID
	}
	
	if req.DueDate != "" {
		if dueDate, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			todo.DueDate = &dueDate
		}
	}
	
	if err := h.db.Create(&todo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create todo"})
		return
	}
	
	// Load relationships
	h.db.Preload("Note").Preload("AssignedPerson").First(&todo, todo.ID)
	
	c.JSON(http.StatusCreated, todo)
}

func (h *TodoHandler) GetTodo(c *gin.Context) {
	userID, _ := c.Get("userID")
	todoID := c.Param("id")
	
	var todo models.Todo
	if err := h.db.Joins("JOIN notes ON todos.note_id = notes.id").
		Where("todos.id = ? AND notes.user_id = ?", todoID, userID).
		Preload("Note").
		Preload("AssignedPerson").
		First(&todo).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todo"})
		}
		return
	}
	
	c.JSON(http.StatusOK, todo)
}

func (h *TodoHandler) UpdateTodo(c *gin.Context) {
	userID, _ := c.Get("userID")
	todoID := c.Param("id")
	
	var req UpdateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	var todo models.Todo
	if err := h.db.Joins("JOIN notes ON todos.note_id = notes.id").
		Where("todos.id = ? AND notes.user_id = ?", todoID, userID).
		First(&todo).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todo"})
		}
		return
	}
	
	// Update fields if provided
	if req.Text != nil {
		todo.Text = *req.Text
	}
	if req.IsCompleted != nil {
		todo.IsCompleted = *req.IsCompleted
	}
	if req.AssignedPersonID != nil {
		if *req.AssignedPersonID == "" {
			todo.AssignedPersonID = nil
		} else {
			personID := uuid.MustParse(*req.AssignedPersonID)
			todo.AssignedPersonID = &personID
		}
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			todo.DueDate = nil
		} else {
			if dueDate, err := time.Parse("2006-01-02", *req.DueDate); err == nil {
				todo.DueDate = &dueDate
			}
		}
	}
	
	if err := h.db.Save(&todo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update todo"})
		return
	}
	
	// Load relationships
	h.db.Preload("Note").Preload("AssignedPerson").First(&todo, todo.ID)
	
	c.JSON(http.StatusOK, todo)
}

func (h *TodoHandler) DeleteTodo(c *gin.Context) {
	userID, _ := c.Get("userID")
	todoID := c.Param("id")
	
	result := h.db.Joins("JOIN notes ON todos.note_id = notes.id").
		Where("todos.id = ? AND notes.user_id = ?", todoID, userID).
		Delete(&models.Todo{})
	
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete todo"})
		return
	}
	
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Todo deleted successfully"})
}

// SyncNoteTodos scans a note for todos and synchronizes them with the database
func (h *TodoHandler) SyncNoteTodos(c *gin.Context) {
	userID, _ := c.Get("userID")
	
	var req SyncNoteTodosRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	noteID, err := uuid.Parse(req.NoteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}
	
	if err := h.todoService.SyncNoteTodos(noteID, userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync todos"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Todos synchronized successfully"})
}

// GetCalendarTodos retrieves todos for calendar view within a date range
func (h *TodoHandler) GetCalendarTodos(c *gin.Context) {
	userID, _ := c.Get("userID")
	
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	
	if startDateStr == "" || endDateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}
	
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format, use YYYY-MM-DD"})
		return
	}
	
	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format, use YYYY-MM-DD"})
		return
	}
	
	todos, err := h.todoService.GetCalendarTodos(userID.(uuid.UUID), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch calendar todos"})
		return
	}
	
	c.JSON(http.StatusOK, todos)
}

// GetTodosByNote retrieves all todos for a specific note
func (h *TodoHandler) GetTodosByNote(c *gin.Context) {
	userID, _ := c.Get("userID")
	noteID := c.Param("note_id")
	
	noteUUID, err := uuid.Parse(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}
	
	// Verify note belongs to user
	var note models.Note
	if err := h.db.Where("id = ? AND user_id = ?", noteUUID, userID).First(&note).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}
	
	filters := services.TodoFilters{
		NoteID: &noteUUID,
	}
	
	todos, err := h.todoService.GetTodosWithFilters(userID.(uuid.UUID), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todos"})
		return
	}
	
	c.JSON(http.StatusOK, todos)
}

// UpdateTodoByCompositeKey updates a todo using note_id and todo_id composite key
func (h *TodoHandler) UpdateTodoByCompositeKey(c *gin.Context) {
	userID, _ := c.Get("userID")
	noteID := c.Param("note_id")
	todoID := c.Param("todo_id")
	
	var req UpdateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	noteUUID, err := uuid.Parse(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}
	
	var todo models.Todo
	if err := h.db.Joins("JOIN notes ON todos.note_id = notes.id").
		Where("todos.note_id = ? AND todos.todo_id = ? AND notes.user_id = ?", noteUUID, todoID, userID).
		First(&todo).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todo"})
		}
		return
	}
	
	// Update fields if provided
	if req.Text != nil {
		todo.Text = *req.Text
	}
	if req.IsCompleted != nil {
		todo.IsCompleted = *req.IsCompleted
	}
	if req.AssignedPersonID != nil {
		if *req.AssignedPersonID == "" {
			todo.AssignedPersonID = nil
		} else {
			personID := uuid.MustParse(*req.AssignedPersonID)
			todo.AssignedPersonID = &personID
		}
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			todo.DueDate = nil
		} else {
			if dueDate, err := time.Parse("2006-01-02", *req.DueDate); err == nil {
				todo.DueDate = &dueDate
			}
		}
	}
	
	if err := h.db.Save(&todo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update todo"})
		return
	}
	
	// Load relationships
	h.db.Preload("Note").Preload("AssignedPerson").First(&todo, todo.ID)
	
	c.JSON(http.StatusOK, todo)
}
package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PersonHandler struct {
	db *gorm.DB
}

func NewPersonHandler(db *gorm.DB) *PersonHandler {
	return &PersonHandler{db: db}
}

type CreatePersonRequest struct {
	Name        string `json:"name" binding:"required"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Company     string `json:"company"`
	Title       string `json:"title"`
	LinkedinURL string `json:"linkedin_url"`
	AvatarURL   string `json:"avatar_url"`
	Notes       string `json:"notes"`
}

type UpdatePersonRequest struct {
	Name        *string `json:"name"`
	Email       *string `json:"email"`
	Phone       *string `json:"phone"`
	Company     *string `json:"company"`
	Title       *string `json:"title"`
	LinkedinURL *string `json:"linkedin_url"`
	AvatarURL   *string `json:"avatar_url"`
	Notes       *string `json:"notes"`
}

func (h *PersonHandler) GetPeople(c *gin.Context) {
	userID, _ := c.Get("userID")
	
	// Parse query parameters for search and filtering
	search := c.Query("search")
	company := c.Query("company")
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")
	
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)
	
	query := h.db.Where("user_id = ?", userID)
	
	// Apply search filter
	if search != "" {
		searchTerm := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(company) LIKE ?", 
			searchTerm, searchTerm, searchTerm)
	}
	
	// Apply company filter
	if company != "" {
		query = query.Where("LOWER(company) = ?", strings.ToLower(company))
	}
	
	var people []models.Person
	if err := query.Order("name ASC").Limit(limit).Offset(offset).Find(&people).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch people"})
		return
	}
	
	c.JSON(http.StatusOK, people)
}

func (h *PersonHandler) CreatePerson(c *gin.Context) {
	userID, _ := c.Get("userID")
	
	var req CreatePersonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	person := models.Person{
		UserID:      uuid.MustParse(userID.(string)),
		Name:        req.Name,
		Email:       req.Email,
		Phone:       req.Phone,
		Company:     req.Company,
		Title:       req.Title,
		LinkedinURL: req.LinkedinURL,
		AvatarURL:   req.AvatarURL,
		Notes:       req.Notes,
	}
	
	if err := h.db.Create(&person).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create person"})
		return
	}
	
	c.JSON(http.StatusCreated, person)
}

func (h *PersonHandler) GetPerson(c *gin.Context) {
	userID, _ := c.Get("userID")
	personID := c.Param("id")
	
	var person models.Person
	if err := h.db.Where("id = ? AND user_id = ?", personID, userID).First(&person).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Person not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch person"})
		}
		return
	}
	
	c.JSON(http.StatusOK, person)
}

func (h *PersonHandler) UpdatePerson(c *gin.Context) {
	userID, _ := c.Get("userID")
	personID := c.Param("id")
	
	var req UpdatePersonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	var person models.Person
	if err := h.db.Where("id = ? AND user_id = ?", personID, userID).First(&person).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Person not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch person"})
		}
		return
	}
	
	// Update fields if provided
	if req.Name != nil {
		person.Name = *req.Name
	}
	if req.Email != nil {
		person.Email = *req.Email
	}
	if req.Phone != nil {
		person.Phone = *req.Phone
	}
	if req.Company != nil {
		person.Company = *req.Company
	}
	if req.Title != nil {
		person.Title = *req.Title
	}
	if req.LinkedinURL != nil {
		person.LinkedinURL = *req.LinkedinURL
	}
	if req.AvatarURL != nil {
		person.AvatarURL = *req.AvatarURL
	}
	if req.Notes != nil {
		person.Notes = *req.Notes
	}
	
	if err := h.db.Save(&person).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update person"})
		return
	}
	
	c.JSON(http.StatusOK, person)
}

func (h *PersonHandler) DeletePerson(c *gin.Context) {
	userID, _ := c.Get("userID")
	personID := c.Param("id")
	
	result := h.db.Where("id = ? AND user_id = ?", personID, userID).Delete(&models.Person{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete person"})
		return
	}
	
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Person not found"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Person deleted successfully"})
}

// PersonConnection represents a connection between a person and notes
type PersonConnection struct {
	NoteID      uuid.UUID `json:"note_id"`
	NoteTitle   string    `json:"note_title"`
	UpdatedAt   string    `json:"updated_at"`
	Connections int       `json:"connections"`
}

// PersonConnectionsResponse represents the response for person connections
type PersonConnectionsResponse struct {
	Person      models.Person       `json:"person"`
	Notes       []PersonConnection  `json:"notes"`
	TotalNotes  int                 `json:"total_notes"`
	TotalTodos  int                 `json:"total_todos"`
}

func (h *PersonHandler) GetPersonConnections(c *gin.Context) {
	userID, _ := c.Get("userID")
	personID := c.Param("id")
	
	// First, verify the person exists and belongs to the user
	var person models.Person
	if err := h.db.Where("id = ? AND user_id = ?", personID, userID).First(&person).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Person not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch person"})
		}
		return
	}
	
	// Get notes connected to this person through connections table
	var connections []struct {
		NoteID      uuid.UUID `json:"note_id"`
		NoteTitle   string    `json:"note_title"`
		UpdatedAt   string    `json:"updated_at"`
		Connections int       `json:"connections"`
	}
	
	err := h.db.Table("connections").
		Select("notes.id as note_id, notes.title as note_title, notes.updated_at, COUNT(*) as connections").
		Joins("JOIN notes ON connections.source_id = notes.id OR connections.target_id = notes.id").
		Where("connections.user_id = ? AND ((connections.source_id = ? AND connections.source_type = 'person') OR (connections.target_id = ? AND connections.target_type = 'person'))", 
			userID, personID, personID).
		Where("notes.user_id = ?", userID).
		Group("notes.id, notes.title, notes.updated_at").
		Order("notes.updated_at DESC").
		Find(&connections).Error
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch person connections"})
		return
	}
	
	// Convert to PersonConnection slice
	var noteConnections []PersonConnection
	for _, conn := range connections {
		noteConnections = append(noteConnections, PersonConnection{
			NoteID:      conn.NoteID,
			NoteTitle:   conn.NoteTitle,
			UpdatedAt:   conn.UpdatedAt,
			Connections: conn.Connections,
		})
	}
	
	// Get total todos assigned to this person
	var totalTodos int64
	h.db.Model(&models.Todo{}).
		Joins("JOIN notes ON todos.note_id = notes.id").
		Where("todos.assigned_person_id = ? AND notes.user_id = ?", personID, userID).
		Count(&totalTodos)
	
	response := PersonConnectionsResponse{
		Person:     person,
		Notes:      noteConnections,
		TotalNotes: len(noteConnections),
		TotalTodos: int(totalTodos),
	}
	
	c.JSON(http.StatusOK, response)
}

func (h *PersonHandler) SearchPeople(c *gin.Context) {
	userID, _ := c.Get("userID")
	query := c.Query("q")
	
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}
	
	searchTerm := "%" + strings.ToLower(query) + "%"
	
	var people []models.Person
	err := h.db.Where("user_id = ? AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(company) LIKE ?)", 
		userID, searchTerm, searchTerm, searchTerm).
		Order("name ASC").
		Limit(20).
		Find(&people).Error
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search people"})
		return
	}
	
	c.JSON(http.StatusOK, people)
}

// CreatePersonConnection creates a connection between a person and a note
func (h *PersonHandler) CreatePersonConnection(c *gin.Context) {
	userID, _ := c.Get("userID")
	personID := c.Param("id")
	
	var req struct {
		NoteID string `json:"note_id" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Verify person exists and belongs to user
	var person models.Person
	if err := h.db.Where("id = ? AND user_id = ?", personID, userID).First(&person).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Person not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch person"})
		}
		return
	}
	
	// Verify note exists and belongs to user
	var note models.Note
	if err := h.db.Where("id = ? AND user_id = ?", req.NoteID, userID).First(&note).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch note"})
		}
		return
	}
	
	// Check if connection already exists
	var existingConnection models.Connection
	err := h.db.Where("user_id = ? AND ((source_id = ? AND source_type = 'person' AND target_id = ? AND target_type = 'note') OR (source_id = ? AND source_type = 'note' AND target_id = ? AND target_type = 'person'))", 
		userID, personID, req.NoteID, req.NoteID, personID).First(&existingConnection).Error
	
	if err == nil {
		// Connection already exists, increment strength
		existingConnection.Strength++
		if err := h.db.Save(&existingConnection).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update connection"})
			return
		}
		c.JSON(http.StatusOK, existingConnection)
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing connection"})
		return
	}
	
	// Create new connection
	connection := models.Connection{
		UserID:     uuid.MustParse(userID.(string)),
		SourceID:   uuid.MustParse(personID),
		SourceType: "person",
		TargetID:   uuid.MustParse(req.NoteID),
		TargetType: "note",
		Strength:   1,
	}
	
	if err := h.db.Create(&connection).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create connection"})
		return
	}
	
	c.JSON(http.StatusCreated, connection)
}
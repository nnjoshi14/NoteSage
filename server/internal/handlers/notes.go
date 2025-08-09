package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"notesage-server/internal/models"
	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type NoteHandler struct {
	db                *gorm.DB
	connectionService *services.ConnectionService
}

func NewNoteHandler(db *gorm.DB) *NoteHandler {
	return &NoteHandler{
		db:                db,
		connectionService: services.NewConnectionService(db),
	}
}

type CreateNoteRequest struct {
	Title      string       `json:"title" binding:"required"`
	Content    models.JSONB `json:"content"`
	Category   string       `json:"category"`
	Tags       []string     `json:"tags"`
	FolderPath string       `json:"folder_path"`
}

type UpdateNoteRequest struct {
	Title         *string       `json:"title"`
	Content       *models.JSONB `json:"content"`
	Category      *string       `json:"category"`
	Tags          []string      `json:"tags"`
	FolderPath    *string       `json:"folder_path"`
	ScheduledDate *time.Time    `json:"scheduled_date"`
	IsArchived    *bool         `json:"is_archived"`
	IsPinned      *bool         `json:"is_pinned"`
	IsFavorite    *bool         `json:"is_favorite"`
}

type SearchNotesRequest struct {
	Query      string     `json:"query" form:"q"`
	Categories []string   `json:"categories" form:"categories"`
	Tags       []string   `json:"tags" form:"tags"`
	FolderPath string     `json:"folder_path" form:"folder_path"`
	IsArchived *bool      `json:"is_archived" form:"is_archived"`
	IsPinned   *bool      `json:"is_pinned" form:"is_pinned"`
	IsFavorite *bool      `json:"is_favorite" form:"is_favorite"`
	DateFrom   *time.Time `json:"date_from" form:"date_from"`
	DateTo     *time.Time `json:"date_to" form:"date_to"`
	Limit      int        `json:"limit" form:"limit"`
	Offset     int        `json:"offset" form:"offset"`
}

type NotesResponse struct {
	Notes  []models.Note `json:"notes"`
	Total  int64         `json:"total"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
}

// sanitizeContent removes potentially dangerous HTML tags and attributes from text fields
func sanitizeContent(content models.JSONB) models.JSONB {
	if content == nil {
		return content
	}

	// Convert to map for processing
	var contentMap map[string]interface{}
	contentBytes, err := json.Marshal(content)
	if err != nil {
		return content
	}

	err = json.Unmarshal(contentBytes, &contentMap)
	if err != nil {
		return content
	}

	// Recursively sanitize the content
	sanitizedMap := sanitizeMap(contentMap)

	// Convert back to JSONB
	sanitizedBytes, err := json.Marshal(sanitizedMap)
	if err != nil {
		return content
	}

	var sanitizedContent models.JSONB
	err = json.Unmarshal(sanitizedBytes, &sanitizedContent)
	if err != nil {
		return content
	}

	return sanitizedContent
}

// sanitizeMap recursively sanitizes text fields in a map
func sanitizeMap(m map[string]interface{}) map[string]interface{} {
	sanitized := make(map[string]interface{})

	for key, value := range m {
		switch v := value.(type) {
		case string:
			// Sanitize text fields
			if key == "text" {
				sanitized[key] = sanitizeText(v)
			} else {
				sanitized[key] = v
			}
		case map[string]interface{}:
			// Recursively sanitize nested maps
			sanitized[key] = sanitizeMap(v)
		case []interface{}:
			// Recursively sanitize arrays
			sanitized[key] = sanitizeArray(v)
		default:
			sanitized[key] = v
		}
	}

	return sanitized
}

// sanitizeArray recursively sanitizes arrays
func sanitizeArray(arr []interface{}) []interface{} {
	sanitized := make([]interface{}, len(arr))

	for i, value := range arr {
		switch v := value.(type) {
		case string:
			sanitized[i] = v
		case map[string]interface{}:
			sanitized[i] = sanitizeMap(v)
		case []interface{}:
			sanitized[i] = sanitizeArray(v)
		default:
			sanitized[i] = v
		}
	}

	return sanitized
}

// sanitizeText removes script tags and other dangerous HTML
func sanitizeText(text string) string {
	// Remove script tags and their content
	scriptRegex := regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
	text = scriptRegex.ReplaceAllString(text, "")

	// Remove other potentially dangerous tags
	dangerousTags := []string{"iframe", "object", "embed", "form", "input", "button", "select", "textarea"}
	for _, tag := range dangerousTags {
		regex := regexp.MustCompile(`(?i)<` + tag + `[^>]*>.*?</` + tag + `>`)
		text = regex.ReplaceAllString(text, "")
	}

	// Remove dangerous attributes
	dangerousAttrs := []string{"onclick", "onload", "onerror", "onmouseover", "onfocus", "onblur"}
	for _, attr := range dangerousAttrs {
		regex := regexp.MustCompile(`(?i)\s+` + attr + `\s*=\s*["'][^"']*["']`)
		text = regex.ReplaceAllString(text, "")
	}

	return text
}

func (h *NoteHandler) GetNotes(c *gin.Context) {
	userID, _ := c.Get("userID")

	// Parse query parameters
	var req SearchNotesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default pagination
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 50
	}
	if req.Offset < 0 {
		req.Offset = 0
	}

	var notes []models.Note
	var total int64

	query := h.db.Model(&models.Note{}).Where("user_id = ?", userID)

	// Exclude archived notes by default unless explicitly requested
	if req.IsArchived == nil {
		query = query.Where("is_archived = ?", false)
	}

	// Apply filters
	if req.Query != "" {
		// Full-text search on title and content
		searchQuery := "%" + strings.ToLower(req.Query) + "%"
		query = query.Where("LOWER(title) LIKE ? OR LOWER(content::text) LIKE ?", searchQuery, searchQuery)
	}

	if len(req.Categories) > 0 {
		query = query.Where("category IN ?", req.Categories)
	}

	if len(req.Tags) > 0 {
		// Search for notes that contain any of the specified tags
		// Build OR conditions for each tag
		tagConditions := make([]string, len(req.Tags))
		tagArgs := make([]interface{}, len(req.Tags))
		for i, tag := range req.Tags {
			tagConditions[i] = "tags LIKE ?"
			tagArgs[i] = "%\"" + tag + "\"%"
		}
		if len(tagConditions) > 0 {
			query = query.Where("("+strings.Join(tagConditions, " OR ")+")", tagArgs...)
		}
	}

	if req.FolderPath != "" {
		query = query.Where("folder_path LIKE ?", req.FolderPath+"%")
	}

	if req.IsArchived != nil {
		query = query.Where("is_archived = ?", *req.IsArchived)
	}

	if req.IsPinned != nil {
		query = query.Where("is_pinned = ?", *req.IsPinned)
	}

	if req.IsFavorite != nil {
		query = query.Where("is_favorite = ?", *req.IsFavorite)
	}

	if req.DateFrom != nil {
		query = query.Where("created_at >= ?", *req.DateFrom)
	}

	if req.DateTo != nil {
		query = query.Where("created_at <= ?", *req.DateTo)
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count notes"})
		return
	}

	// Get paginated results
	if err := query.Order("is_pinned DESC, updated_at DESC").
		Limit(req.Limit).
		Offset(req.Offset).
		Find(&notes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
	}

	response := NotesResponse{
		Notes:  notes,
		Total:  total,
		Limit:  req.Limit,
		Offset: req.Offset,
	}

	c.JSON(http.StatusOK, response)
}

func (h *NoteHandler) CreateNote(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req CreateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Sanitize content to prevent XSS
	if req.Content != nil {
		req.Content = sanitizeContent(req.Content)
	}

	note := models.Note{
		UserID:     uuid.MustParse(userID.(string)),
		Title:      req.Title,
		Content:    req.Content,
		Category:   req.Category,
		Tags:       pq.StringArray(req.Tags),
		FolderPath: req.FolderPath,
	}

	if req.Category == "" {
		note.Category = "Note"
	}
	if req.FolderPath == "" {
		note.FolderPath = "/"
	}

	if err := note.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Create(&note).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create note"})
		return
	}

	// Detect and update connections for the new note
	if note.Content != nil {
		connections, err := h.connectionService.DetectConnections(note.UserID, note.ID, note.Content)
		if err == nil {
			// Update connections in background - don't fail the request if this fails
			go func() {
				h.connectionService.UpdateConnections(note.UserID, note.ID, connections)
			}()
		}
	}

	c.JSON(http.StatusCreated, note)
}

func (h *NoteHandler) GetNote(c *gin.Context) {
	userID, _ := c.Get("userID")
	noteID := c.Param("id")

	var note models.Note
	if err := h.db.Where("id = ? AND user_id = ?", noteID, userID).First(&note).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch note"})
		}
		return
	}

	c.JSON(http.StatusOK, note)
}

func (h *NoteHandler) UpdateNote(c *gin.Context) {
	userID, _ := c.Get("userID")
	noteID := c.Param("id")

	var req UpdateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var note models.Note
	if err := h.db.Where("id = ? AND user_id = ?", noteID, userID).First(&note).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch note"})
		}
		return
	}

	// Update fields if provided
	if req.Title != nil {
		note.Title = *req.Title
	}
	if req.Content != nil {
		// Sanitize content to prevent XSS
		sanitizedContent := sanitizeContent(*req.Content)
		note.Content = sanitizedContent
	}
	if req.Category != nil {
		note.Category = *req.Category
	}
	if req.Tags != nil {
		note.Tags = pq.StringArray(req.Tags)
	}
	if req.FolderPath != nil {
		note.FolderPath = *req.FolderPath
	}
	if req.ScheduledDate != nil {
		note.ScheduledDate = req.ScheduledDate
	}
	if req.IsArchived != nil {
		note.IsArchived = *req.IsArchived
	}
	if req.IsPinned != nil {
		note.IsPinned = *req.IsPinned
	}
	if req.IsFavorite != nil {
		note.IsFavorite = *req.IsFavorite
	}

	note.Version++

	if err := note.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Save(&note).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update note"})
		return
	}

	// Detect and update connections for the updated note
	if note.Content != nil {
		connections, err := h.connectionService.DetectConnections(note.UserID, note.ID, note.Content)
		if err == nil {
			// Update connections in background - don't fail the request if this fails
			go func() {
				h.connectionService.UpdateConnections(note.UserID, note.ID, connections)
			}()
		}
	}

	c.JSON(http.StatusOK, note)
}

func (h *NoteHandler) DeleteNote(c *gin.Context) {
	userID, _ := c.Get("userID")
	noteID := c.Param("id")

	result := h.db.Where("id = ? AND user_id = ?", noteID, userID).Delete(&models.Note{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete note"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note deleted successfully"})
}

// SearchNotes provides advanced search functionality
func (h *NoteHandler) SearchNotes(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req SearchNotesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	// Set default pagination
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}
	if req.Offset < 0 {
		req.Offset = 0
	}

	var notes []models.Note
	var total int64

	query := h.db.Model(&models.Note{}).Where("user_id = ?", userID)

	// Full-text search - use LIKE for compatibility with SQLite and PostgreSQL
	searchQuery := strings.ToLower(req.Query)
	query = query.Where("LOWER(title) LIKE ? OR LOWER(CAST(content AS TEXT)) LIKE ?", "%"+searchQuery+"%", "%"+searchQuery+"%")

	// Apply additional filters
	if len(req.Categories) > 0 {
		query = query.Where("category IN ?", req.Categories)
	}

	if len(req.Tags) > 0 {
		// Build OR conditions for each tag
		tagConditions := make([]string, len(req.Tags))
		tagArgs := make([]interface{}, len(req.Tags))
		for i, tag := range req.Tags {
			tagConditions[i] = "tags LIKE ?"
			tagArgs[i] = "%\"" + tag + "\"%"
		}
		if len(tagConditions) > 0 {
			query = query.Where("("+strings.Join(tagConditions, " OR ")+")", tagArgs...)
		}
	}

	if req.FolderPath != "" {
		query = query.Where("folder_path LIKE ?", req.FolderPath+"%")
	}

	if req.IsArchived != nil {
		query = query.Where("is_archived = ?", *req.IsArchived)
	}

	if req.DateFrom != nil {
		query = query.Where("created_at >= ?", *req.DateFrom)
	}

	if req.DateTo != nil {
		query = query.Where("created_at <= ?", *req.DateTo)
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count search results"})
		return
	}

	// Get paginated results with relevance ranking
	if err := query.Order("updated_at DESC").
		Limit(req.Limit).
		Offset(req.Offset).
		Find(&notes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search notes"})
		return
	}

	response := NotesResponse{
		Notes:  notes,
		Total:  total,
		Limit:  req.Limit,
		Offset: req.Offset,
	}

	c.JSON(http.StatusOK, response)
}

// ArchiveNote archives a note
func (h *NoteHandler) ArchiveNote(c *gin.Context) {
	userID, _ := c.Get("userID")
	noteID := c.Param("id")

	var note models.Note
	if err := h.db.Where("id = ? AND user_id = ?", noteID, userID).First(&note).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch note"})
		}
		return
	}

	note.IsArchived = true
	note.Version++

	if err := h.db.Save(&note).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to archive note"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note archived successfully", "note": note})
}

// RestoreNote restores an archived note
func (h *NoteHandler) RestoreNote(c *gin.Context) {
	userID, _ := c.Get("userID")
	noteID := c.Param("id")

	var note models.Note
	if err := h.db.Where("id = ? AND user_id = ?", noteID, userID).First(&note).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch note"})
		}
		return
	}

	note.IsArchived = false
	note.Version++

	if err := h.db.Save(&note).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore note"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note restored successfully", "note": note})
}

// GetArchivedNotes gets all archived notes for a user
func (h *NoteHandler) GetArchivedNotes(c *gin.Context) {
	userID, _ := c.Get("userID")

	// Parse pagination parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 50
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	var notes []models.Note
	var total int64

	query := h.db.Model(&models.Note{}).Where("user_id = ? AND is_archived = ?", userID, true)

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count archived notes"})
		return
	}

	// Get paginated results
	if err := query.Order("updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&notes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch archived notes"})
		return
	}

	response := NotesResponse{
		Notes:  notes,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}

	c.JSON(http.StatusOK, response)
}

// GetNotesByCategory gets notes filtered by category
func (h *NoteHandler) GetNotesByCategory(c *gin.Context) {
	userID, _ := c.Get("userID")
	category := c.Param("category")

	if category == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category is required"})
		return
	}

	// Parse pagination parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 50
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	var notes []models.Note
	var total int64

	query := h.db.Model(&models.Note{}).Where("user_id = ? AND category = ? AND is_archived = ?", userID, category, false)

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count notes"})
		return
	}

	// Get paginated results
	if err := query.Order("is_pinned DESC, updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&notes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
	}

	response := NotesResponse{
		Notes:  notes,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}

	c.JSON(http.StatusOK, response)
}

// GetNotesByTag gets notes filtered by tag
func (h *NoteHandler) GetNotesByTag(c *gin.Context) {
	userID, _ := c.Get("userID")
	tag := c.Param("tag")

	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag is required"})
		return
	}

	// Parse pagination parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 50
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	var notes []models.Note
	var total int64

	query := h.db.Model(&models.Note{}).Where("user_id = ? AND tags LIKE ? AND is_archived = ?", userID, "%\""+tag+"\"%", false)

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count notes"})
		return
	}

	// Get paginated results
	if err := query.Order("is_pinned DESC, updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&notes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
	}

	response := NotesResponse{
		Notes:  notes,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}

	c.JSON(http.StatusOK, response)
}

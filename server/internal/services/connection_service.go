package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"notesage-server/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConnectionService struct {
	db *gorm.DB
}

type ConnectionType string

const (
	ConnectionTypeMention   ConnectionType = "mention"
	ConnectionTypeReference ConnectionType = "reference"
	ConnectionTypeBacklink  ConnectionType = "backlink"
)

type DetectedConnection struct {
	SourceID   uuid.UUID      `json:"source_id"`
	SourceType string         `json:"source_type"`
	TargetID   uuid.UUID      `json:"target_id"`
	TargetType string         `json:"target_type"`
	Type       ConnectionType `json:"type"`
	Context    string         `json:"context"`
	Position   int            `json:"position"`
}

type GraphNode struct {
	ID          uuid.UUID `json:"id"`
	Type        string    `json:"type"` // "note" or "person"
	Title       string    `json:"title"`
	Category    string    `json:"category,omitempty"`
	Tags        []string  `json:"tags,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Connections int       `json:"connections"`
}

type GraphEdge struct {
	ID         uuid.UUID      `json:"id"`
	SourceID   uuid.UUID      `json:"source_id"`
	TargetID   uuid.UUID      `json:"target_id"`
	Type       ConnectionType `json:"type"`
	Strength   int            `json:"strength"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

func NewConnectionService(db *gorm.DB) *ConnectionService {
	return &ConnectionService{db: db}
}

// DetectConnections analyzes note content and detects @mentions and #references
func (s *ConnectionService) DetectConnections(userID uuid.UUID, noteID uuid.UUID, content models.JSONB) ([]DetectedConnection, error) {
	var connections []DetectedConnection
	
	// Convert content to string for analysis
	contentStr, err := s.extractTextFromContent(content)
	if err != nil {
		return nil, fmt.Errorf("failed to extract text from content: %w", err)
	}
	
	// Detect @mentions (people)
	personMentions, err := s.detectPersonMentions(userID, contentStr)
	if err != nil {
		return nil, fmt.Errorf("failed to detect person mentions: %w", err)
	}
	
	for _, mention := range personMentions {
		connections = append(connections, DetectedConnection{
			SourceID:   noteID,
			SourceType: "note",
			TargetID:   mention.PersonID,
			TargetType: "person",
			Type:       ConnectionTypeMention,
			Context:    mention.Context,
			Position:   mention.Position,
		})
	}
	
	// Detect #references (notes)
	noteReferences, err := s.detectNoteReferences(userID, contentStr)
	if err != nil {
		return nil, fmt.Errorf("failed to detect note references: %w", err)
	}
	
	for _, reference := range noteReferences {
		connections = append(connections, DetectedConnection{
			SourceID:   noteID,
			SourceType: "note",
			TargetID:   reference.NoteID,
			TargetType: "note",
			Type:       ConnectionTypeReference,
			Context:    reference.Context,
			Position:   reference.Position,
		})
	}
	
	return connections, nil
}

// UpdateConnections updates the connections table based on detected connections
func (s *ConnectionService) UpdateConnections(userID uuid.UUID, noteID uuid.UUID, detectedConnections []DetectedConnection) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Delete existing connections for this note
		if err := tx.Where("user_id = ? AND source_id = ? AND source_type = ?", userID, noteID, "note").
			Delete(&models.Connection{}).Error; err != nil {
			return fmt.Errorf("failed to delete existing connections: %w", err)
		}
		
		// Create new connections
		for _, detected := range detectedConnections {
			// Check if reverse connection exists to calculate strength
			var existingConnection models.Connection
			reverseExists := tx.Where("user_id = ? AND source_id = ? AND target_id = ? AND source_type = ? AND target_type = ?",
				userID, detected.TargetID, detected.SourceID, detected.TargetType, detected.SourceType).
				First(&existingConnection).Error == nil
			
			strength := 1
			if reverseExists {
				strength = 2 // Bidirectional connection has higher strength
			}
			
			connection := models.Connection{
				UserID:     userID,
				SourceID:   detected.SourceID,
				SourceType: detected.SourceType,
				TargetID:   detected.TargetID,
				TargetType: detected.TargetType,
				Strength:   strength,
			}
			
			if err := tx.Create(&connection).Error; err != nil {
				return fmt.Errorf("failed to create connection: %w", err)
			}
			
			// Update reverse connection strength if it exists
			if reverseExists {
				existingConnection.Strength = 2
				if err := tx.Save(&existingConnection).Error; err != nil {
					return fmt.Errorf("failed to update reverse connection strength: %w", err)
				}
			}
		}
		
		return nil
	})
}

// GetGraphData returns the complete knowledge graph for a user
func (s *ConnectionService) GetGraphData(userID uuid.UUID, filters map[string]interface{}) (*GraphData, error) {
	var nodes []GraphNode
	var edges []GraphEdge
	
	// Get all notes as nodes
	var notes []models.Note
	noteQuery := s.db.Where("user_id = ? AND is_archived = ?", userID, false)
	
	// Apply filters
	if category, ok := filters["category"].(string); ok && category != "" {
		noteQuery = noteQuery.Where("category = ?", category)
	}
	
	if tags, ok := filters["tags"].([]string); ok && len(tags) > 0 {
		for _, tag := range tags {
			noteQuery = noteQuery.Where("tags LIKE ?", "%\""+tag+"\"%")
		}
	}
	
	if err := noteQuery.Find(&notes).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch notes: %w", err)
	}
	
	// Convert notes to graph nodes
	for _, note := range notes {
		// Count connections for this note
		var connectionCount int64
		s.db.Model(&models.Connection{}).Where("user_id = ? AND (source_id = ? OR target_id = ?)", 
			userID, note.ID, note.ID).Count(&connectionCount)
		
		var tags []string
		for _, tag := range note.Tags {
			tags = append(tags, tag)
		}
		
		nodes = append(nodes, GraphNode{
			ID:          note.ID,
			Type:        "note",
			Title:       note.Title,
			Category:    note.Category,
			Tags:        tags,
			CreatedAt:   note.CreatedAt,
			UpdatedAt:   note.UpdatedAt,
			Connections: int(connectionCount),
		})
	}
	
	// Get all people as nodes
	var people []models.Person
	if err := s.db.Where("user_id = ?", userID).Find(&people).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch people: %w", err)
	}
	
	// Convert people to graph nodes
	for _, person := range people {
		// Count connections for this person
		var connectionCount int64
		s.db.Model(&models.Connection{}).Where("user_id = ? AND (source_id = ? OR target_id = ?)", 
			userID, person.ID, person.ID).Count(&connectionCount)
		
		nodes = append(nodes, GraphNode{
			ID:          person.ID,
			Type:        "person",
			Title:       person.Name,
			CreatedAt:   person.CreatedAt,
			UpdatedAt:   person.UpdatedAt,
			Connections: int(connectionCount),
		})
	}
	
	// Get all connections as edges
	var connections []models.Connection
	if err := s.db.Where("user_id = ?", userID).Find(&connections).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch connections: %w", err)
	}
	
	// Convert connections to graph edges
	for _, conn := range connections {
		connectionType := ConnectionTypeReference
		if conn.SourceType == "note" && conn.TargetType == "person" {
			connectionType = ConnectionTypeMention
		}
		
		edges = append(edges, GraphEdge{
			ID:        conn.ID,
			SourceID:  conn.SourceID,
			TargetID:  conn.TargetID,
			Type:      connectionType,
			Strength:  conn.Strength,
			CreatedAt: conn.CreatedAt,
			UpdatedAt: conn.UpdatedAt,
		})
	}
	
	return &GraphData{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

// SearchGraph searches for nodes in the knowledge graph
func (s *ConnectionService) SearchGraph(userID uuid.UUID, query string, nodeType string) ([]GraphNode, error) {
	var nodes []GraphNode
	
	if nodeType == "" || nodeType == "note" {
		// Search notes
		var notes []models.Note
		noteQuery := s.db.Where("user_id = ? AND is_archived = ? AND (LOWER(title) LIKE ? OR LOWER(CAST(content AS TEXT)) LIKE ?)", 
			userID, false, "%"+strings.ToLower(query)+"%", "%"+strings.ToLower(query)+"%")
		
		if err := noteQuery.Find(&notes).Error; err != nil {
			return nil, fmt.Errorf("failed to search notes: %w", err)
		}
		
		for _, note := range notes {
			var connectionCount int64
			s.db.Model(&models.Connection{}).Where("user_id = ? AND (source_id = ? OR target_id = ?)", 
				userID, note.ID, note.ID).Count(&connectionCount)
			
			var tags []string
			for _, tag := range note.Tags {
				tags = append(tags, tag)
			}
			
			nodes = append(nodes, GraphNode{
				ID:          note.ID,
				Type:        "note",
				Title:       note.Title,
				Category:    note.Category,
				Tags:        tags,
				CreatedAt:   note.CreatedAt,
				UpdatedAt:   note.UpdatedAt,
				Connections: int(connectionCount),
			})
		}
	}
	
	if nodeType == "" || nodeType == "person" {
		// Search people
		var people []models.Person
		personQuery := s.db.Where("user_id = ? AND (LOWER(name) LIKE ? OR LOWER(company) LIKE ? OR LOWER(title) LIKE ?)", 
			userID, "%"+strings.ToLower(query)+"%", "%"+strings.ToLower(query)+"%", "%"+strings.ToLower(query)+"%")
		
		if err := personQuery.Find(&people).Error; err != nil {
			return nil, fmt.Errorf("failed to search people: %w", err)
		}
		
		for _, person := range people {
			var connectionCount int64
			s.db.Model(&models.Connection{}).Where("user_id = ? AND (source_id = ? OR target_id = ?)", 
				userID, person.ID, person.ID).Count(&connectionCount)
			
			nodes = append(nodes, GraphNode{
				ID:          person.ID,
				Type:        "person",
				Title:       person.Name,
				CreatedAt:   person.CreatedAt,
				UpdatedAt:   person.UpdatedAt,
				Connections: int(connectionCount),
			})
		}
	}
	
	return nodes, nil
}

// GetNodeConnections returns all connections for a specific node
func (s *ConnectionService) GetNodeConnections(userID uuid.UUID, nodeID uuid.UUID) ([]GraphEdge, error) {
	var connections []models.Connection
	if err := s.db.Where("user_id = ? AND (source_id = ? OR target_id = ?)", userID, nodeID, nodeID).
		Find(&connections).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch node connections: %w", err)
	}
	
	var edges []GraphEdge
	for _, conn := range connections {
		connectionType := ConnectionTypeReference
		if conn.SourceType == "note" && conn.TargetType == "person" {
			connectionType = ConnectionTypeMention
		}
		
		edges = append(edges, GraphEdge{
			ID:        conn.ID,
			SourceID:  conn.SourceID,
			TargetID:  conn.TargetID,
			Type:      connectionType,
			Strength:  conn.Strength,
			CreatedAt: conn.CreatedAt,
			UpdatedAt: conn.UpdatedAt,
		})
	}
	
	return edges, nil
}

// ExportGraphData exports the knowledge graph in various formats
func (s *ConnectionService) ExportGraphData(userID uuid.UUID, format string) ([]byte, error) {
	graphData, err := s.GetGraphData(userID, map[string]interface{}{})
	if err != nil {
		return nil, fmt.Errorf("failed to get graph data: %w", err)
	}
	
	switch format {
	case "json":
		return json.MarshalIndent(graphData, "", "  ")
	case "cypher":
		return s.exportToCypher(graphData)
	case "gexf":
		return s.exportToGEXF(graphData)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}

// Helper functions

type PersonMention struct {
	PersonID uuid.UUID
	Context  string
	Position int
}

type NoteReference struct {
	NoteID   uuid.UUID
	Context  string
	Position int
}

func (s *ConnectionService) detectPersonMentions(userID uuid.UUID, content string) ([]PersonMention, error) {
	var mentions []PersonMention
	
	// Get all people for this user
	var people []models.Person
	if err := s.db.Where("user_id = ?", userID).Find(&people).Error; err != nil {
		return nil, err
	}
	
	// Create a map of names to person IDs for quick lookup
	nameToID := make(map[string]uuid.UUID)
	for _, person := range people {
		// Add full name
		nameToID[strings.ToLower(person.Name)] = person.ID
		
		// Add first name and last name separately
		nameParts := strings.Fields(person.Name)
		if len(nameParts) > 0 {
			nameToID[strings.ToLower(nameParts[0])] = person.ID
		}
		if len(nameParts) > 1 {
			nameToID[strings.ToLower(nameParts[len(nameParts)-1])] = person.ID
		}
	}
	
	// Regex to find @mentions - match @word or @"phrase with spaces"
	mentionRegex := regexp.MustCompile(`@([a-zA-Z][a-zA-Z0-9_\-]*(?:\s+[a-zA-Z][a-zA-Z0-9_\-]*)*)\b`)
	matches := mentionRegex.FindAllStringSubmatchIndex(content, -1)
	
	for _, match := range matches {
		if len(match) >= 4 {
			mentionText := strings.TrimSpace(content[match[2]:match[3]])
			mentionTextLower := strings.ToLower(mentionText)
			
			if personID, exists := nameToID[mentionTextLower]; exists {
				// Extract context (20 characters before and after)
				contextStart := max(0, match[0]-20)
				contextEnd := min(len(content), match[1]+20)
				context := content[contextStart:contextEnd]
				
				mentions = append(mentions, PersonMention{
					PersonID: personID,
					Context:  context,
					Position: match[0],
				})
			}
		}
	}
	
	return mentions, nil
}

func (s *ConnectionService) detectNoteReferences(userID uuid.UUID, content string) ([]NoteReference, error) {
	var references []NoteReference
	
	// Get all notes for this user
	var notes []models.Note
	if err := s.db.Where("user_id = ? AND is_archived = ?", userID, false).Find(&notes).Error; err != nil {
		return nil, err
	}
	
	// Create a map of titles to note IDs for quick lookup
	titleToID := make(map[string]uuid.UUID)
	for _, note := range notes {
		titleToID[strings.ToLower(note.Title)] = note.ID
	}
	
	// Regex to find #references - match #word or #"phrase with spaces"
	referenceRegex := regexp.MustCompile(`#([a-zA-Z][a-zA-Z0-9_\-]*(?:\s+[a-zA-Z][a-zA-Z0-9_\-]*)*)\b`)
	matches := referenceRegex.FindAllStringSubmatchIndex(content, -1)
	
	for _, match := range matches {
		if len(match) >= 4 {
			referenceText := strings.TrimSpace(content[match[2]:match[3]])
			referenceTextLower := strings.ToLower(referenceText)
			
			// Find the best matching note title
			for title, noteID := range titleToID {
				if strings.Contains(title, referenceTextLower) || strings.Contains(referenceTextLower, title) {
					// Extract context (20 characters before and after)
					contextStart := max(0, match[0]-20)
					contextEnd := min(len(content), match[1]+20)
					context := content[contextStart:contextEnd]
					
					references = append(references, NoteReference{
						NoteID:   noteID,
						Context:  context,
						Position: match[0],
					})
					break
				}
			}
		}
	}
	
	return references, nil
}

func (s *ConnectionService) extractTextFromContent(content models.JSONB) (string, error) {
	if content == nil {
		return "", nil
	}
	
	// Convert JSONB to string for simple text extraction
	// This is a simplified approach - in a real implementation, you'd want to
	// properly parse the structured content and extract text from all text nodes
	contentBytes, err := json.Marshal(content)
	if err != nil {
		return "", err
	}
	
	var contentMap map[string]interface{}
	if err := json.Unmarshal(contentBytes, &contentMap); err != nil {
		return "", err
	}
	
	return s.extractTextRecursive(contentMap), nil
}

func (s *ConnectionService) extractTextRecursive(data interface{}) string {
	var text strings.Builder
	
	switch v := data.(type) {
	case map[string]interface{}:
		// First check for text content
		if textValue, ok := v["text"].(string); ok {
			text.WriteString(textValue)
			text.WriteString(" ")
		}
		// Then recursively process other fields, especially "content"
		if content, ok := v["content"]; ok {
			text.WriteString(s.extractTextRecursive(content))
		}
		// Process other fields except "text" and "content" to avoid duplication
		for key, value := range v {
			if key != "text" && key != "content" {
				text.WriteString(s.extractTextRecursive(value))
			}
		}
	case []interface{}:
		for _, item := range v {
			text.WriteString(s.extractTextRecursive(item))
		}
	case string:
		// Only add strings that are not keys or metadata
		if len(v) > 0 && !isMetadataString(v) {
			text.WriteString(v)
			text.WriteString(" ")
		}
	}
	
	return text.String()
}

// Helper function to identify metadata strings that shouldn't be included in text extraction
func isMetadataString(s string) bool {
	metadataKeys := []string{"type", "doc", "paragraph", "text", "heading", "bold", "italic"}
	for _, key := range metadataKeys {
		if s == key {
			return true
		}
	}
	return false
}

func (s *ConnectionService) exportToCypher(data *GraphData) ([]byte, error) {
	var cypher strings.Builder
	
	// Create nodes
	cypher.WriteString("// Create nodes\n")
	for _, node := range data.Nodes {
		if node.Type == "note" {
			cypher.WriteString(fmt.Sprintf("CREATE (n%s:Note {id: '%s', title: '%s', category: '%s'})\n", 
				strings.ReplaceAll(node.ID.String(), "-", ""), node.ID, 
				strings.ReplaceAll(node.Title, "'", "\\'"), node.Category))
		} else {
			cypher.WriteString(fmt.Sprintf("CREATE (p%s:Person {id: '%s', name: '%s'})\n", 
				strings.ReplaceAll(node.ID.String(), "-", ""), node.ID, 
				strings.ReplaceAll(node.Title, "'", "\\'")))
		}
	}
	
	// Create relationships
	cypher.WriteString("\n// Create relationships\n")
	for _, edge := range data.Edges {
		sourceVar := "n" + strings.ReplaceAll(edge.SourceID.String(), "-", "")
		targetVar := "n" + strings.ReplaceAll(edge.TargetID.String(), "-", "")
		
		// Find source and target types
		for _, node := range data.Nodes {
			if node.ID == edge.SourceID && node.Type == "person" {
				sourceVar = "p" + strings.ReplaceAll(edge.SourceID.String(), "-", "")
			}
			if node.ID == edge.TargetID && node.Type == "person" {
				targetVar = "p" + strings.ReplaceAll(edge.TargetID.String(), "-", "")
			}
		}
		
		relationshipType := strings.ToUpper(string(edge.Type))
		cypher.WriteString(fmt.Sprintf("MATCH (%s), (%s) CREATE (%s)-[:%s {strength: %d}]->(%s)\n", 
			sourceVar, targetVar, sourceVar, relationshipType, edge.Strength, targetVar))
	}
	
	return []byte(cypher.String()), nil
}

func (s *ConnectionService) exportToGEXF(data *GraphData) ([]byte, error) {
	var gexf strings.Builder
	
	gexf.WriteString(`<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <graph mode="static" defaultedgetype="directed">
    <attributes class="node">
      <attribute id="0" title="type" type="string"/>
      <attribute id="1" title="category" type="string"/>
    </attributes>
    <nodes>
`)
	
	// Add nodes
	for _, node := range data.Nodes {
		gexf.WriteString(fmt.Sprintf(`      <node id="%s" label="%s">
        <attvalues>
          <attvalue for="0" value="%s"/>
          <attvalue for="1" value="%s"/>
        </attvalues>
      </node>
`, node.ID, strings.ReplaceAll(node.Title, `"`, `&quot;`), node.Type, node.Category))
	}
	
	gexf.WriteString(`    </nodes>
    <edges>
`)
	
	// Add edges
	for i, edge := range data.Edges {
		gexf.WriteString(fmt.Sprintf(`      <edge id="%d" source="%s" target="%s" weight="%d"/>
`, i, edge.SourceID, edge.TargetID, edge.Strength))
	}
	
	gexf.WriteString(`    </edges>
  </graph>
</gexf>`)
	
	return []byte(gexf.String()), nil
}

// Utility functions
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
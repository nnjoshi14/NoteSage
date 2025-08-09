package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"notesage-server/internal/database"
	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupGraphTestDB(t *testing.T) (*gorm.DB, uuid.UUID, uuid.UUID, uuid.UUID) {
	db := database.SetupTestDB(t)
	
	// Create test user with unique identifiers
	userID := uuid.New()
	user := models.User{
		ID:       userID,
		Username: "testuser_" + userID.String()[:8],
		Email:    "test_" + userID.String()[:8] + "@example.com",
		Password: "hashedpassword",
		Role:     models.RoleUser,
		IsActive: true,
	}
	require.NoError(t, db.Create(&user).Error)
	
	// Create test person
	person := models.Person{
		ID:     uuid.New(),
		UserID: user.ID,
		Name:   "John Smith",
		Email:  "john@example.com",
	}
	require.NoError(t, db.Create(&person).Error)
	
	// Create test note
	note := models.Note{
		ID:     uuid.New(),
		UserID: user.ID,
		Title:  "Meeting Notes",
		Content: models.JSONB{
			"type": "doc",
			"content": []interface{}{
				map[string]interface{}{
					"type": "paragraph",
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": "Meeting with @John Smith was productive.",
						},
					},
				},
			},
		},
		Category: "Meeting",
	}
	require.NoError(t, db.Create(&note).Error)
	
	// Create test connection
	connection := models.Connection{
		UserID:     user.ID,
		SourceID:   note.ID,
		SourceType: "note",
		TargetID:   person.ID,
		TargetType: "person",
		Strength:   1,
	}
	require.NoError(t, db.Create(&connection).Error)
	
	return db, user.ID, note.ID, person.ID
}

func setupGraphRouter(db *gorm.DB, userID uuid.UUID) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	
	handler := NewGraphHandler(db)
	
	// Add auth middleware mock with specific user ID
	r.Use(func(c *gin.Context) {
		c.Set("userID", userID.String())
		c.Next()
	})
	
	// Register routes
	api := r.Group("/api/graph")
	{
		api.GET("", handler.GetGraph)
		api.GET("/search", handler.SearchGraph)
		api.GET("/stats", handler.GetGraphStats)
		api.GET("/types", handler.GetConnectionTypes)
		api.GET("/export", handler.ExportGraph)
		api.GET("/nodes/:id/connections", handler.GetNodeConnections)
		api.GET("/nodes/:id/subgraph", handler.GetSubgraph)
		api.POST("/notes/:note_id/detect", handler.DetectConnections)
		api.POST("/notes/:note_id/update", handler.UpdateConnections)
	}
	
	return r
}

func TestGraphHandler_GetGraph(t *testing.T) {
	db, userID, noteID, personID := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	tests := []struct {
		name           string
		query          string
		expectedStatus int
		checkResponse  func(*testing.T, map[string]interface{})
	}{
		{
			name:           "get full graph",
			query:          "",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "graph")
				assert.Contains(t, response, "stats")
				
				graph := response["graph"].(map[string]interface{})
				assert.Contains(t, graph, "nodes")
				assert.Contains(t, graph, "edges")
				
				nodes := graph["nodes"].([]interface{})
				edges := graph["edges"].([]interface{})
				
				assert.GreaterOrEqual(t, len(nodes), 2) // At least note and person
				assert.GreaterOrEqual(t, len(edges), 1) // At least one connection
				
				stats := response["stats"].(map[string]interface{})
				assert.Equal(t, float64(len(nodes)), stats["nodes"])
				assert.Equal(t, float64(len(edges)), stats["edges"])
			},
		},
		{
			name:           "filter by category",
			query:          "?category=Meeting",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				graph := response["graph"].(map[string]interface{})
				nodes := graph["nodes"].([]interface{})
				
				// Should contain at least the meeting note
				foundMeetingNote := false
				for _, nodeInterface := range nodes {
					node := nodeInterface.(map[string]interface{})
					if node["type"] == "note" && node["category"] == "Meeting" {
						foundMeetingNote = true
						break
					}
				}
				assert.True(t, foundMeetingNote, "Should find meeting note in filtered results")
			},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/api/graph"+tt.query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				
				if tt.checkResponse != nil {
					tt.checkResponse(t, response)
				}
			}
		})
	}
	
	_ = userID
	_ = noteID
	_ = personID
}

func TestGraphHandler_SearchGraph(t *testing.T) {
	db, userID, _, _ := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	tests := []struct {
		name           string
		query          string
		expectedStatus int
		checkResponse  func(*testing.T, map[string]interface{})
	}{
		{
			name:           "search for meeting",
			query:          "?q=meeting",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "nodes")
				assert.Contains(t, response, "total")
				
				nodes := response["nodes"].([]interface{})
				assert.GreaterOrEqual(t, len(nodes), 1)
				
				// Should find the meeting note
				foundMeetingNote := false
				for _, nodeInterface := range nodes {
					node := nodeInterface.(map[string]interface{})
					if node["title"] == "Meeting Notes" {
						foundMeetingNote = true
						break
					}
				}
				assert.True(t, foundMeetingNote, "Should find meeting note in search results")
			},
		},
		{
			name:           "search for person",
			query:          "?q=john&node_type=person",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				nodes := response["nodes"].([]interface{})
				
				// Should find John Smith
				foundPerson := false
				for _, nodeInterface := range nodes {
					node := nodeInterface.(map[string]interface{})
					if node["title"] == "John Smith" && node["type"] == "person" {
						foundPerson = true
						break
					}
				}
				assert.True(t, foundPerson, "Should find John Smith in search results")
			},
		},
		{
			name:           "search with no query",
			query:          "",
			expectedStatus: http.StatusBadRequest,
			checkResponse:  nil,
		},
		{
			name:           "search with no results",
			query:          "?q=nonexistent",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "nodes")
				nodesInterface := response["nodes"]
				if nodesInterface == nil {
					// Empty result set
					assert.Equal(t, float64(0), response["total"])
				} else {
					nodes := nodesInterface.([]interface{})
					assert.Len(t, nodes, 0)
				}
			},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/api/graph/search"+tt.query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK && tt.checkResponse != nil {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				tt.checkResponse(t, response)
			}
		})
	}
}

func TestGraphHandler_GetNodeConnections(t *testing.T) {
	db, userID, noteID, personID := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	tests := []struct {
		name           string
		nodeID         uuid.UUID
		expectedStatus int
		checkResponse  func(*testing.T, map[string]interface{})
	}{
		{
			name:           "get note connections",
			nodeID:         noteID,
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "connections")
				assert.Contains(t, response, "total")
				
				connections := response["connections"].([]interface{})
				assert.GreaterOrEqual(t, len(connections), 1)
				
				// Verify connection structure
				connection := connections[0].(map[string]interface{})
				assert.Contains(t, connection, "source_id")
				assert.Contains(t, connection, "target_id")
				assert.Contains(t, connection, "type")
				assert.Contains(t, connection, "strength")
			},
		},
		{
			name:           "get person connections",
			nodeID:         personID,
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				connections := response["connections"].([]interface{})
				assert.GreaterOrEqual(t, len(connections), 1)
			},
		},
		{
			name:           "invalid node ID",
			nodeID:         uuid.New(), // Non-existent ID
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "connections")
				connectionsInterface := response["connections"]
				if connectionsInterface == nil {
					// Empty result set
					assert.Equal(t, float64(0), response["total"])
				} else {
					connections := connectionsInterface.([]interface{})
					assert.Len(t, connections, 0) // No connections for non-existent node
				}
			},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := fmt.Sprintf("/api/graph/nodes/%s/connections", tt.nodeID.String())
			req, _ := http.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK && tt.checkResponse != nil {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				tt.checkResponse(t, response)
			}
		})
	}
}

func TestGraphHandler_DetectConnections(t *testing.T) {
	db, userID, noteID, _ := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	tests := []struct {
		name           string
		noteID         uuid.UUID
		content        map[string]interface{}
		expectedStatus int
		checkResponse  func(*testing.T, map[string]interface{})
	}{
		{
			name:   "detect person mention",
			noteID: noteID,
			content: map[string]interface{}{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{
								"type": "text",
								"text": "Meeting with @John Smith was great.",
							},
						},
					},
				},
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "connections")
				assert.Contains(t, response, "total")
				
				connections := response["connections"].([]interface{})
				assert.GreaterOrEqual(t, len(connections), 1)
				
				// Verify connection structure
				connection := connections[0].(map[string]interface{})
				assert.Contains(t, connection, "source_id")
				assert.Contains(t, connection, "target_id")
				assert.Contains(t, connection, "type")
				assert.Equal(t, "mention", connection["type"])
			},
		},
		{
			name:   "no connections",
			noteID: noteID,
			content: map[string]interface{}{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{
								"type": "text",
								"text": "This is a regular note without mentions.",
							},
						},
					},
				},
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				connections := response["connections"].([]interface{})
				assert.Len(t, connections, 0)
			},
		},
		{
			name:           "invalid note ID",
			noteID:         uuid.New(),
			content:        map[string]interface{}{},
			expectedStatus: http.StatusOK, // Service doesn't validate note existence for detection
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "connections")
			},
		},
		{
			name:           "missing content",
			noteID:         noteID,
			content:        nil,
			expectedStatus: http.StatusBadRequest,
			checkResponse:  nil,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requestBody := map[string]interface{}{
				"content": tt.content,
			}
			
			jsonBody, _ := json.Marshal(requestBody)
			url := fmt.Sprintf("/api/graph/notes/%s/detect", tt.noteID.String())
			req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK && tt.checkResponse != nil {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				tt.checkResponse(t, response)
			}
		})
	}
}

func TestGraphHandler_UpdateConnections(t *testing.T) {
	db, userID, noteID, _ := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	content := map[string]interface{}{
		"type": "doc",
		"content": []interface{}{
			map[string]interface{}{
				"type": "paragraph",
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "Updated meeting with @John Smith.",
					},
				},
			},
		},
	}
	
	requestBody := map[string]interface{}{
		"content": content,
	}
	
	jsonBody, _ := json.Marshal(requestBody)
	url := fmt.Sprintf("/api/graph/notes/%s/update", noteID.String())
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Contains(t, response, "message")
	assert.Contains(t, response, "connections")
	assert.Contains(t, response, "total")
	assert.Equal(t, "Connections updated successfully", response["message"])
	
	// Verify connections were actually saved to database
	var connections []models.Connection
	err = db.Where("source_id = ?", noteID).Find(&connections).Error
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(connections), 1)
}

func TestGraphHandler_ExportGraph(t *testing.T) {
	db, userID, _, _ := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	tests := []struct {
		name           string
		format         string
		expectedStatus int
		expectedType   string
	}{
		{
			name:           "export as JSON",
			format:         "json",
			expectedStatus: http.StatusOK,
			expectedType:   "application/json",
		},
		{
			name:           "export as Cypher",
			format:         "cypher",
			expectedStatus: http.StatusOK,
			expectedType:   "text/plain",
		},
		{
			name:           "export as GEXF",
			format:         "gexf",
			expectedStatus: http.StatusOK,
			expectedType:   "application/xml",
		},
		{
			name:           "unsupported format",
			format:         "unsupported",
			expectedStatus: http.StatusInternalServerError, // Service returns error
		},
		{
			name:           "missing format",
			format:         "",
			expectedStatus: http.StatusBadRequest,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := ""
			if tt.format != "" {
				query = "?format=" + tt.format
			}
			
			req, _ := http.NewRequest("GET", "/api/graph/export"+query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK {
				assert.Equal(t, tt.expectedType, w.Header().Get("Content-Type"))
				assert.NotEmpty(t, w.Body.String())
				
				// Check Content-Disposition header
				disposition := w.Header().Get("Content-Disposition")
				assert.Contains(t, disposition, "attachment")
				assert.Contains(t, disposition, "knowledge_graph")
			}
		})
	}
}

func TestGraphHandler_GetGraphStats(t *testing.T) {
	db, userID, _, _ := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	req, _ := http.NewRequest("GET", "/api/graph/stats", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Contains(t, response, "stats")
	stats := response["stats"].(map[string]interface{})
	
	// Check required stats fields
	requiredFields := []string{
		"total_nodes", "note_count", "person_count", "total_connections",
		"strong_connections", "avg_connection_strength", "max_connections",
	}
	
	for _, field := range requiredFields {
		assert.Contains(t, stats, field, "Stats should contain field: %s", field)
	}
	
	// Verify stats make sense
	totalNodes := stats["total_nodes"].(float64)
	noteCount := stats["note_count"].(float64)
	personCount := stats["person_count"].(float64)
	
	assert.Equal(t, totalNodes, noteCount+personCount)
	assert.GreaterOrEqual(t, totalNodes, float64(2)) // At least one note and one person
}

func TestGraphHandler_GetConnectionTypes(t *testing.T) {
	db, userID, _, _ := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	req, _ := http.NewRequest("GET", "/api/graph/types", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Contains(t, response, "connection_types")
	connectionTypes := response["connection_types"].(map[string]interface{})
	
	// Should have at least one connection type
	assert.GreaterOrEqual(t, len(connectionTypes), 1)
	
	// Verify all values are numbers
	for _, count := range connectionTypes {
		assert.IsType(t, float64(0), count, "Connection type counts should be numbers")
	}
}

func TestGraphHandler_GetSubgraph(t *testing.T) {
	db, userID, noteID, _ := setupGraphTestDB(t)
	router := setupGraphRouter(db, userID)
	
	tests := []struct {
		name           string
		nodeID         uuid.UUID
		depth          string
		expectedStatus int
		checkResponse  func(*testing.T, map[string]interface{})
	}{
		{
			name:           "get subgraph depth 1",
			nodeID:         noteID,
			depth:          "1",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Contains(t, response, "subgraph")
				assert.Contains(t, response, "center_node")
				assert.Contains(t, response, "depth")
				assert.Contains(t, response, "stats")
				
				assert.Equal(t, noteID.String(), response["center_node"])
				assert.Equal(t, float64(1), response["depth"])
				
				subgraph := response["subgraph"].(map[string]interface{})
				assert.Contains(t, subgraph, "nodes")
				assert.Contains(t, subgraph, "edges")
				
				nodes := subgraph["nodes"].([]interface{})
				assert.GreaterOrEqual(t, len(nodes), 1) // At least the center node
			},
		},
		{
			name:           "get subgraph default depth",
			nodeID:         noteID,
			depth:          "",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Equal(t, float64(1), response["depth"]) // Default depth is 1
			},
		},
		{
			name:           "invalid depth",
			nodeID:         noteID,
			depth:          "invalid",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Equal(t, float64(1), response["depth"]) // Falls back to default
			},
		},
		{
			name:           "depth too high",
			nodeID:         noteID,
			depth:          "10",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				assert.Equal(t, float64(1), response["depth"]) // Capped at maximum
			},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := fmt.Sprintf("/api/graph/nodes/%s/subgraph", tt.nodeID.String())
			if tt.depth != "" {
				url += "?depth=" + tt.depth
			}
			
			req, _ := http.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tt.expectedStatus, w.Code)
			
			if tt.expectedStatus == http.StatusOK && tt.checkResponse != nil {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				tt.checkResponse(t, response)
			}
		})
	}
}
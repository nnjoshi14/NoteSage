package handlers

import (
	"net/http"
	"strconv"

	"notesage-server/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GraphHandler struct {
	connectionService *services.ConnectionService
}

func NewGraphHandler(db *gorm.DB) *GraphHandler {
	return &GraphHandler{
		connectionService: services.NewConnectionService(db),
	}
}

type GraphFilters struct {
	Category string   `json:"category" form:"category"`
	Tags     []string `json:"tags" form:"tags"`
	NodeType string   `json:"node_type" form:"node_type"` // "note", "person", or empty for all
}

type SearchGraphRequest struct {
	Query    string `json:"query" form:"q" binding:"required"`
	NodeType string `json:"node_type" form:"node_type"` // "note", "person", or empty for all
}

type ExportGraphRequest struct {
	Format string `json:"format" form:"format" binding:"required"` // "json", "cypher", "gexf"
}

// GetGraph returns the complete knowledge graph for the authenticated user
func (h *GraphHandler) GetGraph(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	var filters GraphFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Convert filters to map
	filterMap := make(map[string]interface{})
	if filters.Category != "" {
		filterMap["category"] = filters.Category
	}
	if len(filters.Tags) > 0 {
		filterMap["tags"] = filters.Tags
	}
	
	graphData, err := h.connectionService.GetGraphData(userUUID, filterMap)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch graph data"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"graph": graphData,
		"stats": gin.H{
			"nodes": len(graphData.Nodes),
			"edges": len(graphData.Edges),
		},
	})
}

// SearchGraph searches for nodes in the knowledge graph
func (h *GraphHandler) SearchGraph(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	var req SearchGraphRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	nodes, err := h.connectionService.SearchGraph(userUUID, req.Query, req.NodeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search graph"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"nodes": nodes,
		"total": len(nodes),
	})
}

// GetNodeConnections returns all connections for a specific node
func (h *GraphHandler) GetNodeConnections(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	nodeIDStr := c.Param("id")
	nodeID, err := uuid.Parse(nodeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}
	
	connections, err := h.connectionService.GetNodeConnections(userUUID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch node connections"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"connections": connections,
		"total":       len(connections),
	})
}

// DetectConnections analyzes a note's content and returns detected connections without saving them
func (h *GraphHandler) DetectConnections(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	noteIDStr := c.Param("note_id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}
	
	var req struct {
		Content map[string]interface{} `json:"content" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	connections, err := h.connectionService.DetectConnections(userUUID, noteID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to detect connections"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"connections": connections,
		"total":       len(connections),
	})
}

// UpdateConnections updates the connections for a note based on its current content
func (h *GraphHandler) UpdateConnections(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	noteIDStr := c.Param("note_id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}
	
	var req struct {
		Content map[string]interface{} `json:"content" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Detect connections
	connections, err := h.connectionService.DetectConnections(userUUID, noteID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to detect connections"})
		return
	}
	
	// Update connections in database
	if err := h.connectionService.UpdateConnections(userUUID, noteID, connections); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update connections"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message":     "Connections updated successfully",
		"connections": connections,
		"total":       len(connections),
	})
}

// ExportGraph exports the knowledge graph in various formats
func (h *GraphHandler) ExportGraph(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	var req ExportGraphRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	data, err := h.connectionService.ExportGraphData(userUUID, req.Format)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export graph data"})
		return
	}
	
	// Set appropriate content type based on format
	var contentType string
	var filename string
	
	switch req.Format {
	case "json":
		contentType = "application/json"
		filename = "knowledge_graph.json"
	case "cypher":
		contentType = "text/plain"
		filename = "knowledge_graph.cypher"
	case "gexf":
		contentType = "application/xml"
		filename = "knowledge_graph.gexf"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported format"})
		return
	}
	
	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, contentType, data)
}

// GetGraphStats returns statistics about the knowledge graph
func (h *GraphHandler) GetGraphStats(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	graphData, err := h.connectionService.GetGraphData(userUUID, map[string]interface{}{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch graph data"})
		return
	}
	
	// Calculate statistics
	noteCount := 0
	personCount := 0
	totalConnections := len(graphData.Edges)
	
	connectionStrengthSum := 0
	strongConnections := 0 // connections with strength > 1
	
	for _, node := range graphData.Nodes {
		if node.Type == "note" {
			noteCount++
		} else if node.Type == "person" {
			personCount++
		}
	}
	
	for _, edge := range graphData.Edges {
		connectionStrengthSum += edge.Strength
		if edge.Strength > 1 {
			strongConnections++
		}
	}
	
	avgConnectionStrength := 0.0
	if totalConnections > 0 {
		avgConnectionStrength = float64(connectionStrengthSum) / float64(totalConnections)
	}
	
	// Find most connected nodes
	nodeConnectionCounts := make(map[uuid.UUID]int)
	for _, edge := range graphData.Edges {
		nodeConnectionCounts[edge.SourceID]++
		nodeConnectionCounts[edge.TargetID]++
	}
	
	var mostConnectedNode *services.GraphNode
	maxConnections := 0
	for _, node := range graphData.Nodes {
		if count := nodeConnectionCounts[node.ID]; count > maxConnections {
			maxConnections = count
			nodeCopy := node
			mostConnectedNode = &nodeCopy
		}
	}
	
	stats := gin.H{
		"total_nodes":              len(graphData.Nodes),
		"note_count":               noteCount,
		"person_count":             personCount,
		"total_connections":        totalConnections,
		"strong_connections":       strongConnections,
		"avg_connection_strength":  avgConnectionStrength,
		"most_connected_node":      mostConnectedNode,
		"max_connections":          maxConnections,
	}
	
	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// GetConnectionTypes returns the available connection types and their counts
func (h *GraphHandler) GetConnectionTypes(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	graphData, err := h.connectionService.GetGraphData(userUUID, map[string]interface{}{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch graph data"})
		return
	}
	
	// Count connection types
	typeCounts := make(map[string]int)
	for _, edge := range graphData.Edges {
		typeCounts[string(edge.Type)]++
	}
	
	c.JSON(http.StatusOK, gin.H{
		"connection_types": typeCounts,
	})
}

// GetSubgraph returns a subgraph centered around a specific node
func (h *GraphHandler) GetSubgraph(c *gin.Context) {
	userID, _ := c.Get("userID")
	userUUID := uuid.MustParse(userID.(string))
	
	nodeIDStr := c.Param("id")
	nodeID, err := uuid.Parse(nodeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}
	
	// Parse depth parameter (default to 1)
	depthStr := c.DefaultQuery("depth", "1")
	depth, err := strconv.Atoi(depthStr)
	if err != nil || depth < 1 || depth > 3 {
		depth = 1
	}
	
	// Get the full graph first
	fullGraph, err := h.connectionService.GetGraphData(userUUID, map[string]interface{}{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch graph data"})
		return
	}
	
	// Find the subgraph
	subgraph := h.extractSubgraph(fullGraph, nodeID, depth)
	
	c.JSON(http.StatusOK, gin.H{
		"subgraph": subgraph,
		"center_node": nodeID,
		"depth": depth,
		"stats": gin.H{
			"nodes": len(subgraph.Nodes),
			"edges": len(subgraph.Edges),
		},
	})
}

// Helper function to extract a subgraph centered around a node
func (h *GraphHandler) extractSubgraph(fullGraph *services.GraphData, centerNodeID uuid.UUID, depth int) *services.GraphData {
	// Use BFS to find all nodes within the specified depth
	visited := make(map[uuid.UUID]bool)
	nodesByDepth := make(map[int][]uuid.UUID)
	
	// Start with the center node at depth 0
	nodesByDepth[0] = []uuid.UUID{centerNodeID}
	visited[centerNodeID] = true
	
	// Build adjacency list for efficient traversal
	adjacency := make(map[uuid.UUID][]uuid.UUID)
	for _, edge := range fullGraph.Edges {
		adjacency[edge.SourceID] = append(adjacency[edge.SourceID], edge.TargetID)
		adjacency[edge.TargetID] = append(adjacency[edge.TargetID], edge.SourceID)
	}
	
	// BFS to find nodes at each depth level
	for currentDepth := 0; currentDepth < depth; currentDepth++ {
		var nextLevelNodes []uuid.UUID
		
		for _, nodeID := range nodesByDepth[currentDepth] {
			for _, neighborID := range adjacency[nodeID] {
				if !visited[neighborID] {
					visited[neighborID] = true
					nextLevelNodes = append(nextLevelNodes, neighborID)
				}
			}
		}
		
		if len(nextLevelNodes) > 0 {
			nodesByDepth[currentDepth+1] = nextLevelNodes
		}
	}
	
	// Collect all nodes in the subgraph
	subgraphNodeIDs := make(map[uuid.UUID]bool)
	for _, nodes := range nodesByDepth {
		for _, nodeID := range nodes {
			subgraphNodeIDs[nodeID] = true
		}
	}
	
	// Filter nodes and edges
	var subgraphNodes []services.GraphNode
	var subgraphEdges []services.GraphEdge
	
	for _, node := range fullGraph.Nodes {
		if subgraphNodeIDs[node.ID] {
			subgraphNodes = append(subgraphNodes, node)
		}
	}
	
	for _, edge := range fullGraph.Edges {
		if subgraphNodeIDs[edge.SourceID] && subgraphNodeIDs[edge.TargetID] {
			subgraphEdges = append(subgraphEdges, edge)
		}
	}
	
	return &services.GraphData{
		Nodes: subgraphNodes,
		Edges: subgraphEdges,
	}
}
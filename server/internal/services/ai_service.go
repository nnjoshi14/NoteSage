package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"notesage-server/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AIProvider represents different AI service providers
type AIProvider string

const (
	ProviderOpenAI AIProvider = "openai"
	ProviderGemini AIProvider = "gemini"
	ProviderGrok   AIProvider = "grok"
)

// AIConfig holds configuration for AI providers
type AIConfig struct {
	Provider   AIProvider `json:"provider"`
	APIKey     string     `json:"api_key"`
	BaseURL    string     `json:"base_url,omitempty"`
	Model      string     `json:"model,omitempty"`
	MaxTokens  int        `json:"max_tokens,omitempty"`
	Timeout    int        `json:"timeout,omitempty"` // seconds
}

// AIService handles AI-powered features
type AIService struct {
	db       *gorm.DB
	config   *AIConfig
	client   *http.Client
	enabled  bool
}

// NewAIService creates a new AI service
func NewAIService(db *gorm.DB, config *AIConfig) *AIService {
	timeout := 30 * time.Second
	if config != nil && config.Timeout > 0 {
		timeout = time.Duration(config.Timeout) * time.Second
	}

	return &AIService{
		db:      db,
		config:  config,
		enabled: config != nil && config.APIKey != "",
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

// IsEnabled returns whether AI features are available
func (s *AIService) IsEnabled() bool {
	return s.enabled
}

// TodoExtractionResult represents the result of AI todo extraction
type TodoExtractionResult struct {
	Todos  []ExtractedTodo `json:"todos"`
	Error  string          `json:"error,omitempty"`
}

// ExtractedTodo represents a todo extracted by AI
type ExtractedTodo struct {
	Text             string `json:"text"`
	AssignedPersonID string `json:"assigned_person_id,omitempty"`
	DueDate          string `json:"due_date,omitempty"` // YYYY-MM-DD format
	Priority         string `json:"priority,omitempty"`
	Context          string `json:"context,omitempty"`
}

// PeopleAnalysisResult represents the result of AI people analysis
type PeopleAnalysisResult struct {
	Mentions     []AIPersonMention   `json:"mentions"`
	Relationships []PersonRelationship `json:"relationships"`
	Error        string              `json:"error,omitempty"`
}

// AIPersonMention represents a person mentioned in content (AI analysis)
type AIPersonMention struct {
	Name     string `json:"name"`
	Context  string `json:"context"`
	Strength int    `json:"strength"` // 1-10 scale
}

// PersonRelationship represents a relationship between people
type PersonRelationship struct {
	Person1      string `json:"person1"`
	Person2      string `json:"person2"`
	Relationship string `json:"relationship"`
	Confidence   float64 `json:"confidence"`
}

// InsightResult represents AI-generated insights
type InsightResult struct {
	Insights []Insight `json:"insights"`
	Error    string    `json:"error,omitempty"`
}

// Insight represents a knowledge pattern insight
type Insight struct {
	Type        string  `json:"type"`        // "pattern", "connection", "trend", "suggestion"
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Confidence  float64 `json:"confidence"`
	Data        map[string]interface{} `json:"data,omitempty"`
}

// ExtractTodosFromNote extracts todos from note content using AI
func (s *AIService) ExtractTodosFromNote(ctx context.Context, noteContent models.JSONB) (*TodoExtractionResult, error) {
	if !s.enabled {
		return &TodoExtractionResult{
			Error: "AI service not available",
		}, nil
	}

	// Extract text content from structured JSON
	textContent := s.extractTextFromContent(noteContent)
	if textContent == "" {
		return &TodoExtractionResult{Todos: []ExtractedTodo{}}, nil
	}

	prompt := s.buildTodoExtractionPrompt(textContent)
	response, err := s.callAI(ctx, prompt)
	if err != nil {
		return &TodoExtractionResult{
			Error: fmt.Sprintf("AI request failed: %v", err),
		}, nil
	}

	return s.parseTodoExtractionResponse(response)
}

// AnalyzePeopleMentions analyzes people mentions and relationships in content
func (s *AIService) AnalyzePeopleMentions(ctx context.Context, noteContent models.JSONB, userID uuid.UUID) (*PeopleAnalysisResult, error) {
	if !s.enabled {
		return &PeopleAnalysisResult{
			Error: "AI service not available",
		}, nil
	}

	textContent := s.extractTextFromContent(noteContent)
	if textContent == "" {
		return &PeopleAnalysisResult{
			Mentions:     []AIPersonMention{},
			Relationships: []PersonRelationship{},
		}, nil
	}

	// Get existing people for context
	var existingPeople []models.Person
	s.db.Where("user_id = ?", userID).Find(&existingPeople)

	prompt := s.buildPeopleAnalysisPrompt(textContent, existingPeople)
	response, err := s.callAI(ctx, prompt)
	if err != nil {
		return &PeopleAnalysisResult{
			Error: fmt.Sprintf("AI request failed: %v", err),
		}, nil
	}

	return s.parsePeopleAnalysisResponse(response)
}

// GenerateInsights generates insights from user's knowledge base
func (s *AIService) GenerateInsights(ctx context.Context, userID uuid.UUID, limit int) (*InsightResult, error) {
	if !s.enabled {
		return &InsightResult{
			Error: "AI service not available",
		}, nil
	}

	// Gather user's data for analysis
	userData, err := s.gatherUserData(userID, limit)
	if err != nil {
		return &InsightResult{
			Error: fmt.Sprintf("Failed to gather user data: %v", err),
		}, nil
	}

	prompt := s.buildInsightGenerationPrompt(userData)
	response, err := s.callAI(ctx, prompt)
	if err != nil {
		return &InsightResult{
			Error: fmt.Sprintf("AI request failed: %v", err),
		}, nil
	}

	return s.parseInsightResponse(response)
}

// callAI makes a request to the configured AI provider
func (s *AIService) callAI(ctx context.Context, prompt string) (string, error) {
	switch s.config.Provider {
	case ProviderOpenAI:
		return s.callOpenAI(ctx, prompt)
	case ProviderGemini:
		return s.callGemini(ctx, prompt)
	case ProviderGrok:
		return s.callGrok(ctx, prompt)
	default:
		return "", fmt.Errorf("unsupported AI provider: %s", s.config.Provider)
	}
}

// callOpenAI makes a request to OpenAI API
func (s *AIService) callOpenAI(ctx context.Context, prompt string) (string, error) {
	baseURL := s.config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	model := s.config.Model
	if model == "" {
		model = "gpt-3.5-turbo"
	}

	maxTokens := s.config.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1000
	}

	requestBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"max_tokens":  maxTokens,
		"temperature": 0.7,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/chat/completions", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.config.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Choices) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	return response.Choices[0].Message.Content, nil
}

// callGemini makes a request to Google Gemini API
func (s *AIService) callGemini(ctx context.Context, prompt string) (string, error) {
	baseURL := s.config.BaseURL
	if baseURL == "" {
		baseURL = "https://generativelanguage.googleapis.com/v1beta"
	}

	model := s.config.Model
	if model == "" {
		model = "gemini-pro"
	}

	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]string{
					{
						"text": prompt,
					},
				},
			},
		},
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", baseURL, model, s.config.APIKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var response struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Candidates) == 0 || len(response.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	return response.Candidates[0].Content.Parts[0].Text, nil
}

// callGrok makes a request to Grok API (X.AI)
func (s *AIService) callGrok(ctx context.Context, prompt string) (string, error) {
	baseURL := s.config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.x.ai/v1"
	}

	model := s.config.Model
	if model == "" {
		model = "grok-beta"
	}

	maxTokens := s.config.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1000
	}

	requestBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"max_tokens":  maxTokens,
		"temperature": 0.7,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/chat/completions", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.config.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Choices) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	return response.Choices[0].Message.Content, nil
}

// Helper methods for building prompts and parsing responses

func (s *AIService) buildTodoExtractionPrompt(content string) string {
	return fmt.Sprintf(`
Analyze the following note content and extract actionable todo items. Return a JSON response with the following structure:

{
  "todos": [
    {
      "text": "Complete the task description",
      "assigned_person_id": "person_name_if_mentioned",
      "due_date": "YYYY-MM-DD_if_date_mentioned",
      "priority": "high|medium|low",
      "context": "brief_context_from_note"
    }
  ]
}

Rules:
1. Only extract clear, actionable tasks
2. Include person names if someone is assigned or mentioned in relation to the task
3. Extract dates in YYYY-MM-DD format if mentioned
4. Assign priority based on urgency indicators in the text
5. Provide brief context about where the todo was found

Note content:
%s

Return only valid JSON, no additional text.`, content)
}

func (s *AIService) buildPeopleAnalysisPrompt(content string, existingPeople []models.Person) string {
	peopleNames := make([]string, len(existingPeople))
	for i, person := range existingPeople {
		peopleNames[i] = person.Name
	}

	return fmt.Sprintf(`
Analyze the following note content for people mentions and relationships. Return a JSON response with the following structure:

{
  "mentions": [
    {
      "name": "Person Name",
      "context": "context_where_mentioned",
      "strength": 5
    }
  ],
  "relationships": [
    {
      "person1": "Person A",
      "person2": "Person B", 
      "relationship": "colleague|friend|manager|client|etc",
      "confidence": 0.8
    }
  ]
}

Known people in the system: %s

Rules:
1. Identify all person mentions (names, pronouns referring to people)
2. Rate mention strength 1-10 based on importance in context
3. Identify relationships between people mentioned
4. Use confidence 0.0-1.0 for relationship certainty
5. Match against known people when possible

Note content:
%s

Return only valid JSON, no additional text.`, strings.Join(peopleNames, ", "), content)
}

func (s *AIService) buildInsightGenerationPrompt(userData map[string]interface{}) string {
	userDataJSON, _ := json.Marshal(userData)
	
	return fmt.Sprintf(`
Analyze the following user knowledge base data and generate insights. Return a JSON response with the following structure:

{
  "insights": [
    {
      "type": "pattern|connection|trend|suggestion",
      "title": "Insight Title",
      "description": "Detailed description of the insight",
      "confidence": 0.8,
      "data": {
        "additional": "context_data"
      }
    }
  ]
}

Rules:
1. Identify patterns in note-taking behavior
2. Find interesting connections between people and topics
3. Spot trends over time
4. Suggest improvements or actions
5. Rate confidence 0.0-1.0 for each insight
6. Limit to most valuable insights (max 5)

User data:
%s

Return only valid JSON, no additional text.`, string(userDataJSON))
}

func (s *AIService) parseTodoExtractionResponse(response string) (*TodoExtractionResult, error) {
	var result TodoExtractionResult
	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return &TodoExtractionResult{
			Error: fmt.Sprintf("Failed to parse AI response: %v", err),
		}, nil
	}
	return &result, nil
}

func (s *AIService) parsePeopleAnalysisResponse(response string) (*PeopleAnalysisResult, error) {
	var result PeopleAnalysisResult
	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return &PeopleAnalysisResult{
			Error: fmt.Sprintf("Failed to parse AI response: %v", err),
		}, nil
	}
	return &result, nil
}

func (s *AIService) parseInsightResponse(response string) (*InsightResult, error) {
	var result InsightResult
	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return &InsightResult{
			Error: fmt.Sprintf("Failed to parse AI response: %v", err),
		}, nil
	}
	return &result, nil
}

func (s *AIService) extractTextFromContent(content models.JSONB) string {
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

func (s *AIService) extractTextFromNode(node map[string]interface{}) string {
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

func (s *AIService) gatherUserData(userID uuid.UUID, limit int) (map[string]interface{}, error) {
	data := make(map[string]interface{})
	
	// Get recent notes
	var notes []models.Note
	if err := s.db.Where("user_id = ?", userID).
		Order("updated_at DESC").
		Limit(limit).
		Find(&notes).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch notes: %w", err)
	}
	
	// Get people
	var people []models.Person
	if err := s.db.Where("user_id = ?", userID).Find(&people).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch people: %w", err)
	}
	
	// Get todos
	var todos []models.Todo
	if err := s.db.Joins("JOIN notes ON todos.note_id = notes.id").
		Where("notes.user_id = ?", userID).
		Order("todos.created_at DESC").
		Limit(limit).
		Find(&todos).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch todos: %w", err)
	}
	
	// Get connections
	var connections []models.Connection
	if err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&connections).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch connections: %w", err)
	}
	
	data["notes"] = notes
	data["people"] = people
	data["todos"] = todos
	data["connections"] = connections
	data["summary"] = map[string]int{
		"total_notes":       len(notes),
		"total_people":      len(people),
		"total_todos":       len(todos),
		"total_connections": len(connections),
	}
	
	return data, nil
}
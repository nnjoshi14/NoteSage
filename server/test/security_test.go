package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/router"
)

type SecurityTestSuite struct {
	suite.Suite
	db     *gorm.DB
	router *gin.Engine
	server *httptest.Server
	token  string
}

func (suite *SecurityTestSuite) SetupSuite() {
	// Setup test database
	cfg := &config.Config{
		Database: config.DatabaseConfig{
			Type: "sqlite",
			Name: ":memory:",
		},
		Auth: config.AuthConfig{
			JWTSecret: "test-secret",
		},
		Features: config.FeaturesConfig{
		AI: config.AIConfig{
			Provider: "disabled",
			APIKey:   "",
		},			AIEnabled: false,
		},
	}

	var err error
	suite.db, err = database.Initialize(cfg.Database)
	suite.Require().NoError(err)

	// Run migrations
	err = database.Migrate(suite.db)
	suite.Require().NoError(err)

	// Setup router
	suite.router = router.Setup(suite.db, cfg)
	suite.server = httptest.NewServer(suite.router)

	// Create test user and get auth token
	suite.createTestUser()
}

func (suite *SecurityTestSuite) TearDownSuite() {
	suite.server.Close()
}

func (suite *SecurityTestSuite) createTestUser() {
	user := map[string]interface{}{
		"username": "securitytest",
		"email":    "security@example.com",
		"password": "SecurePassword123!",
	}

	// Create user
	userJSON, _ := json.Marshal(user)
	resp, err := http.Post(suite.server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusCreated, resp.StatusCode)

	// Login to get token
	loginData := map[string]string{
		"username": "securitytest",
		"password": "SecurePassword123!",
	}
	loginJSON, _ := json.Marshal(loginData)
	resp, err = http.Post(suite.server.URL+"/api/auth/login", "application/json", bytes.NewBuffer(loginJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusOK, resp.StatusCode)

	var loginResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResp)
	suite.token = loginResp["token"].(string)
}

func (suite *SecurityTestSuite) makeRequest(method, path string, body interface{}, headers map[string]string) (*http.Response, error) {
	var reqBody *bytes.Buffer
	if body != nil {
		bodyJSON, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(bodyJSON)
	} else {
		reqBody = bytes.NewBuffer([]byte{})
	}

	req, err := http.NewRequest(method, suite.server.URL+path, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{}
	return client.Do(req)
}

func (suite *SecurityTestSuite) makeAuthenticatedRequest(method, path string, body interface{}) (*http.Response, error) {
	return suite.makeRequest(method, path, body, map[string]string{
		"Authorization": "Bearer " + suite.token,
	})
}

// Test authentication and authorization
func (suite *SecurityTestSuite) TestAuthenticationSecurity() {
	// Test accessing protected endpoint without token
	resp, err := suite.makeRequest("GET", "/api/notes", nil, nil)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusUnauthorized, resp.StatusCode)

	// Test with invalid token
	resp, err = suite.makeRequest("GET", "/api/notes", nil, map[string]string{
		"Authorization": "Bearer invalid-token",
	})
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusUnauthorized, resp.StatusCode)

	// Test with malformed token
	resp, err = suite.makeRequest("GET", "/api/notes", nil, map[string]string{
		"Authorization": "Bearer malformed.token.here",
	})
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusUnauthorized, resp.StatusCode)

	// Test with expired token (would need to create an expired token)
	// This is more complex and would require mocking time or creating a token with past expiry
}

// Test SQL injection vulnerabilities
func (suite *SecurityTestSuite) TestSQLInjectionPrevention() {
	// Test SQL injection in search
	maliciousQueries := []string{
		"'; DROP TABLE notes; --",
		"' OR '1'='1",
		"' UNION SELECT * FROM users --",
		"'; INSERT INTO notes (title) VALUES ('hacked'); --",
	}

	for _, query := range maliciousQueries {
		resp, err := suite.makeAuthenticatedRequest("GET", "/api/notes/search?q="+query, nil)
		suite.Require().NoError(err)
		
		// Should return 200 (handled gracefully) but not execute malicious SQL
		suite.Assert().Equal(http.StatusOK, resp.StatusCode)
		
		var searchResult map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&searchResult)
		
		// Should return empty or safe results, not error from SQL injection
		suite.Assert().NotNil(searchResult)
	}

	// Test SQL injection in note creation
	maliciousNote := map[string]interface{}{
		"title": "'; DROP TABLE notes; --",
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": "' OR '1'='1"},
					},
				},
			},
		},
	}

	resp, err := suite.makeAuthenticatedRequest("POST", "/api/notes", maliciousNote)
	suite.Require().NoError(err)
	
	// Should create note safely without executing SQL injection
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)
}

// Test XSS prevention
func (suite *SecurityTestSuite) TestXSSPrevention() {
	xssPayloads := []string{
		"<script>alert('xss')</script>",
		"javascript:alert('xss')",
		"<img src=x onerror=alert('xss')>",
		"<svg onload=alert('xss')>",
		"';alert('xss');//",
	}

	for _, payload := range xssPayloads {
		note := map[string]interface{}{
			"title": "XSS Test: " + payload,
			"content": map[string]interface{}{
				"type": "doc",
				"content": []map[string]interface{}{
					{
						"type": "paragraph",
						"content": []map[string]interface{}{
							{"type": "text", "text": payload},
						},
					},
				},
			},
		}

		resp, err := suite.makeAuthenticatedRequest("POST", "/api/notes", note)
		suite.Require().NoError(err)
		suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

		var createdNote map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&createdNote)

		// Verify XSS payload is stored safely (not executed)
		suite.Assert().Contains(createdNote["title"].(string), payload)
		
		// Get the note back and verify it's still safe
		noteID := createdNote["id"].(string)
		resp, err = suite.makeAuthenticatedRequest("GET", "/api/notes/"+noteID, nil)
		suite.Require().NoError(err)
		suite.Assert().Equal(http.StatusOK, resp.StatusCode)
	}
}

// Test CSRF protection
func (suite *SecurityTestSuite) TestCSRFProtection() {
	// Test that state-changing operations require proper authentication
	// and can't be performed via simple GET requests or cross-origin requests

	// Try to create note via GET (should fail)
	resp, err := suite.makeAuthenticatedRequest("GET", "/api/notes?title=CSRF Test&content=malicious", nil)
	suite.Require().NoError(err)
	suite.Assert().NotEqual(http.StatusCreated, resp.StatusCode)

	// Test with missing Origin header (potential CSRF)
	req, _ := http.NewRequest("POST", suite.server.URL+"/api/notes", bytes.NewBuffer([]byte(`{"title":"CSRF Test"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+suite.token)
	// Deliberately not setting Origin header

	client := &http.Client{}
	resp, err = client.Do(req)
	suite.Require().NoError(err)
	
	// Should still work as we're using JWT tokens, but verify CORS headers are set
	suite.Assert().NotEmpty(resp.Header.Get("Access-Control-Allow-Origin"))
}

// Test input validation
func (suite *SecurityTestSuite) TestInputValidation() {
	// Test oversized input
	largeString := strings.Repeat("A", 100000) // 100KB string
	
	note := map[string]interface{}{
		"title": largeString,
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": largeString},
					},
				},
			},
		},
	}

	resp, err := suite.makeAuthenticatedRequest("POST", "/api/notes", note)
	suite.Require().NoError(err)
	
	// Should either accept it or reject with proper error (not crash)
	suite.Assert().True(resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusBadRequest)

	// Test invalid JSON
	req, _ := http.NewRequest("POST", suite.server.URL+"/api/notes", bytes.NewBuffer([]byte(`{"title": invalid json`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+suite.token)

	client := &http.Client{}
	resp, err = client.Do(req)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusBadRequest, resp.StatusCode)

	// Test null/undefined values
	invalidNote := map[string]interface{}{
		"title": nil,
		"content": nil,
	}

	resp, err = suite.makeAuthenticatedRequest("POST", "/api/notes", invalidNote)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusBadRequest, resp.StatusCode)
}

// Test rate limiting
func (suite *SecurityTestSuite) TestRateLimiting() {
	// Make many requests quickly to test rate limiting
	const numRequests = 100
	const timeWindow = 1 * time.Second

	start := time.Now()
	rateLimitHit := false

	for i := 0; i < numRequests; i++ {
		resp, err := suite.makeAuthenticatedRequest("GET", "/api/notes", nil)
		suite.Require().NoError(err)
		
		if resp.StatusCode == http.StatusTooManyRequests {
			rateLimitHit = true
			break
		}
		
		// If we're taking too long, break to avoid test timeout
		if time.Since(start) > 10*time.Second {
			break
		}
	}

	// Rate limiting should kick in for excessive requests
	// Note: This test might need adjustment based on actual rate limiting configuration
	if !rateLimitHit {
		fmt.Println("Warning: Rate limiting may not be configured or threshold is very high")
	}
}

// Test password security
func (suite *SecurityTestSuite) TestPasswordSecurity() {
	// Test weak password rejection
	weakPasswords := []string{
		"123456",
		"password",
		"qwerty",
		"abc123",
		"",
		"a", // too short
	}

	for _, weakPassword := range weakPasswords {
		user := map[string]interface{}{
			"username": fmt.Sprintf("weakuser_%s", weakPassword),
			"email":    fmt.Sprintf("weak_%s@example.com", weakPassword),
			"password": weakPassword,
		}

		userJSON, _ := json.Marshal(user)
		resp, err := http.Post(suite.server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
		suite.Require().NoError(err)
		
		// Should reject weak passwords
		suite.Assert().Equal(http.StatusBadRequest, resp.StatusCode)
	}

	// Test that passwords are hashed (not stored in plain text)
	// This would require database inspection, which is implementation-specific
}

// Test authorization (user isolation)
func (suite *SecurityTestSuite) TestUserIsolation() {
	// Create second user
	user2 := map[string]interface{}{
		"username": "isolationtest",
		"email":    "isolation@example.com",
		"password": "SecurePassword456!",
	}

	userJSON, _ := json.Marshal(user2)
	resp, err := http.Post(suite.server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusCreated, resp.StatusCode)

	// Login as second user
	loginData := map[string]string{
		"username": "isolationtest",
		"password": "SecurePassword456!",
	}
	loginJSON, _ := json.Marshal(loginData)
	resp, err = http.Post(suite.server.URL+"/api/auth/login", "application/json", bytes.NewBuffer(loginJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusOK, resp.StatusCode)

	var loginResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResp)
	user2Token := loginResp["token"].(string)

	// Create note as first user
	note := map[string]interface{}{
		"title": "Private Note",
		"content": map[string]interface{}{
			"type": "doc",
			"content": []map[string]interface{}{
				{
					"type": "paragraph",
					"content": []map[string]interface{}{
						{"type": "text", "text": "This should be private"},
					},
				},
			},
		},
	}

	resp, err = suite.makeAuthenticatedRequest("POST", "/api/notes", note)
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

	var createdNote map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdNote)
	noteID := createdNote["id"].(string)

	// Try to access note as second user (should fail)
	resp, err = suite.makeRequest("GET", "/api/notes/"+noteID, nil, map[string]string{
		"Authorization": "Bearer " + user2Token,
	})
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusNotFound, resp.StatusCode) // or 403 Forbidden

	// Verify second user can't see first user's notes in list
	resp, err = suite.makeRequest("GET", "/api/notes", nil, map[string]string{
		"Authorization": "Bearer " + user2Token,
	})
	suite.Require().NoError(err)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	var notesList map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&notesList)
	notes := notesList["notes"].([]interface{})
	
	// Should be empty or not contain the private note
	for _, n := range notes {
		noteMap := n.(map[string]interface{})
		suite.Assert().NotEqual(noteID, noteMap["id"])
	}
}

// Test secure headers
func (suite *SecurityTestSuite) TestSecurityHeaders() {
	resp, err := suite.makeRequest("GET", "/api/health", nil, nil)
	suite.Require().NoError(err)

	// Check for security headers
	headers := resp.Header

	// CORS headers
	suite.Assert().NotEmpty(headers.Get("Access-Control-Allow-Origin"))
	
	// Security headers that should be present
	expectedHeaders := []string{
		"X-Content-Type-Options",
		"X-Frame-Options", 
		"X-XSS-Protection",
	}

	for _, header := range expectedHeaders {
		suite.Assert().NotEmpty(headers.Get(header), "Security header %s should be present", header)
	}
}

func TestSecuritySuite(t *testing.T) {
	suite.Run(t, new(SecurityTestSuite))
}
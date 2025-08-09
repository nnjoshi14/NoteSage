package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/router"
)

func setupSecurityTest(t *testing.T) (*httptest.Server, *gorm.DB, string) {
	t.Helper()

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			Type: "sqlite",
			Name: ":memory:", // Use true in-memory database
		},
		Auth: config.AuthConfig{
			JWTSecret:      "test-secret",
			SessionTimeout: 24 * time.Hour,
		},
		Features: config.FeaturesConfig{
			AIEnabled: false,
		},
		AI: config.AIConfig{
			Provider: "disabled",
			APIKey:   "",
		},
	}

	db := database.SetupTestDB(t)

	gin.SetMode(gin.TestMode)
	appRouter := router.Setup(db, cfg)
	server := httptest.NewServer(appRouter)

	// Create test user with correct request structure
	user := map[string]interface{}{
		"username": "securitytest",
		"email":    "security@example.com",
		"password": "SecurePassword123!",
	}

	userJSON, _ := json.Marshal(user)
	resp, err := http.Post(server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	loginData := map[string]string{
		"username": "securitytest",
		"password": "SecurePassword123!",
	}
	loginJSON, _ := json.Marshal(loginData)
	resp, err = http.Post(server.URL+"/api/auth/login", "application/json", bytes.NewBuffer(loginJSON))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var loginResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResp)

	token, ok := loginResp["token"].(string)
	if !ok {
		t.Fatalf("Failed to extract token from response: %+v", loginResp)
	}

	t.Cleanup(func() {
		server.Close()
	})

	return server, db, token
}

func TestSQLInjectionPrevention(t *testing.T) {
	t.Parallel()
	server, _, token := setupSecurityTest(t)

	maliciousQuery := "' OR '1'='1"
	encodedQuery := url.QueryEscape(maliciousQuery)
	resp := makeAuthenticatedRequest(t, server, token, "GET", "/api/notes/search?q="+encodedQuery, nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var searchResult map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&searchResult)
	assert.NotNil(t, searchResult)
	notes, ok := searchResult["notes"].([]interface{})
	require.True(t, ok)
	assert.Empty(t, notes)
}

func TestXSSPrevention(t *testing.T) {
	t.Parallel()
	server, _, token := setupSecurityTest(t)

	xssPayload := "<script>alert('xss')</script>"
	note := map[string]interface{}{
		"title":   "XSS Test",
		"content": map[string]interface{}{"type": "doc", "content": []interface{}{map[string]interface{}{"type": "paragraph", "content": []interface{}{map[string]interface{}{"type": "text", "text": xssPayload}}}}},
	}

	resp := makeAuthenticatedRequest(t, server, token, "POST", "/api/notes", note)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var createdNote map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createdNote)
	noteID := createdNote["id"].(string)

	resp = makeAuthenticatedRequest(t, server, token, "GET", "/api/notes/"+noteID, nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var fetchedNote map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&fetchedNote)

	content, ok := fetchedNote["content"].(map[string]interface{})
	require.True(t, ok)

	contentItems, ok := content["content"].([]interface{})
	require.True(t, ok)

	paragraph, ok := contentItems[0].(map[string]interface{})
	require.True(t, ok)

	textItems, ok := paragraph["content"].([]interface{})
	require.True(t, ok)

	text, ok := textItems[0].(map[string]interface{})
	require.True(t, ok)

	assert.NotContains(t, text["text"], "<script>")
}

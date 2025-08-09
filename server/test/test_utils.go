package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/router"
)

// makeAuthenticatedRequest is a shared utility function for making authenticated HTTP requests
func makeAuthenticatedRequest(t *testing.T, server *httptest.Server, token, method, path string, body interface{}) *http.Response {
	t.Helper()

	var reqBody *bytes.Buffer
	if body != nil {
		bodyJSON, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(bodyJSON)
	} else {
		reqBody = bytes.NewBuffer([]byte{})
	}

	req, err := http.NewRequest(method, server.URL+path, reqBody)
	require.NoError(t, err)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)

	return resp
}

// setupTestServer creates a test server with database and returns server, db, and token
func setupTestServer(t *testing.T, username string) (*httptest.Server, *gorm.DB, string) {
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

	// Create test user
	user := map[string]interface{}{
		"username": username,
		"email":    username + "@example.com",
		"password": "password123",
	}

	userJSON, _ := json.Marshal(user)
	resp, err := http.Post(server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Login to get token
	loginData := map[string]string{
		"username": username,
		"password": "password123",
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
		// Clean up any remaining memory database files
		cleanupMemoryDBFiles()
	})

	return server, db, token
}

// cleanupMemoryDBFiles removes any :memory:.db files that might be left behind
func cleanupMemoryDBFiles() {
	// Remove :memory:.db files and their associated files
	memoryFiles := []string{
		":memory:.db",
		":memory:.db-wal",
		":memory:.db-shm",
	}

	for _, file := range memoryFiles {
		os.Remove(file)
	}

	// Also check for any files matching the pattern in subdirectories
	if matches, err := filepath.Glob("**/:memory:.db*"); err == nil {
		for _, match := range matches {
			os.Remove(match)
		}
	}
}

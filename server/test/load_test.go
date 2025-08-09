package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
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

var (
	loadTestServer *httptest.Server
	loadTestDB     *gorm.DB
	loadTestOnce   sync.Once
)

func setupLoadTest(t *testing.T) {
	t.Helper()

	loadTestOnce.Do(func() {
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

		// Use SetupTestDB to ensure proper database setup with migrations
		loadTestDB = database.SetupTestDB(t)

		gin.SetMode(gin.TestMode)
		appRouter := router.Setup(loadTestDB, cfg)
		loadTestServer = httptest.NewServer(appRouter)
	})
}

func createLoadTestUser(t *testing.T, username string) string {
	t.Helper()

	user := map[string]interface{}{
		"username": username,
		"email":    fmt.Sprintf("%s@example.com", username),
		"password": "password123",
	}

	userJSON, _ := json.Marshal(user)
	resp, err := http.Post(loadTestServer.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	loginData := map[string]string{
		"username": username,
		"password": "password123",
	}
	loginJSON, _ := json.Marshal(loginData)
	resp, err = http.Post(loadTestServer.URL+"/api/auth/login", "application/json", bytes.NewBuffer(loginJSON))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var loginResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResp)

	token, ok := loginResp["token"].(string)
	if !ok {
		t.Fatalf("Failed to extract token from response: %+v", loginResp)
	}
	return token
}

func makeLoadTestRequest(t *testing.T, token, method, path string, body interface{}) *http.Response {
	t.Helper()

	var reqBody *bytes.Buffer
	if body != nil {
		bodyJSON, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(bodyJSON)
	} else {
		reqBody = bytes.NewBuffer([]byte{})
	}

	req, err := http.NewRequest(method, loadTestServer.URL+path, reqBody)
	require.NoError(t, err)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	require.NoError(t, err)

	return resp
}

func TestConcurrentNoteCreation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping load tests in short mode")
	}
	t.Parallel()
	setupLoadTest(t)

	numUsers := 10
	notesPerUser := 5
	var wg sync.WaitGroup

	// Add timestamp to make usernames unique across test runs
	timestamp := time.Now().UnixNano()

	tokens := make([]string, numUsers)
	for i := 0; i < numUsers; i++ {
		username := fmt.Sprintf("loaduser%d_%d", i, timestamp)
		tokens[i] = createLoadTestUser(t, username)
	}

	for i := 0; i < numUsers; i++ {
		wg.Add(1)
		go func(userIndex int, token string) {
			defer wg.Done()
			for j := 0; j < notesPerUser; j++ {
				note := map[string]interface{}{
					"title": fmt.Sprintf("Load Test Note %d-%d", userIndex, j),
				}
				resp := makeLoadTestRequest(t, token, "POST", "/api/notes", note)
				assert.Equal(t, http.StatusCreated, resp.StatusCode)
			}
		}(i, tokens[i])
	}

	wg.Wait()
}

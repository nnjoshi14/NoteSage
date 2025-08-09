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
	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/router"
)

type LoadTestSuite struct {
	suite.Suite
	db     *gorm.DB
	router *gin.Engine
	server *httptest.Server
}

func (suite *LoadTestSuite) SetupSuite() {
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
			AIEnabled: false,
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
}

func (suite *LoadTestSuite) TearDownSuite() {
	suite.server.Close()
}

func (suite *LoadTestSuite) createTestUser(username string) string {
	user := map[string]interface{}{
		"username": username,
		"email":    fmt.Sprintf("%s@example.com", username),
		"password": "password123",
	}

	// Create user
	userJSON, _ := json.Marshal(user)
	resp, err := http.Post(suite.server.URL+"/api/auth/register", "application/json", bytes.NewBuffer(userJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusCreated, resp.StatusCode)

	// Login to get token
	loginData := map[string]string{
		"username": username,
		"password": "password123",
	}
	loginJSON, _ := json.Marshal(loginData)
	resp, err = http.Post(suite.server.URL+"/api/auth/login", "application/json", bytes.NewBuffer(loginJSON))
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusOK, resp.StatusCode)

	var loginResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResp)
	return loginResp["token"].(string)
}

func (suite *LoadTestSuite) makeAuthenticatedRequest(token, method, path string, body interface{}) (*http.Response, error) {
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
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	return client.Do(req)
}

// Test concurrent note creation
func (suite *LoadTestSuite) TestConcurrentNoteCreation() {
	numUsers := 10
	notesPerUser := 5
	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]TestResult, 0)

	// Create test users
	tokens := make([]string, numUsers)
	for i := 0; i < numUsers; i++ {
		tokens[i] = suite.createTestUser(fmt.Sprintf("loaduser%d", i))
	}

	startTime := time.Now()

	for i := 0; i < numUsers; i++ {
		wg.Add(1)
		go func(userIndex int, token string) {
			defer wg.Done()
			
			userResults := make([]TestResult, 0)
			for j := 0; j < notesPerUser; j++ {
				note := map[string]interface{}{
					"title": fmt.Sprintf("Load Test Note %d-%d", userIndex, j),
					"content": map[string]interface{}{
						"type": "doc",
						"content": []map[string]interface{}{
							{
								"type": "paragraph",
								"content": []map[string]interface{}{
									{"type": "text", "text": fmt.Sprintf("Content for user %d note %d", userIndex, j)},
								},
							},
						},
					},
					"category": "Note",
				}

				reqStart := time.Now()
				resp, err := suite.makeAuthenticatedRequest(token, "POST", "/api/notes", note)
				reqDuration := time.Since(reqStart)

				result := TestResult{
					UserID:      userIndex,
					Operation:   "CREATE_NOTE",
					Duration:    reqDuration,
					Success:     err == nil && resp.StatusCode == http.StatusCreated,
					StatusCode:  0,
				}

				if resp != nil {
					result.StatusCode = resp.StatusCode
					resp.Body.Close()
				}

				userResults = append(userResults, result)
			}

			mu.Lock()
			results = append(results, userResults...)
			mu.Unlock()
		}(i, tokens[i])
	}

	wg.Wait()
	totalDuration := time.Since(startTime)

	// Analyze results
	suite.analyzeLoadTestResults("Concurrent Note Creation", results, totalDuration)
}

// Test concurrent note reading
func (suite *LoadTestSuite) TestConcurrentNoteReading() {
	numUsers := 20
	readsPerUser := 10
	
	// First create some notes to read
	token := suite.createTestUser("setupuser")
	noteIDs := make([]string, 10)
	
	for i := 0; i < 10; i++ {
		note := map[string]interface{}{
			"title": fmt.Sprintf("Read Test Note %d", i),
			"content": map[string]interface{}{
				"type": "doc",
				"content": []map[string]interface{}{
					{
						"type": "paragraph",
						"content": []map[string]interface{}{
							{"type": "text", "text": fmt.Sprintf("Content for note %d", i)},
						},
					},
				},
			},
		}

		resp, err := suite.makeAuthenticatedRequest(token, "POST", "/api/notes", note)
		suite.Require().NoError(err)
		
		var createdNote map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&createdNote)
		noteIDs[i] = createdNote["id"].(string)
		resp.Body.Close()
	}

	// Create test users for reading
	tokens := make([]string, numUsers)
	for i := 0; i < numUsers; i++ {
		tokens[i] = suite.createTestUser(fmt.Sprintf("readuser%d", i))
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]TestResult, 0)

	startTime := time.Now()

	for i := 0; i < numUsers; i++ {
		wg.Add(1)
		go func(userIndex int, token string) {
			defer wg.Done()
			
			for j := 0; j < readsPerUser; j++ {
				noteID := noteIDs[j%len(noteIDs)]
				
				reqStart := time.Now()
				resp, err := suite.makeAuthenticatedRequest(token, "GET", "/api/notes/"+noteID, nil)
				reqDuration := time.Since(reqStart)

				result := TestResult{
					UserID:      userIndex,
					Operation:   "READ_NOTE",
					Duration:    reqDuration,
					Success:     err == nil && resp.StatusCode == http.StatusOK,
					StatusCode:  0,
				}

				if resp != nil {
					result.StatusCode = resp.StatusCode
					resp.Body.Close()
				}

				mu.Lock()
				results = append(results, result)
				mu.Unlock()
			}
		}(i, tokens[i])
	}

	wg.Wait()
	totalDuration := time.Since(startTime)

	suite.analyzeLoadTestResults("Concurrent Note Reading", results, totalDuration)
}

// Test concurrent search operations
func (suite *LoadTestSuite) TestConcurrentSearch() {
	numUsers := 15
	searchesPerUser := 8

	// Create test users
	tokens := make([]string, numUsers)
	for i := 0; i < numUsers; i++ {
		tokens[i] = suite.createTestUser(fmt.Sprintf("searchuser%d", i))
	}

	// Create some searchable content
	setupToken := tokens[0]
	searchTerms := []string{"integration", "testing", "load", "performance", "concurrent"}
	
	for _, term := range searchTerms {
		note := map[string]interface{}{
			"title": fmt.Sprintf("Search Test - %s", term),
			"content": map[string]interface{}{
				"type": "doc",
				"content": []map[string]interface{}{
					{
						"type": "paragraph",
						"content": []map[string]interface{}{
							{"type": "text", "text": fmt.Sprintf("This note contains the term %s for search testing", term)},
						},
					},
				},
			},
		}

		resp, err := suite.makeAuthenticatedRequest(setupToken, "POST", "/api/notes", note)
		suite.Require().NoError(err)
		resp.Body.Close()
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]TestResult, 0)

	startTime := time.Now()

	for i := 0; i < numUsers; i++ {
		wg.Add(1)
		go func(userIndex int, token string) {
			defer wg.Done()
			
			for j := 0; j < searchesPerUser; j++ {
				searchTerm := searchTerms[j%len(searchTerms)]
				
				reqStart := time.Now()
				resp, err := suite.makeAuthenticatedRequest(token, "GET", fmt.Sprintf("/api/notes/search?q=%s", searchTerm), nil)
				reqDuration := time.Since(reqStart)

				result := TestResult{
					UserID:      userIndex,
					Operation:   "SEARCH_NOTES",
					Duration:    reqDuration,
					Success:     err == nil && resp.StatusCode == http.StatusOK,
					StatusCode:  0,
				}

				if resp != nil {
					result.StatusCode = resp.StatusCode
					resp.Body.Close()
				}

				mu.Lock()
				results = append(results, result)
				mu.Unlock()
			}
		}(i, tokens[i])
	}

	wg.Wait()
	totalDuration := time.Since(startTime)

	suite.analyzeLoadTestResults("Concurrent Search", results, totalDuration)
}

type TestResult struct {
	UserID     int
	Operation  string
	Duration   time.Duration
	Success    bool
	StatusCode int
}

func (suite *LoadTestSuite) analyzeLoadTestResults(testName string, results []TestResult, totalDuration time.Duration) {
	totalRequests := len(results)
	successfulRequests := 0
	var totalResponseTime time.Duration
	var minResponseTime, maxResponseTime time.Duration
	
	if totalRequests > 0 {
		minResponseTime = results[0].Duration
		maxResponseTime = results[0].Duration
	}

	for _, result := range results {
		if result.Success {
			successfulRequests++
		}
		
		totalResponseTime += result.Duration
		
		if result.Duration < minResponseTime {
			minResponseTime = result.Duration
		}
		if result.Duration > maxResponseTime {
			maxResponseTime = result.Duration
		}
	}

	successRate := float64(successfulRequests) / float64(totalRequests) * 100
	avgResponseTime := totalResponseTime / time.Duration(totalRequests)
	requestsPerSecond := float64(totalRequests) / totalDuration.Seconds()

	fmt.Printf("\n=== %s Load Test Results ===\n", testName)
	fmt.Printf("Total Requests: %d\n", totalRequests)
	fmt.Printf("Successful Requests: %d\n", successfulRequests)
	fmt.Printf("Success Rate: %.2f%%\n", successRate)
	fmt.Printf("Total Duration: %v\n", totalDuration)
	fmt.Printf("Requests/Second: %.2f\n", requestsPerSecond)
	fmt.Printf("Average Response Time: %v\n", avgResponseTime)
	fmt.Printf("Min Response Time: %v\n", minResponseTime)
	fmt.Printf("Max Response Time: %v\n", maxResponseTime)
	fmt.Printf("=====================================\n")

	// Assertions for performance requirements
	suite.Assert().GreaterOrEqual(successRate, 95.0, "Success rate should be at least 95%")
	suite.Assert().Less(avgResponseTime, 2*time.Second, "Average response time should be less than 2 seconds")
	suite.Assert().Less(maxResponseTime, 10*time.Second, "Max response time should be less than 10 seconds")
}

func TestLoadTestSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping load tests in short mode")
	}
	suite.Run(t, new(LoadTestSuite))
}
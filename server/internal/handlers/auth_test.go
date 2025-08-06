package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notesage-server/internal/config"
	"notesage-server/internal/middleware"
	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type AuthHandlerTestSuite struct {
	suite.Suite
	db      *gorm.DB
	handler *AuthHandler
	router  *gin.Engine
	cfg     *config.Config
}

func (suite *AuthHandlerTestSuite) SetupTest() {
	// Setup in-memory SQLite database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	suite.Require().NoError(err)

	// Auto-migrate
	err = db.AutoMigrate(&models.User{})
	suite.Require().NoError(err)

	suite.db = db

	// Setup config
	suite.cfg = &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:      "test-secret",
			SessionTimeout: 24 * time.Hour,
		},
	}

	// Setup handler and router
	suite.handler = NewAuthHandler(db, suite.cfg)
	gin.SetMode(gin.TestMode)
	suite.router = gin.New()
	
	// Public routes
	suite.router.POST("/register", suite.handler.Register)
	suite.router.POST("/login", suite.handler.Login)
	
	// Protected routes
	protected := suite.router.Group("/")
	protected.Use(middleware.AuthMiddleware(suite.cfg.Auth.JWTSecret))
	{
		protected.GET("/profile", suite.handler.GetProfile)
		protected.PUT("/profile", suite.handler.UpdateProfile)
		protected.POST("/change-password", suite.handler.ChangePassword)
		
		// Admin routes
		admin := protected.Group("/")
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/users", suite.handler.GetUsers)
			admin.POST("/users", suite.handler.CreateUser)
			admin.PUT("/users/:id", suite.handler.UpdateUser)
			admin.DELETE("/users/:id", suite.handler.DeleteUser)
		}
	}
}

func (suite *AuthHandlerTestSuite) TestRegister() {
	reqBody := RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	var response AuthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), response.Token)
	assert.Equal(suite.T(), "testuser", response.User.Username)
	assert.Equal(suite.T(), "test@example.com", response.User.Email)
	assert.Equal(suite.T(), models.RoleUser, response.User.Role)
	assert.True(suite.T(), response.User.IsActive)
	assert.NotZero(suite.T(), response.ExpiresAt)
}

func (suite *AuthHandlerTestSuite) TestRegisterDuplicateUser() {
	// Register first user
	reqBody := RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	// Try to register same user again
	jsonBody2, _ := json.Marshal(reqBody)
	req2, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody2))
	req2.Header.Set("Content-Type", "application/json")
	
	w2 := httptest.NewRecorder()
	suite.router.ServeHTTP(w2, req2)
	assert.Equal(suite.T(), http.StatusConflict, w2.Code)
}

func (suite *AuthHandlerTestSuite) TestLogin() {
	// First register a user
	reqBody := RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	// Now test login with username
	loginReq := LoginRequest{
		Username: "testuser",
		Password: "password123",
	}

	jsonBody, _ = json.Marshal(loginReq)
	req, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response AuthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), response.Token)
	assert.Equal(suite.T(), "testuser", response.User.Username)
	assert.NotNil(suite.T(), response.User.LastLogin)
}

func (suite *AuthHandlerTestSuite) TestLoginWithEmail() {
	// First register a user
	reqBody := RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	// Now test login with email
	loginReq := LoginRequest{
		Username: "test@example.com", // Using email as username
		Password: "password123",
	}

	jsonBody, _ = json.Marshal(loginReq)
	req, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)
}

func (suite *AuthHandlerTestSuite) TestLoginInvalidCredentials() {
	loginReq := LoginRequest{
		Username: "nonexistent",
		Password: "wrongpassword",
	}

	jsonBody, _ := json.Marshal(loginReq)
	req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

func (suite *AuthHandlerTestSuite) TestGetProfile() {
	// Create and login user
	token := suite.createUserAndGetToken("testuser", "test@example.com", "password123")

	req, _ := http.NewRequest("GET", "/profile", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	
	user := response["user"].(map[string]interface{})
	assert.Equal(suite.T(), "testuser", user["username"])
	assert.Equal(suite.T(), "test@example.com", user["email"])
}

func (suite *AuthHandlerTestSuite) TestUpdateProfile() {
	// Create and login user
	token := suite.createUserAndGetToken("testuser", "test@example.com", "password123")

	updateReq := UpdateUserRequest{
		Email: "newemail@example.com",
	}

	jsonBody, _ := json.Marshal(updateReq)
	req, _ := http.NewRequest("PUT", "/profile", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	
	user := response["user"].(map[string]interface{})
	assert.Equal(suite.T(), "newemail@example.com", user["email"])
}

func (suite *AuthHandlerTestSuite) TestChangePassword() {
	// Create and login user
	token := suite.createUserAndGetToken("testuser", "test@example.com", "password123")

	changeReq := ChangePasswordRequest{
		CurrentPassword: "password123",
		NewPassword:     "newpassword123",
	}

	jsonBody, _ := json.Marshal(changeReq)
	req, _ := http.NewRequest("POST", "/change-password", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Test login with new password
	loginReq := LoginRequest{
		Username: "testuser",
		Password: "newpassword123",
	}

	jsonBody, _ = json.Marshal(loginReq)
	req, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)
}

func (suite *AuthHandlerTestSuite) TestAdminCreateUser() {
	// Create admin user
	adminToken := suite.createAdminUserAndGetToken("admin", "admin@example.com", "password123")

	createReq := CreateUserRequest{
		Username: "newuser",
		Email:    "newuser@example.com",
		Password: "password123",
		Role:     models.RoleUser,
	}

	jsonBody, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", "/users", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+adminToken)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	
	user := response["user"].(map[string]interface{})
	assert.Equal(suite.T(), "newuser", user["username"])
	assert.Equal(suite.T(), "user", user["role"])
}

func (suite *AuthHandlerTestSuite) TestNonAdminCannotCreateUser() {
	// Create regular user
	userToken := suite.createUserAndGetToken("user", "user@example.com", "password123")

	createReq := CreateUserRequest{
		Username: "newuser",
		Email:    "newuser@example.com",
		Password: "password123",
	}

	jsonBody, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", "/users", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+userToken)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusForbidden, w.Code)
}

func (suite *AuthHandlerTestSuite) TestGetUsers() {
	// Create admin user
	adminToken := suite.createAdminUserAndGetToken("admin", "admin@example.com", "password123")

	req, _ := http.NewRequest("GET", "/users", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response UserListResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), response.Total)
	assert.Len(suite.T(), response.Users, 1)
}

// Helper methods
func (suite *AuthHandlerTestSuite) createUserAndGetToken(username, email, password string) string {
	reqBody := RegisterRequest{
		Username: username,
		Email:    email,
		Password: password,
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	var response AuthResponse
	json.Unmarshal(w.Body.Bytes(), &response)
	return response.Token
}

func (suite *AuthHandlerTestSuite) createAdminUserAndGetToken(username, email, password string) string {
	// Create admin user directly in database
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	user := models.User{
		Username: username,
		Email:    email,
		Password: string(hashedPassword),
		Role:     models.RoleAdmin,
		IsActive: true,
	}
	suite.db.Create(&user)

	// Generate token
	token, _, _ := suite.handler.generateToken(user)
	return token
}

func TestAuthHandlerSuite(t *testing.T) {
	suite.Run(t, new(AuthHandlerTestSuite))
}
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/middleware"
	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
)

func setupAuthRouter(t *testing.T) (*gin.Engine, *AuthHandler) {
	t.Helper()

	db := database.SetupTestDB(t)
	cfg := &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:      "test-secret",
			SessionTimeout: 24 * time.Hour,
		},
	}

	handler := NewAuthHandler(db, cfg)
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Public routes
	router.POST("/register", handler.Register)
	router.POST("/login", handler.Login)

	// Protected routes
	protected := router.Group("/")
	protected.Use(middleware.AuthMiddleware(cfg.Auth.JWTSecret))
	{
		protected.GET("/profile", handler.GetProfile)
		protected.PUT("/profile", handler.UpdateProfile)
		protected.POST("/change-password", handler.ChangePassword)

		// Admin routes
		admin := protected.Group("/")
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/users", handler.GetUsers)
			admin.POST("/users", handler.CreateUser)
			admin.PUT("/users/:id", handler.UpdateUser)
			admin.DELETE("/users/:id", handler.DeleteUser)
		}
	}

	return router, handler
}

func TestRegister(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

	reqBody := RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response AuthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.NotEmpty(t, response.Token)
	assert.Equal(t, "testuser", response.User.Username)
	assert.Equal(t, "test@example.com", response.User.Email)
	assert.Equal(t, models.RoleUser, response.User.Role)
	assert.True(t, response.User.IsActive)
	assert.NotZero(t, response.ExpiresAt)
}

func TestRegisterDuplicateUser(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

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
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	// Try to register same user again
	jsonBody2, _ := json.Marshal(reqBody)
	req2, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody2))
	req2.Header.Set("Content-Type", "application/json")

	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusConflict, w2.Code)
}

func TestLogin(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

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
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	// Now test login with username
	loginReq := LoginRequest{
		Username: "testuser",
		Password: "password123",
	}

	jsonBody, _ = json.Marshal(loginReq)
	req, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response AuthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.NotEmpty(t, response.Token)
	assert.Equal(t, "testuser", response.User.Username)
	assert.NotNil(t, response.User.LastLogin)
}

func TestLoginWithEmail(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

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
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	// Now test login with email
	loginReq := LoginRequest{
		Username: "test@example.com", // Using email as username
		Password: "password123",
	}

	jsonBody, _ = json.Marshal(loginReq)
	req, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestLoginInvalidCredentials(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

	loginReq := LoginRequest{
		Username: "nonexistent",
		Password: "wrongpassword",
	}

	jsonBody, _ := json.Marshal(loginReq)
	req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestGetProfile(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

	// Create and login user
	token := createUserAndGetToken(t, router, "testuser", "test@example.com", "password123")

	req, _ := http.NewRequest("GET", "/profile", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	user := response["user"].(map[string]interface{})
	assert.Equal(t, "testuser", user["username"])
	assert.Equal(t, "test@example.com", user["email"])
}

func TestUpdateProfile(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

	// Create and login user
	token := createUserAndGetToken(t, router, "testuser", "test@example.com", "password123")

	updateReq := UpdateUserRequest{
		Email: "newemail@example.com",
	}

	jsonBody, _ := json.Marshal(updateReq)
	req, _ := http.NewRequest("PUT", "/profile", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	user := response["user"].(map[string]interface{})
	assert.Equal(t, "newemail@example.com", user["email"])
}

func TestChangePassword(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

	// Create and login user
	token := createUserAndGetToken(t, router, "testuser", "test@example.com", "password123")

	changeReq := ChangePasswordRequest{
		CurrentPassword: "password123",
		NewPassword:     "newpassword123",
	}

	jsonBody, _ := json.Marshal(changeReq)
	req, _ := http.NewRequest("POST", "/change-password", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Test login with new password
	loginReq := LoginRequest{
		Username: "testuser",
		Password: "newpassword123",
	}

	jsonBody, _ = json.Marshal(loginReq)
	req, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminCreateUser(t *testing.T) {
	t.Parallel()
	router, handler := setupAuthRouter(t)

	// Create admin user
	adminToken := createAdminUserAndGetToken(t, handler, "admin", "admin@example.com", "password123")

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
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	user := response["user"].(map[string]interface{})
	assert.Equal(t, "newuser", user["username"])
	assert.Equal(t, "user", user["role"])
}

func TestNonAdminCannotCreateUser(t *testing.T) {
	t.Parallel()
	router, _ := setupAuthRouter(t)

	// Create regular user
	userToken := createUserAndGetToken(t, router, "user", "user@example.com", "password123")

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
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestGetUsers(t *testing.T) {
	t.Parallel()
	router, handler := setupAuthRouter(t)

	// Create admin user
	adminToken := createAdminUserAndGetToken(t, handler, "admin", "admin@example.com", "password123")

	req, _ := http.NewRequest("GET", "/users", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response UserListResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), response.Total)
	assert.Len(t, response.Users, 1)
}

// Helper methods
func createUserAndGetToken(t *testing.T, router *gin.Engine, username, email, password string) string {
	t.Helper()
	reqBody := RegisterRequest{
		Username: username,
		Email:    email,
		Password: password,
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var response AuthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	return response.Token
}

func createAdminUserAndGetToken(t *testing.T, handler *AuthHandler, username, email, password string) string {
	t.Helper()
	// Create admin user directly in database
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	user := models.User{
		Username: username,
		Email:    email,
		Password: string(hashedPassword),
		Role:     models.RoleAdmin,
		IsActive: true,
	}
	handler.db.Create(&user)

	// Generate token
	token, _, _ := handler.generateToken(user)
	return token
}

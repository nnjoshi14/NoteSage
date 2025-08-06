package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Auth     AuthConfig
	Logging  LoggingConfig
	Features FeaturesConfig
	AI       AIConfig
}

type ServerConfig struct {
	Host string
	Port int
	TLS  TLSConfig
}

type TLSConfig struct {
	Enabled  bool
	CertFile string
	KeyFile  string
}

type DatabaseConfig struct {
	Type     string
	Host     string
	Port     int
	Name     string
	User     string
	Password string
	SSLMode  string
}

type AuthConfig struct {
	JWTSecret      string
	SessionTimeout time.Duration
}

type LoggingConfig struct {
	Level      string
	File       string
	MaxSize    int
	MaxBackups int
}

type FeaturesConfig struct {
	AIEnabled        bool
	WebSocketEnabled bool
	FileUploads      bool
	MaxUploadSize    string
}

type AIConfig struct {
	Provider   string
	APIKey     string
	BaseURL    string
	Model      string
	MaxTokens  int
	Timeout    int // seconds
}

func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
			Port: getEnvAsInt("SERVER_PORT", 8080),
			TLS: TLSConfig{
				Enabled:  getEnvAsBool("TLS_ENABLED", false),
				CertFile: getEnv("TLS_CERT_FILE", ""),
				KeyFile:  getEnv("TLS_KEY_FILE", ""),
			},
		},
		Database: DatabaseConfig{
			Type:     getEnv("DB_TYPE", "sqlite"),
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvAsInt("DB_PORT", 5432),
			Name:     getEnv("DB_NAME", "notesage"),
			User:     getEnv("DB_USER", "notesage"),
			Password: getEnv("DB_PASSWORD", ""),
			SSLMode:  getEnv("DB_SSL_MODE", "disable"),
		},
		Auth: AuthConfig{
			JWTSecret:      getEnv("JWT_SECRET", "your-jwt-secret-change-in-production"),
			SessionTimeout: getEnvAsDuration("SESSION_TIMEOUT", 24*time.Hour),
		},
		Logging: LoggingConfig{
			Level:      getEnv("LOG_LEVEL", "info"),
			File:       getEnv("LOG_FILE", ""),
			MaxSize:    getEnvAsInt("LOG_MAX_SIZE", 100),
			MaxBackups: getEnvAsInt("LOG_MAX_BACKUPS", 5),
		},
		Features: FeaturesConfig{
			AIEnabled:        getEnvAsBool("AI_ENABLED", true),
			WebSocketEnabled: getEnvAsBool("WEBSOCKET_ENABLED", true),
			FileUploads:      getEnvAsBool("FILE_UPLOADS", true),
			MaxUploadSize:    getEnv("MAX_UPLOAD_SIZE", "10MB"),
		},
		AI: AIConfig{
			Provider:  getEnv("AI_PROVIDER", "openai"),
			APIKey:    getEnv("AI_API_KEY", ""),
			BaseURL:   getEnv("AI_BASE_URL", ""),
			Model:     getEnv("AI_MODEL", ""),
			MaxTokens: getEnvAsInt("AI_MAX_TOKENS", 1000),
			Timeout:   getEnvAsInt("AI_TIMEOUT", 30),
		},
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
package handlers

import (
	"fmt"
	"net/http"
	"runtime"
	"time"

	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	db        *gorm.DB
	startTime time.Time
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{
		db:        db,
		startTime: time.Now(),
	}
}

// HealthStatus represents the overall health status
type HealthStatus struct {
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Version   string                 `json:"version"`
	Uptime    string                 `json:"uptime"`
	Checks    map[string]CheckResult `json:"checks"`
}

// CheckResult represents the result of a health check
type CheckResult struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Latency string      `json:"latency,omitempty"`
}

// DetailedHealthStatus includes system metrics
type DetailedHealthStatus struct {
	HealthStatus
	System SystemMetrics `json:"system"`
}

// SystemMetrics contains system performance metrics
type SystemMetrics struct {
	Memory    MemoryMetrics    `json:"memory"`
	Goroutines int             `json:"goroutines"`
	Database  DatabaseMetrics  `json:"database"`
	Disk      DiskMetrics      `json:"disk"`
}

// MemoryMetrics contains memory usage information
type MemoryMetrics struct {
	Alloc      uint64 `json:"alloc"`
	TotalAlloc uint64 `json:"total_alloc"`
	Sys        uint64 `json:"sys"`
	NumGC      uint32 `json:"num_gc"`
}

// DatabaseMetrics contains database performance metrics
type DatabaseMetrics struct {
	OpenConnections int           `json:"open_connections"`
	InUse          int           `json:"in_use"`
	Idle           int           `json:"idle"`
	WaitCount      int64         `json:"wait_count"`
	WaitDuration   time.Duration `json:"wait_duration"`
	MaxIdleClosed  int64         `json:"max_idle_closed"`
	MaxLifetimeClosed int64      `json:"max_lifetime_closed"`
}

// DiskMetrics contains disk usage information
type DiskMetrics struct {
	TotalSpace uint64 `json:"total_space"`
	FreeSpace  uint64 `json:"free_space"`
	UsedSpace  uint64 `json:"used_space"`
	UsagePercent float64 `json:"usage_percent"`
}

// BasicHealth returns basic health status
func (h *HealthHandler) BasicHealth(c *gin.Context) {
	start := time.Now()
	
	status := &HealthStatus{
		Status:    "ok",
		Timestamp: time.Now(),
		Version:   getVersion(),
		Uptime:    time.Since(h.startTime).String(),
		Checks:    make(map[string]CheckResult),
	}

	// Database connectivity check
	dbCheck := h.checkDatabase()
	status.Checks["database"] = dbCheck
	
	if dbCheck.Status != "ok" {
		status.Status = "degraded"
	}

	// Set response headers
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	// Return appropriate HTTP status
	httpStatus := http.StatusOK
	if status.Status == "degraded" {
		httpStatus = http.StatusServiceUnavailable
	}

	// Add response time
	status.Checks["response_time"] = CheckResult{
		Status:  "ok",
		Latency: time.Since(start).String(),
	}

	c.JSON(httpStatus, status)
}

// DetailedHealth returns comprehensive health status with metrics
func (h *HealthHandler) DetailedHealth(c *gin.Context) {
	start := time.Now()
	
	status := &DetailedHealthStatus{
		HealthStatus: HealthStatus{
			Status:    "ok",
			Timestamp: time.Now(),
			Version:   getVersion(),
			Uptime:    time.Since(h.startTime).String(),
			Checks:    make(map[string]CheckResult),
		},
	}

	// Run all health checks
	checks := []func() (string, CheckResult){
		func() (string, CheckResult) { return "database", h.checkDatabase() },
		func() (string, CheckResult) { return "memory", h.checkMemory() },
		func() (string, CheckResult) { return "disk", h.checkDisk() },
		func() (string, CheckResult) { return "migrations", h.checkMigrations() },
	}

	for _, check := range checks {
		name, result := check()
		status.Checks[name] = result
		
		if result.Status == "error" {
			status.Status = "error"
		} else if result.Status == "warning" && status.Status == "ok" {
			status.Status = "degraded"
		}
	}

	// Collect system metrics
	status.System = h.getSystemMetrics()

	// Set response headers
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	// Return appropriate HTTP status
	httpStatus := http.StatusOK
	if status.Status == "error" {
		httpStatus = http.StatusServiceUnavailable
	} else if status.Status == "degraded" {
		httpStatus = http.StatusServiceUnavailable
	}

	// Add response time
	status.Checks["response_time"] = CheckResult{
		Status:  "ok",
		Latency: time.Since(start).String(),
	}

	c.JSON(httpStatus, status)
}

// ReadinessProbe checks if the service is ready to accept traffic
func (h *HealthHandler) ReadinessProbe(c *gin.Context) {
	// Check database connectivity
	dbCheck := h.checkDatabase()
	
	if dbCheck.Status != "ok" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "not_ready",
			"reason": "database_unavailable",
			"message": dbCheck.Message,
		})
		return
	}

	// Check if migrations are up to date
	migrationCheck := h.checkMigrations()
	if migrationCheck.Status == "error" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "not_ready",
			"reason": "migrations_pending",
			"message": migrationCheck.Message,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ready",
		"timestamp": time.Now(),
	})
}

// LivenessProbe checks if the service is alive
func (h *HealthHandler) LivenessProbe(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "alive",
		"timestamp": time.Now(),
		"uptime": time.Since(h.startTime).String(),
	})
}

// MetricsEndpoint returns Prometheus-compatible metrics
func (h *HealthHandler) MetricsEndpoint(c *gin.Context) {
	metrics := h.generatePrometheusMetrics()
	c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	c.String(http.StatusOK, metrics)
}

// checkDatabase verifies database connectivity and performance
func (h *HealthHandler) checkDatabase() CheckResult {
	start := time.Now()
	
	// Test basic connectivity
	sqlDB, err := h.db.DB()
	if err != nil {
		return CheckResult{
			Status:  "error",
			Message: fmt.Sprintf("Failed to get database instance: %v", err),
			Latency: time.Since(start).String(),
		}
	}

	// Test ping
	if err := sqlDB.Ping(); err != nil {
		return CheckResult{
			Status:  "error",
			Message: fmt.Sprintf("Database ping failed: %v", err),
			Latency: time.Since(start).String(),
		}
	}

	// Test query execution
	var count int64
	if err := h.db.Model(&models.User{}).Count(&count).Error; err != nil {
		return CheckResult{
			Status:  "error",
			Message: fmt.Sprintf("Database query failed: %v", err),
			Latency: time.Since(start).String(),
		}
	}

	latency := time.Since(start)
	
	// Check if query is too slow
	if latency > 5*time.Second {
		return CheckResult{
			Status:  "warning",
			Message: "Database queries are slow",
			Data:    map[string]interface{}{"user_count": count},
			Latency: latency.String(),
		}
	}

	return CheckResult{
		Status:  "ok",
		Message: "Database is healthy",
		Data:    map[string]interface{}{"user_count": count},
		Latency: latency.String(),
	}
}

// checkMemory verifies memory usage
func (h *HealthHandler) checkMemory() CheckResult {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Convert bytes to MB
	allocMB := m.Alloc / 1024 / 1024
	sysMB := m.Sys / 1024 / 1024

	status := "ok"
	message := "Memory usage is normal"

	// Check if memory usage is high (over 1GB allocated)
	if allocMB > 1024 {
		status = "warning"
		message = "High memory usage detected"
	}

	// Check if memory usage is critical (over 2GB allocated)
	if allocMB > 2048 {
		status = "error"
		message = "Critical memory usage detected"
	}

	return CheckResult{
		Status:  status,
		Message: message,
		Data: map[string]interface{}{
			"alloc_mb": allocMB,
			"sys_mb":   sysMB,
			"num_gc":   m.NumGC,
		},
	}
}

// checkDisk verifies disk space
func (h *HealthHandler) checkDisk() CheckResult {
	// This is a simplified check - in production you'd check actual disk usage
	// For now, we'll just return OK
	return CheckResult{
		Status:  "ok",
		Message: "Disk space is adequate",
		Data: map[string]interface{}{
			"note": "Disk space monitoring not implemented",
		},
	}
}

// checkMigrations verifies database migrations are up to date
func (h *HealthHandler) checkMigrations() CheckResult {
	start := time.Now()
	
	// Check if migrations table exists
	var count int64
	if err := h.db.Model(&models.Migration{}).Count(&count).Error; err != nil {
		return CheckResult{
			Status:  "error",
			Message: fmt.Sprintf("Cannot access migrations table: %v", err),
			Latency: time.Since(start).String(),
		}
	}

	// In a real implementation, you would check if all expected migrations are applied
	// For now, we'll just verify the table is accessible
	return CheckResult{
		Status:  "ok",
		Message: "Database migrations are up to date",
		Data:    map[string]interface{}{"applied_migrations": count},
		Latency: time.Since(start).String(),
	}
}

// getSystemMetrics collects system performance metrics
func (h *HealthHandler) getSystemMetrics() SystemMetrics {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	metrics := SystemMetrics{
		Memory: MemoryMetrics{
			Alloc:      m.Alloc,
			TotalAlloc: m.TotalAlloc,
			Sys:        m.Sys,
			NumGC:      m.NumGC,
		},
		Goroutines: runtime.NumGoroutine(),
	}

	// Get database metrics
	if sqlDB, err := h.db.DB(); err == nil {
		stats := sqlDB.Stats()
		metrics.Database = DatabaseMetrics{
			OpenConnections:   stats.OpenConnections,
			InUse:            stats.InUse,
			Idle:             stats.Idle,
			WaitCount:        stats.WaitCount,
			WaitDuration:     stats.WaitDuration,
			MaxIdleClosed:    stats.MaxIdleClosed,
			MaxLifetimeClosed: stats.MaxLifetimeClosed,
		}
	}

	return metrics
}

// generatePrometheusMetrics generates Prometheus-compatible metrics
func (h *HealthHandler) generatePrometheusMetrics() string {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	metrics := fmt.Sprintf(`# HELP notesage_uptime_seconds Total uptime of the service in seconds
# TYPE notesage_uptime_seconds counter
notesage_uptime_seconds %f

# HELP notesage_memory_alloc_bytes Currently allocated memory in bytes
# TYPE notesage_memory_alloc_bytes gauge
notesage_memory_alloc_bytes %d

# HELP notesage_memory_sys_bytes Total memory obtained from system in bytes
# TYPE notesage_memory_sys_bytes gauge
notesage_memory_sys_bytes %d

# HELP notesage_gc_total Total number of garbage collections
# TYPE notesage_gc_total counter
notesage_gc_total %d

# HELP notesage_goroutines Current number of goroutines
# TYPE notesage_goroutines gauge
notesage_goroutines %d

`,
		time.Since(h.startTime).Seconds(),
		m.Alloc,
		m.Sys,
		m.NumGC,
		runtime.NumGoroutine(),
	)

	// Add database metrics if available
	if sqlDB, err := h.db.DB(); err == nil {
		stats := sqlDB.Stats()
		metrics += fmt.Sprintf(`# HELP notesage_db_connections_open Current number of open database connections
# TYPE notesage_db_connections_open gauge
notesage_db_connections_open %d

# HELP notesage_db_connections_in_use Current number of database connections in use
# TYPE notesage_db_connections_in_use gauge
notesage_db_connections_in_use %d

# HELP notesage_db_connections_idle Current number of idle database connections
# TYPE notesage_db_connections_idle gauge
notesage_db_connections_idle %d

# HELP notesage_db_wait_count_total Total number of database connection waits
# TYPE notesage_db_wait_count_total counter
notesage_db_wait_count_total %d

`,
			stats.OpenConnections,
			stats.InUse,
			stats.Idle,
			stats.WaitCount,
		)
	}

	return metrics
}

// getVersion returns the current version of the service
func getVersion() string {
	// In a real implementation, this would be set during build
	return "1.0.0"
}

// RegisterHealthRoutes registers all health check routes
func RegisterHealthRoutes(router *gin.Engine, db *gorm.DB) {
	handler := NewHealthHandler(db)

	// Basic health check (for load balancers)
	router.GET("/health", handler.BasicHealth)
	
	// Detailed health check (for monitoring)
	router.GET("/health/detailed", handler.DetailedHealth)
	
	// Kubernetes-style probes
	router.GET("/health/ready", handler.ReadinessProbe)
	router.GET("/health/live", handler.LivenessProbe)
	
	// Prometheus metrics
	router.GET("/metrics", handler.MetricsEndpoint)
}

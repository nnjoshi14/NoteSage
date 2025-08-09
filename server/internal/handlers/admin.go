package handlers

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"notesage-server/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AdminHandler handles administrative endpoints
type AdminHandler struct {
	db *gorm.DB
}

// NewAdminHandler creates a new admin handler
func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

// ServerInfo contains server information
type ServerInfo struct {
	Version     string            `json:"version"`
	Uptime      string            `json:"uptime"`
	GoVersion   string            `json:"go_version"`
	OS          string            `json:"os"`
	Arch        string            `json:"arch"`
	NumCPU      int               `json:"num_cpu"`
	Hostname    string            `json:"hostname"`
	Environment map[string]string `json:"environment"`
}

// DatabaseInfo contains database information
type DatabaseInfo struct {
	Type            string `json:"type"`
	Version         string `json:"version"`
	Size            string `json:"size"`
	Tables          int    `json:"tables"`
	Connections     int    `json:"connections"`
	MaxConnections  int    `json:"max_connections"`
	ActiveQueries   int    `json:"active_queries"`
}

// ServiceStatus contains service status information
type ServiceStatus struct {
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	Enabled   bool      `json:"enabled"`
	StartTime time.Time `json:"start_time,omitempty"`
	PID       int       `json:"pid,omitempty"`
}

// LogInfo contains log file information
type LogInfo struct {
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	Size         int64     `json:"size"`
	ModifiedTime time.Time `json:"modified_time"`
	Lines        int       `json:"lines"`
}

// BackupInfo contains backup information
type BackupInfo struct {
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	Size         int64     `json:"size"`
	CreatedTime  time.Time `json:"created_time"`
	Type         string    `json:"type"`
}

// MaintenanceTask represents a maintenance task
type MaintenanceTask struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	LastRun     time.Time `json:"last_run,omitempty"`
	Status      string    `json:"status"`
	Duration    string    `json:"duration,omitempty"`
}

// AdminDashboard returns comprehensive server information
func (h *AdminHandler) AdminDashboard(c *gin.Context) {
	hostname, _ := os.Hostname()
	
	dashboard := gin.H{
		"server": ServerInfo{
			Version:   getVersion(),
			Uptime:    getUptime(),
			GoVersion: runtime.Version(),
			OS:        runtime.GOOS,
			Arch:      runtime.GOARCH,
			NumCPU:    runtime.NumCPU(),
			Hostname:  hostname,
			Environment: map[string]string{
				"GOOS":       runtime.GOOS,
				"GOARCH":     runtime.GOARCH,
				"GOMAXPROCS": strconv.Itoa(runtime.GOMAXPROCS(0)),
			},
		},
		"database":    h.getDatabaseInfo(),
		"services":    h.getServiceStatus(),
		"logs":        h.getLogInfo(),
		"backups":     h.getBackupInfo(),
		"maintenance": h.getMaintenanceTasks(),
		"health":      h.getHealthSummary(),
	}

	c.JSON(http.StatusOK, dashboard)
}

// GetServerInfo returns basic server information
func (h *AdminHandler) GetServerInfo(c *gin.Context) {
	hostname, _ := os.Hostname()
	
	info := ServerInfo{
		Version:   getVersion(),
		Uptime:    getUptime(),
		GoVersion: runtime.Version(),
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		NumCPU:    runtime.NumCPU(),
		Hostname:  hostname,
	}

	c.JSON(http.StatusOK, info)
}

// GetDatabaseInfo returns database information
func (h *AdminHandler) GetDatabaseInfo(c *gin.Context) {
	info := h.getDatabaseInfo()
	c.JSON(http.StatusOK, info)
}

// GetServiceStatus returns status of system services
func (h *AdminHandler) GetServiceStatus(c *gin.Context) {
	services := h.getServiceStatus()
	c.JSON(http.StatusOK, services)
}

// RestartService restarts a system service
func (h *AdminHandler) RestartService(c *gin.Context) {
	serviceName := c.Param("service")
	
	// Only allow restarting specific services
	allowedServices := []string{"notesage", "postgresql", "nginx"}
	allowed := false
	for _, service := range allowedServices {
		if service == serviceName {
			allowed = true
			break
		}
	}
	
	if !allowed {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Service not allowed for restart",
		})
		return
	}
	
	// Execute restart command
	cmd := exec.Command("systemctl", "restart", serviceName)
	if err := cmd.Run(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to restart service: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Service %s restarted successfully", serviceName),
	})
}

// GetLogs returns log file information
func (h *AdminHandler) GetLogs(c *gin.Context) {
	logs := h.getLogInfo()
	c.JSON(http.StatusOK, logs)
}

// GetLogContent returns content of a specific log file
func (h *AdminHandler) GetLogContent(c *gin.Context) {
	logName := c.Param("log")
	lines := c.DefaultQuery("lines", "100")
	
	// Validate log name to prevent path traversal
	allowedLogs := map[string]string{
		"server":      "/var/log/notesage/server.log",
		"access":      "/var/log/notesage/access.log",
		"backup":      "/var/log/notesage/backup.log",
		"upgrade":     "/var/log/notesage/upgrade.log",
		"maintenance": "/var/log/notesage/maintenance.log",
		"health":      "/var/log/notesage/health-check.log",
	}
	
	logPath, exists := allowedLogs[logName]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid log name",
		})
		return
	}
	
	// Check if log file exists
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Log file not found",
		})
		return
	}
	
	// Get log content using tail command
	cmd := exec.Command("tail", "-n", lines, logPath)
	output, err := cmd.Output()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to read log file: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"log":     logName,
		"path":    logPath,
		"lines":   lines,
		"content": string(output),
	})
}

// GetBackups returns backup information
func (h *AdminHandler) GetBackups(c *gin.Context) {
	backups := h.getBackupInfo()
	c.JSON(http.StatusOK, backups)
}

// CreateBackup creates a new backup
func (h *AdminHandler) CreateBackup(c *gin.Context) {
	// Execute backup script
	cmd := exec.Command("/opt/notesage/backup.sh", "create")
	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  fmt.Sprintf("Backup failed: %v", err),
			"output": string(output),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Backup created successfully",
		"output":  string(output),
	})
}

// RunMaintenance runs maintenance tasks
func (h *AdminHandler) RunMaintenance(c *gin.Context) {
	taskType := c.DefaultQuery("type", "quick")
	
	// Validate task type
	allowedTypes := []string{"quick", "cleanup", "database", "full"}
	allowed := false
	for _, t := range allowedTypes {
		if t == taskType {
			allowed = true
			break
		}
	}
	
	if !allowed {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid maintenance task type",
		})
		return
	}
	
	// Execute maintenance script
	cmd := exec.Command("/opt/notesage/maintenance.sh", taskType)
	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  fmt.Sprintf("Maintenance failed: %v", err),
			"output": string(output),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Maintenance task '%s' completed successfully", taskType),
		"output":  string(output),
	})
}

// GetMaintenanceTasks returns information about maintenance tasks
func (h *AdminHandler) GetMaintenanceTasks(c *gin.Context) {
	tasks := h.getMaintenanceTasks()
	c.JSON(http.StatusOK, tasks)
}

// CheckForUpdates checks for available updates
func (h *AdminHandler) CheckForUpdates(c *gin.Context) {
	// Execute upgrade script with check option
	cmd := exec.Command("/opt/notesage/upgrade.sh", "check")
	output, err := cmd.CombinedOutput()
	
	updateAvailable := err == nil
	
	c.JSON(http.StatusOK, gin.H{
		"update_available": updateAvailable,
		"output":          string(output),
	})
}

// PerformUpgrade performs system upgrade
func (h *AdminHandler) PerformUpgrade(c *gin.Context) {
	force := c.DefaultQuery("force", "false") == "true"
	
	args := []string{"upgrade"}
	if force {
		args = append(args, "--force")
	}
	
	// Execute upgrade script
	cmd := exec.Command("/opt/notesage/upgrade.sh", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  fmt.Sprintf("Upgrade failed: %v", err),
			"output": string(output),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Upgrade completed successfully",
		"output":  string(output),
	})
}

// Helper methods

func (h *AdminHandler) getDatabaseInfo() DatabaseInfo {
	info := DatabaseInfo{
		Type: "PostgreSQL",
	}
	
	// Get database size
	var size string
	h.db.Raw("SELECT pg_size_pretty(pg_database_size('notesage'))").Scan(&size)
	info.Size = size
	
	// Get table count
	var tableCount int64
	h.db.Raw("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'").Scan(&tableCount)
	info.Tables = int(tableCount)
	
	// Get connection count
	var connectionCount int64
	h.db.Raw("SELECT count(*) FROM pg_stat_activity WHERE datname = 'notesage'").Scan(&connectionCount)
	info.Connections = int(connectionCount)
	
	return info
}

func (h *AdminHandler) getServiceStatus() []ServiceStatus {
	services := []string{"notesage", "postgresql", "nginx"}
	var statuses []ServiceStatus
	
	for _, service := range services {
		status := ServiceStatus{Name: service}
		
		// Check if service is active
		cmd := exec.Command("systemctl", "is-active", service)
		if output, err := cmd.Output(); err == nil {
			status.Status = strings.TrimSpace(string(output))
		} else {
			status.Status = "inactive"
		}
		
		// Check if service is enabled
		cmd = exec.Command("systemctl", "is-enabled", service)
		if err := cmd.Run(); err == nil {
			status.Enabled = true
		}
		
		statuses = append(statuses, status)
	}
	
	return statuses
}

func (h *AdminHandler) getLogInfo() []LogInfo {
	logDir := "/var/log/notesage"
	var logs []LogInfo
	
	logFiles := []string{
		"server.log",
		"access.log",
		"backup.log",
		"upgrade.log",
		"maintenance.log",
		"health-check.log",
	}
	
	for _, logFile := range logFiles {
		path := fmt.Sprintf("%s/%s", logDir, logFile)
		if stat, err := os.Stat(path); err == nil {
			// Count lines in file
			cmd := exec.Command("wc", "-l", path)
			var lines int
			if output, err := cmd.Output(); err == nil {
				fmt.Sscanf(string(output), "%d", &lines)
			}
			
			logs = append(logs, LogInfo{
				Name:         logFile,
				Path:         path,
				Size:         stat.Size(),
				ModifiedTime: stat.ModTime(),
				Lines:        lines,
			})
		}
	}
	
	return logs
}

func (h *AdminHandler) getBackupInfo() []BackupInfo {
	var backups []BackupInfo
	
	// This is a simplified implementation
	// In a real implementation, you would scan the backup directory
	
	return backups
}

func (h *AdminHandler) getMaintenanceTasks() []MaintenanceTask {
	tasks := []MaintenanceTask{
		{
			Name:        "Log Cleanup",
			Description: "Clean up old log files",
			Status:      "scheduled",
		},
		{
			Name:        "Database Optimization",
			Description: "Optimize database performance",
			Status:      "scheduled",
		},
		{
			Name:        "Backup Cleanup",
			Description: "Remove old backup files",
			Status:      "scheduled",
		},
		{
			Name:        "System Updates",
			Description: "Check and install system updates",
			Status:      "scheduled",
		},
	}
	
	return tasks
}

func (h *AdminHandler) getHealthSummary() gin.H {
	// Get basic health information
	var userCount int64
	h.db.Model(&models.User{}).Count(&userCount)
	
	var noteCount int64
	h.db.Model(&models.Note{}).Count(&noteCount)
	
	return gin.H{
		"users": userCount,
		"notes": noteCount,
		"status": "healthy",
	}
}

func getUptime() string {
	// This is a simplified implementation
	// In a real implementation, you would track the actual start time
	return "unknown"
}

// RegisterAdminRoutes registers all admin routes
func RegisterAdminRoutes(router *gin.RouterGroup, db *gorm.DB) {
	handler := NewAdminHandler(db)
	
	// Dashboard
	router.GET("/dashboard", handler.AdminDashboard)
	
	// Server information
	router.GET("/server", handler.GetServerInfo)
	router.GET("/database", handler.GetDatabaseInfo)
	
	// Service management
	router.GET("/services", handler.GetServiceStatus)
	router.POST("/services/:service/restart", handler.RestartService)
	
	// Log management
	router.GET("/logs", handler.GetLogs)
	router.GET("/logs/:log", handler.GetLogContent)
	
	// Backup management
	router.GET("/backups", handler.GetBackups)
	router.POST("/backups", handler.CreateBackup)
	
	// Maintenance
	router.GET("/maintenance", handler.GetMaintenanceTasks)
	router.POST("/maintenance", handler.RunMaintenance)
	
	// Updates
	router.GET("/updates/check", handler.CheckForUpdates)
	router.POST("/updates/upgrade", handler.PerformUpgrade)
}
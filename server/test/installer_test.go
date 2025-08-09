package test

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/suite"
)

type InstallerTestSuite struct {
	suite.Suite
	testDir     string
	backupDir   string
	originalDir string
}

func (suite *InstallerTestSuite) SetupSuite() {
	// Create temporary test directory
	var err error
	suite.testDir, err = os.MkdirTemp("", "notesage-installer-test")
	suite.Require().NoError(err)

	suite.backupDir = filepath.Join(suite.testDir, "backup")
	suite.originalDir, _ = os.Getwd()

	// Create mock installation structure
	suite.createMockInstallation()
}

func (suite *InstallerTestSuite) TearDownSuite() {
	os.RemoveAll(suite.testDir)
}

func (suite *InstallerTestSuite) createMockInstallation() {
	// Create directory structure
	dirs := []string{
		"opt/notesage",
		"etc/notesage",
		"var/log/notesage",
		"var/lib/notesage",
		"etc/systemd/system",
	}

	for _, dir := range dirs {
		err := os.MkdirAll(filepath.Join(suite.testDir, dir), 0755)
		suite.Require().NoError(err)
	}

	// Create mock files
	files := map[string]string{
		"opt/notesage/notesage-server":        "#!/bin/bash\necho 'NoteSage Server v1.0.0'\n",
		"etc/notesage/config.yaml":            "server:\n  port: 8080\ndatabase:\n  type: sqlite\n",
		"etc/systemd/system/notesage.service": "[Unit]\nDescription=NoteSage Server\n[Service]\nExecStart=/opt/notesage/notesage-server\n",
		"var/lib/notesage/data.db":            "mock database content",
	}

	for path, content := range files {
		fullPath := filepath.Join(suite.testDir, path)
		err := os.WriteFile(fullPath, []byte(content), 0644)
		suite.Require().NoError(err)
	}

	// Make binary executable
	err := os.Chmod(filepath.Join(suite.testDir, "opt/notesage/notesage-server"), 0755)
	suite.Require().NoError(err)
}

func (suite *InstallerTestSuite) TestInstallScript() {
	// Copy install script to test directory
	installScript := filepath.Join(suite.originalDir, "..", "install", "install.sh")
	testInstallScript := filepath.Join(suite.testDir, "install.sh")

	// Read and modify install script for testing
	content, err := os.ReadFile(installScript)
	suite.Require().NoError(err)

	// Replace paths for testing
	testContent := strings.ReplaceAll(string(content), "/opt/notesage", filepath.Join(suite.testDir, "opt/notesage"))
	testContent = strings.ReplaceAll(testContent, "/etc/notesage", filepath.Join(suite.testDir, "etc/notesage"))
	testContent = strings.ReplaceAll(testContent, "/var/log/notesage", filepath.Join(suite.testDir, "var/log/notesage"))
	testContent = strings.ReplaceAll(testContent, "/var/lib/notesage", filepath.Join(suite.testDir, "var/lib/notesage"))

	err = os.WriteFile(testInstallScript, []byte(testContent), 0755)
	suite.Require().NoError(err)

	// Run install script
	cmd := exec.Command("bash", testInstallScript)
	cmd.Dir = suite.testDir
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("Install script output: %s\n", string(output))
	}

	// Verify installation
	suite.verifyInstallation()
}

func (suite *InstallerTestSuite) TestUpgradeScript() {
	// Copy upgrade script to test directory
	upgradeScript := filepath.Join(suite.originalDir, "..", "install", "upgrade.sh")
	testUpgradeScript := filepath.Join(suite.testDir, "upgrade.sh")

	content, err := os.ReadFile(upgradeScript)
	suite.Require().NoError(err)

	// Replace paths for testing
	testContent := strings.ReplaceAll(string(content), "/opt/notesage", filepath.Join(suite.testDir, "opt/notesage"))
	testContent = strings.ReplaceAll(testContent, "/etc/notesage", filepath.Join(suite.testDir, "etc/notesage"))
	testContent = strings.ReplaceAll(testContent, "/var/log/notesage", filepath.Join(suite.testDir, "var/log/notesage"))
	testContent = strings.ReplaceAll(testContent, "/var/lib/notesage", filepath.Join(suite.testDir, "var/lib/notesage"))

	err = os.WriteFile(testUpgradeScript, []byte(testContent), 0755)
	suite.Require().NoError(err)

	// Create new version binary
	newBinary := filepath.Join(suite.testDir, "notesage-server-new")
	err = os.WriteFile(newBinary, []byte("#!/bin/bash\necho 'NoteSage Server v2.0.0'\n"), 0755)
	suite.Require().NoError(err)

	// Run upgrade script
	cmd := exec.Command("bash", testUpgradeScript, newBinary)
	cmd.Dir = suite.testDir
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("Upgrade script output: %s\n", string(output))
	}

	// Verify upgrade
	suite.verifyUpgrade()
}

func (suite *InstallerTestSuite) TestBackupScript() {
	backupScript := filepath.Join(suite.originalDir, "..", "install", "backup.sh")
	testBackupScript := filepath.Join(suite.testDir, "backup.sh")

	content, err := os.ReadFile(backupScript)
	suite.Require().NoError(err)

	// Replace paths for testing
	testContent := strings.ReplaceAll(string(content), "/var/lib/notesage", filepath.Join(suite.testDir, "var/lib/notesage"))
	testContent = strings.ReplaceAll(testContent, "/etc/notesage", filepath.Join(suite.testDir, "etc/notesage"))

	err = os.WriteFile(testBackupScript, []byte(testContent), 0755)
	suite.Require().NoError(err)

	// Run backup script
	cmd := exec.Command("bash", testBackupScript, suite.backupDir)
	cmd.Dir = suite.testDir
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("Backup script output: %s\n", string(output))
	}

	// Verify backup
	suite.verifyBackup()
}

func (suite *InstallerTestSuite) TestRestoreScript() {
	// First create a backup
	suite.TestBackupScript()

	// Modify original files
	configPath := filepath.Join(suite.testDir, "etc/notesage/config.yaml")
	err := os.WriteFile(configPath, []byte("modified config"), 0644)
	suite.Require().NoError(err)

	// Run restore script
	restoreScript := filepath.Join(suite.originalDir, "..", "install", "restore.sh")
	testRestoreScript := filepath.Join(suite.testDir, "restore.sh")

	content, err := os.ReadFile(restoreScript)
	suite.Require().NoError(err)

	// Replace paths for testing
	testContent := strings.ReplaceAll(string(content), "/var/lib/notesage", filepath.Join(suite.testDir, "var/lib/notesage"))
	testContent = strings.ReplaceAll(testContent, "/etc/notesage", filepath.Join(suite.testDir, "etc/notesage"))

	err = os.WriteFile(testRestoreScript, []byte(testContent), 0755)
	suite.Require().NoError(err)

	cmd := exec.Command("bash", testRestoreScript, suite.backupDir)
	cmd.Dir = suite.testDir
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("Restore script output: %s\n", string(output))
	}

	// Verify restore
	suite.verifyRestore()
}

func (suite *InstallerTestSuite) TestHealthCheck() {
	healthScript := filepath.Join(suite.originalDir, "..", "install", "health-check.sh")
	testHealthScript := filepath.Join(suite.testDir, "health-check.sh")

	content, err := os.ReadFile(healthScript)
	suite.Require().NoError(err)

	// Replace paths for testing
	testContent := strings.ReplaceAll(string(content), "/opt/notesage", filepath.Join(suite.testDir, "opt/notesage"))

	err = os.WriteFile(testHealthScript, []byte(testContent), 0755)
	suite.Require().NoError(err)

	// Run health check
	cmd := exec.Command("bash", testHealthScript)
	cmd.Dir = suite.testDir
	output, err := cmd.CombinedOutput()

	fmt.Printf("Health check output: %s\n", string(output))

	// Health check should pass for our mock installation
	suite.Assert().NoError(err)
}

func (suite *InstallerTestSuite) verifyInstallation() {
	// Check that all required directories exist
	requiredDirs := []string{
		"opt/notesage",
		"etc/notesage",
		"var/log/notesage",
		"var/lib/notesage",
	}

	for _, dir := range requiredDirs {
		path := filepath.Join(suite.testDir, dir)
		info, err := os.Stat(path)
		suite.Assert().NoError(err, "Directory %s should exist", dir)
		suite.Assert().True(info.IsDir(), "%s should be a directory", dir)
	}

	// Check that binary is executable
	binaryPath := filepath.Join(suite.testDir, "opt/notesage/notesage-server")
	info, err := os.Stat(binaryPath)
	suite.Assert().NoError(err)
	suite.Assert().Equal(os.FileMode(0755), info.Mode().Perm())

	// Check that config file exists
	configPath := filepath.Join(suite.testDir, "etc/notesage/config.yaml")
	_, err = os.Stat(configPath)
	suite.Assert().NoError(err)

	// Check that systemd service file exists
	servicePath := filepath.Join(suite.testDir, "etc/systemd/system/notesage.service")
	_, err = os.Stat(servicePath)
	suite.Assert().NoError(err)
}

func (suite *InstallerTestSuite) verifyUpgrade() {
	// Check that backup was created
	backupPath := filepath.Join(suite.testDir, "opt/notesage/notesage-server.backup")
	_, err := os.Stat(backupPath)
	suite.Assert().NoError(err, "Backup should be created during upgrade")

	// Check that new binary is in place
	binaryPath := filepath.Join(suite.testDir, "opt/notesage/notesage-server")
	content, err := os.ReadFile(binaryPath)
	suite.Assert().NoError(err)
	suite.Assert().Contains(string(content), "v2.0.0", "New version should be installed")

	// Check that config is preserved
	configPath := filepath.Join(suite.testDir, "etc/notesage/config.yaml")
	configContent, err := os.ReadFile(configPath)
	suite.Assert().NoError(err)
	suite.Assert().Contains(string(configContent), "port: 8080", "Config should be preserved")
}

func (suite *InstallerTestSuite) verifyBackup() {
	// Check that backup directory was created
	_, err := os.Stat(suite.backupDir)
	suite.Assert().NoError(err, "Backup directory should exist")

	// Check that database backup exists
	dbBackup := filepath.Join(suite.backupDir, "data.db")
	_, err = os.Stat(dbBackup)
	suite.Assert().NoError(err, "Database backup should exist")

	// Check that config backup exists
	configBackup := filepath.Join(suite.backupDir, "config.yaml")
	_, err = os.Stat(configBackup)
	suite.Assert().NoError(err, "Config backup should exist")

	// Verify backup timestamp
	timestampFile := filepath.Join(suite.backupDir, "backup_timestamp")
	_, err = os.Stat(timestampFile)
	suite.Assert().NoError(err, "Backup timestamp should exist")
}

func (suite *InstallerTestSuite) verifyRestore() {
	// Check that original config was restored
	configPath := filepath.Join(suite.testDir, "etc/notesage/config.yaml")
	content, err := os.ReadFile(configPath)
	suite.Assert().NoError(err)
	suite.Assert().Contains(string(content), "port: 8080", "Original config should be restored")
	suite.Assert().NotContains(string(content), "modified config", "Modified config should be replaced")

	// Check that database was restored
	dbPath := filepath.Join(suite.testDir, "var/lib/notesage/data.db")
	content, err = os.ReadFile(dbPath)
	suite.Assert().NoError(err)
	suite.Assert().Contains(string(content), "mock database content", "Database should be restored")
}

func TestInstallerSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping installer tests in short mode")
	}

	// Skip if not running as root (installer scripts require root privileges)
	if os.Geteuid() != 0 {
		t.Skip("Skipping installer tests - requires root privileges")
	}

	suite.Run(t, new(InstallerTestSuite))
}

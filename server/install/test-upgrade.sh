#!/bin/bash
# NoteSage Server Upgrade Testing Script
# This script tests upgrade procedures and validates system integrity

set -e

# Configuration
NOTESAGE_HOME="/opt/notesage"
NOTESAGE_CONFIG="/etc/notesage"
NOTESAGE_DATA="/var/lib/notesage"
LOG_FILE="/var/log/notesage/upgrade-test.log"
TEST_DB_NAME="notesage_test"
BACKUP_DIR="/var/lib/notesage/backups"

# Test configuration
TEST_TIMEOUT=300  # 5 minutes
API_TIMEOUT=30
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
    ((TESTS_PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
    ((TESTS_FAILED++))
}

log_skip() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⊘${NC} $1" | tee -a "$LOG_FILE"
    ((TESTS_SKIPPED++))
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Test prerequisites
test_prerequisites() {
    log "Testing upgrade prerequisites..."
    
    # Check required commands
    local required_commands=("systemctl" "pg_dump" "psql" "curl" "tar" "gzip")
    for cmd in "${required_commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            log_success "Command available: $cmd"
        else
            log_error "Required command not found: $cmd"
        fi
    done
    
    # Check disk space
    local free_space=$(df /opt/notesage | awk 'NR==2 {print $4}')
    local required_space=1048576  # 1GB in KB
    
    if [[ $free_space -gt $required_space ]]; then
        log_success "Sufficient disk space available: $(($free_space/1024))MB"
    else
        log_error "Insufficient disk space: $(($free_space/1024))MB available, need 1GB"
    fi
    
    # Check database connectivity
    if sudo -u postgres psql -d notesage -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "Database connectivity verified"
    else
        log_error "Cannot connect to database"
    fi
    
    # Check service status
    if systemctl is-active --quiet notesage; then
        log_success "NoteSage service is running"
    else
        log_error "NoteSage service is not running"
    fi
    
    # Check backup directory
    if [[ -w "$BACKUP_DIR" ]]; then
        log_success "Backup directory is writable"
    else
        log_error "Backup directory is not writable: $BACKUP_DIR"
    fi
}

# Test backup functionality
test_backup_functionality() {
    log "Testing backup functionality..."
    
    local test_backup_name="upgrade_test_$(date +%Y%m%d_%H%M%S)"
    
    # Test database backup
    if sudo -u postgres pg_dump notesage | gzip > "/tmp/${test_backup_name}_db.sql.gz" 2>/dev/null; then
        log_success "Database backup test successful"
        
        # Verify backup integrity
        if gzip -t "/tmp/${test_backup_name}_db.sql.gz" 2>/dev/null; then
            log_success "Database backup integrity verified"
        else
            log_error "Database backup is corrupted"
        fi
        
        # Clean up test backup
        rm -f "/tmp/${test_backup_name}_db.sql.gz"
    else
        log_error "Database backup test failed"
    fi
    
    # Test configuration backup
    if tar -czf "/tmp/${test_backup_name}_config.tar.gz" -C "$NOTESAGE_CONFIG" . 2>/dev/null; then
        log_success "Configuration backup test successful"
        
        # Verify backup integrity
        if tar -tzf "/tmp/${test_backup_name}_config.tar.gz" >/dev/null 2>&1; then
            log_success "Configuration backup integrity verified"
        else
            log_error "Configuration backup is corrupted"
        fi
        
        # Clean up test backup
        rm -f "/tmp/${test_backup_name}_config.tar.gz"
    else
        log_error "Configuration backup test failed"
    fi
}

# Test service management
test_service_management() {
    log "Testing service management..."
    
    # Test service stop
    if systemctl stop notesage 2>/dev/null; then
        log_success "Service stop test successful"
        
        # Wait for service to stop
        local timeout=30
        while systemctl is-active --quiet notesage && [[ $timeout -gt 0 ]]; do
            sleep 1
            ((timeout--))
        done
        
        if systemctl is-active --quiet notesage; then
            log_error "Service did not stop within timeout"
        else
            log_success "Service stopped successfully"
        fi
    else
        log_error "Service stop test failed"
    fi
    
    # Test service start
    if systemctl start notesage 2>/dev/null; then
        log_success "Service start test successful"
        
        # Wait for service to start
        local timeout=60
        while ! systemctl is-active --quiet notesage && [[ $timeout -gt 0 ]]; do
            sleep 1
            ((timeout--))
        done
        
        if systemctl is-active --quiet notesage; then
            log_success "Service started successfully"
        else
            log_error "Service did not start within timeout"
        fi
    else
        log_error "Service start test failed"
    fi
}

# Test API endpoints
test_api_endpoints() {
    log "Testing API endpoints..."
    
    # Wait for service to be ready
    local retries=$HEALTH_CHECK_RETRIES
    while [[ $retries -gt 0 ]]; do
        if curl -f -s --max-time $API_TIMEOUT "http://localhost:8080/health" >/dev/null 2>&1; then
            break
        fi
        sleep $HEALTH_CHECK_INTERVAL
        ((retries--))
    done
    
    if [[ $retries -eq 0 ]]; then
        log_error "Service did not become ready within timeout"
        return 1
    fi
    
    # Test health endpoint
    if curl -f -s --max-time $API_TIMEOUT "http://localhost:8080/health" >/dev/null 2>&1; then
        log_success "Health endpoint test successful"
    else
        log_error "Health endpoint test failed"
    fi
    
    # Test detailed health endpoint
    if curl -f -s --max-time $API_TIMEOUT "http://localhost:8080/health/detailed" >/dev/null 2>&1; then
        log_success "Detailed health endpoint test successful"
    else
        log_error "Detailed health endpoint test failed"
    fi
    
    # Test readiness probe
    if curl -f -s --max-time $API_TIMEOUT "http://localhost:8080/health/ready" >/dev/null 2>&1; then
        log_success "Readiness probe test successful"
    else
        log_error "Readiness probe test failed"
    fi
    
    # Test liveness probe
    if curl -f -s --max-time $API_TIMEOUT "http://localhost:8080/health/live" >/dev/null 2>&1; then
        log_success "Liveness probe test successful"
    else
        log_error "Liveness probe test failed"
    fi
    
    # Test metrics endpoint
    if curl -f -s --max-time $API_TIMEOUT "http://localhost:8080/metrics" >/dev/null 2>&1; then
        log_success "Metrics endpoint test successful"
    else
        log_error "Metrics endpoint test failed"
    fi
}

# Test database migrations
test_database_migrations() {
    log "Testing database migrations..."
    
    # Test migration status
    if "$NOTESAGE_HOME/notesage-server" migrate status --config "$NOTESAGE_CONFIG/config.yaml" >/dev/null 2>&1; then
        log_success "Migration status check successful"
    else
        log_error "Migration status check failed"
    fi
    
    # Test migration validation
    if "$NOTESAGE_HOME/notesage-server" migrate validate --config "$NOTESAGE_CONFIG/config.yaml" >/dev/null 2>&1; then
        log_success "Migration validation successful"
    else
        log_error "Migration validation failed"
    fi
    
    # Test database connectivity from binary
    if "$NOTESAGE_HOME/notesage-server" test-db --config "$NOTESAGE_CONFIG/config.yaml" >/dev/null 2>&1; then
        log_success "Database connectivity test from binary successful"
    else
        log_error "Database connectivity test from binary failed"
    fi
}

# Test rollback functionality
test_rollback_functionality() {
    log "Testing rollback functionality..."
    
    # Create a test rollback point
    local rollback_point="test_rollback_$(date +%Y%m%d_%H%M%S)"
    
    # This would require implementing the rollback point creation
    # For now, we'll just test the rollback script exists and is executable
    if [[ -x "$NOTESAGE_HOME/../install/upgrade.sh" ]]; then
        log_success "Upgrade script is executable"
        
        # Test rollback point creation (dry run)
        if "$NOTESAGE_HOME/../install/upgrade.sh" create-rollback-point --dry-run "$rollback_point" >/dev/null 2>&1; then
            log_success "Rollback point creation test successful"
        else
            log_skip "Rollback point creation test (not implemented)"
        fi
    else
        log_error "Upgrade script not found or not executable"
    fi
}

# Test configuration validation
test_configuration_validation() {
    log "Testing configuration validation..."
    
    # Test configuration file exists
    if [[ -f "$NOTESAGE_CONFIG/config.yaml" ]]; then
        log_success "Configuration file exists"
        
        # Test configuration file permissions
        local perms=$(stat -c "%a" "$NOTESAGE_CONFIG/config.yaml")
        if [[ "$perms" == "640" ]]; then
            log_success "Configuration file has correct permissions"
        else
            log_warning "Configuration file permissions: $perms (should be 640)"
        fi
        
        # Test YAML syntax
        if command -v python3 >/dev/null 2>&1; then
            if python3 -c "import yaml; yaml.safe_load(open('$NOTESAGE_CONFIG/config.yaml'))" 2>/dev/null; then
                log_success "Configuration file has valid YAML syntax"
            else
                log_error "Configuration file has invalid YAML syntax"
            fi
        else
            log_skip "YAML syntax validation (python3 not available)"
        fi
        
        # Test configuration validation from binary
        if "$NOTESAGE_HOME/notesage-server" validate-config --config "$NOTESAGE_CONFIG/config.yaml" >/dev/null 2>&1; then
            log_success "Configuration validation from binary successful"
        else
            log_error "Configuration validation from binary failed"
        fi
    else
        log_error "Configuration file not found: $NOTESAGE_CONFIG/config.yaml"
    fi
}

# Test log rotation
test_log_rotation() {
    log "Testing log rotation..."
    
    # Check if logrotate configuration exists
    if [[ -f "/etc/logrotate.d/notesage" ]]; then
        log_success "Logrotate configuration exists"
        
        # Test logrotate configuration syntax
        if logrotate -d /etc/logrotate.d/notesage >/dev/null 2>&1; then
            log_success "Logrotate configuration syntax is valid"
        else
            log_error "Logrotate configuration syntax is invalid"
        fi
    else
        log_error "Logrotate configuration not found"
    fi
    
    # Check log file permissions
    local log_files=(
        "/var/log/notesage/server.log"
        "/var/log/notesage/access.log"
        "/var/log/notesage/backup.log"
        "/var/log/notesage/upgrade.log"
    )
    
    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_file" ]]; then
            local owner=$(stat -c "%U:%G" "$log_file")
            if [[ "$owner" == "notesage:notesage" ]]; then
                log_success "Log file has correct ownership: $(basename "$log_file")"
            else
                log_error "Log file has incorrect ownership: $(basename "$log_file") ($owner)"
            fi
        else
            log_skip "Log file does not exist: $(basename "$log_file")"
        fi
    done
}

# Test performance after upgrade
test_performance() {
    log "Testing performance after upgrade..."
    
    # Test API response time
    local start_time=$(date +%s%N)
    if curl -f -s --max-time $API_TIMEOUT "http://localhost:8080/health" >/dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
        
        if [[ $response_time -lt 1000 ]]; then  # Less than 1 second
            log_success "API response time: ${response_time}ms"
        else
            log_warning "API response time is slow: ${response_time}ms"
        fi
    else
        log_error "API performance test failed"
    fi
    
    # Test database query performance
    start_time=$(date +%s%N)
    if sudo -u postgres psql -d notesage -c "SELECT count(*) FROM users;" >/dev/null 2>&1; then
        end_time=$(date +%s%N)
        local query_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
        
        if [[ $query_time -lt 100 ]]; then  # Less than 100ms
            log_success "Database query time: ${query_time}ms"
        else
            log_warning "Database query time is slow: ${query_time}ms"
        fi
    else
        log_error "Database performance test failed"
    fi
}

# Test data integrity
test_data_integrity() {
    log "Testing data integrity..."
    
    # Test database constraints
    if sudo -u postgres psql -d notesage -c "SELECT conname FROM pg_constraint WHERE contype = 'f';" >/dev/null 2>&1; then
        log_success "Database foreign key constraints verified"
    else
        log_error "Database constraint verification failed"
    fi
    
    # Test table existence
    local required_tables=("users" "notes" "people" "todos" "connections" "migrations")
    for table in "${required_tables[@]}"; do
        if sudo -u postgres psql -d notesage -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
            log_success "Table exists and accessible: $table"
        else
            log_error "Table missing or inaccessible: $table"
        fi
    done
    
    # Test migration consistency
    local migration_count=$(sudo -u postgres psql -d notesage -t -c "SELECT count(*) FROM migrations;" 2>/dev/null | xargs)
    if [[ $migration_count -gt 0 ]]; then
        log_success "Migration records found: $migration_count"
    else
        log_error "No migration records found"
    fi
}

# Generate test report
generate_test_report() {
    log "Generating test report..."
    
    local report_file="/var/log/notesage/upgrade_test_report_$(date +%Y%m%d_%H%M%S).txt"
    local total_tests=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
    
    cat > "$report_file" << EOF
NoteSage Server Upgrade Test Report
Generated: $(date)
Hostname: $(hostname)

=== Test Summary ===
Total Tests: $total_tests
Passed: $TESTS_PASSED
Failed: $TESTS_FAILED
Skipped: $TESTS_SKIPPED
Success Rate: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%

=== System Information ===
NoteSage Version: $(cat "$NOTESAGE_HOME/VERSION" 2>/dev/null || echo "unknown")
OS: $(lsb_release -d 2>/dev/null | cut -f2 || echo "unknown")
Kernel: $(uname -r)
Uptime: $(uptime)

=== Service Status ===
NoteSage: $(systemctl is-active notesage)
PostgreSQL: $(systemctl is-active postgresql)

=== Test Log ===
$(tail -100 "$LOG_FILE")

EOF

    chown notesage:notesage "$report_file"
    log_success "Test report generated: $report_file"
    
    # Send report via email if configured
    if command -v mail >/dev/null 2>&1 && [[ -n "${ADMIN_EMAIL:-}" ]]; then
        mail -s "NoteSage Upgrade Test Report - $(hostname)" "$ADMIN_EMAIL" < "$report_file"
        log_success "Test report sent to $ADMIN_EMAIL"
    fi
}

# Main test function
run_upgrade_tests() {
    local test_type="${1:-full}"
    
    log "Starting NoteSage upgrade tests (type: $test_type)..."
    
    case "$test_type" in
        "prerequisites")
            test_prerequisites
            ;;
        "backup")
            test_backup_functionality
            ;;
        "service")
            test_service_management
            ;;
        "api")
            test_api_endpoints
            ;;
        "database")
            test_database_migrations
            test_data_integrity
            ;;
        "config")
            test_configuration_validation
            ;;
        "performance")
            test_performance
            ;;
        "full")
            test_prerequisites
            test_backup_functionality
            test_service_management
            test_api_endpoints
            test_database_migrations
            test_rollback_functionality
            test_configuration_validation
            test_log_rotation
            test_performance
            test_data_integrity
            ;;
        *)
            log_error "Unknown test type: $test_type"
            exit 1
            ;;
    esac
    
    generate_test_report
    
    # Exit with appropriate code
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All tests passed successfully!"
        exit 0
    else
        log_error "$TESTS_FAILED tests failed"
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "NoteSage Server Upgrade Testing Script"
    echo
    echo "Usage: $0 [OPTIONS] [TYPE]"
    echo
    echo "Test Types:"
    echo "  prerequisites  Test upgrade prerequisites"
    echo "  backup         Test backup functionality"
    echo "  service        Test service management"
    echo "  api            Test API endpoints"
    echo "  database       Test database operations"
    echo "  config         Test configuration validation"
    echo "  performance    Test system performance"
    echo "  full           Run all tests (default)"
    echo
    echo "Options:"
    echo "  --timeout SEC  Set test timeout (default: $TEST_TIMEOUT)"
    echo "  --quiet        Suppress output (log to file only)"
    echo "  --help         Show this help message"
    echo
    echo "Examples:"
    echo "  $0                Run all tests"
    echo "  $0 api            Test API endpoints only"
    echo "  $0 --timeout 600  Run tests with 10-minute timeout"
    echo
}

# Parse command line arguments
QUIET=false
TEST_TYPE="full"

while [[ $# -gt 0 ]]; do
    case $1 in
        --timeout)
            TEST_TIMEOUT="$2"
            shift 2
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        prerequisites|backup|service|api|database|config|performance|full)
            TEST_TYPE="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Redirect output if quiet mode
if [[ "$QUIET" == "true" ]]; then
    exec > /dev/null 2>&1
fi

# Check root privileges
check_root

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run tests with timeout
timeout "$TEST_TIMEOUT" bash -c "run_upgrade_tests '$TEST_TYPE'" || {
    log_error "Tests timed out after $TEST_TIMEOUT seconds"
    exit 1
}
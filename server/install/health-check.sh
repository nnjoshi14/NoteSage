#!/bin/bash
# NoteSage Server Health Check Script
# This script performs comprehensive health checks on the NoteSage server

set -e

# Configuration
NOTESAGE_HOST="localhost"
NOTESAGE_PORT="8080"
CONFIG_FILE="/etc/notesage/config.yaml"
LOG_FILE="/var/log/notesage/health-check.log"
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
}

# Health check results
HEALTH_STATUS=0
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Check if service is running
check_service_status() {
    log "Checking NoteSage service status..."
    
    if systemctl is-active --quiet notesage; then
        log_success "NoteSage service is running"
        ((CHECKS_PASSED++))
    else
        log_error "NoteSage service is not running"
        ((CHECKS_FAILED++))
        HEALTH_STATUS=1
    fi
    
    # Check if service is enabled
    if systemctl is-enabled --quiet notesage; then
        log_success "NoteSage service is enabled"
        ((CHECKS_PASSED++))
    else
        log_warning "NoteSage service is not enabled for auto-start"
        ((CHECKS_WARNING++))
    fi
}

# Check HTTP endpoint
check_http_endpoint() {
    log "Checking HTTP endpoint..."
    
    local url="http://${NOTESAGE_HOST}:${NOTESAGE_PORT}/health"
    
    if curl -f -s --max-time $TIMEOUT "$url" > /dev/null; then
        log_success "HTTP endpoint is responding"
        ((CHECKS_PASSED++))
        
        # Check response content
        local response=$(curl -s --max-time $TIMEOUT "$url")
        if echo "$response" | grep -q "status.*ok"; then
            log_success "Health endpoint returns OK status"
            ((CHECKS_PASSED++))
        else
            log_warning "Health endpoint response: $response"
            ((CHECKS_WARNING++))
        fi
    else
        log_error "HTTP endpoint is not responding at $url"
        ((CHECKS_FAILED++))
        HEALTH_STATUS=1
    fi
}

# Check database connection
check_database() {
    log "Checking database connection..."
    
    # Check PostgreSQL service
    if systemctl is-active --quiet postgresql; then
        log_success "PostgreSQL service is running"
        ((CHECKS_PASSED++))
    else
        log_error "PostgreSQL service is not running"
        ((CHECKS_FAILED++))
        HEALTH_STATUS=1
        return
    fi
    
    # Test database connection
    if sudo -u postgres psql -d notesage -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Database connection successful"
        ((CHECKS_PASSED++))
    else
        log_error "Cannot connect to NoteSage database"
        ((CHECKS_FAILED++))
        HEALTH_STATUS=1
    fi
    
    # Check database size
    local db_size=$(sudo -u postgres psql -d notesage -t -c "SELECT pg_size_pretty(pg_database_size('notesage'));" 2>/dev/null | xargs)
    if [[ -n "$db_size" ]]; then
        log_success "Database size: $db_size"
        ((CHECKS_PASSED++))
    else
        log_warning "Could not determine database size"
        ((CHECKS_WARNING++))
    fi
}

# Check disk space
check_disk_space() {
    log "Checking disk space..."
    
    local paths=(
        "/opt/notesage"
        "/var/lib/notesage"
        "/var/log/notesage"
        "/etc/notesage"
    )
    
    for path in "${paths[@]}"; do
        if [[ -d "$path" ]]; then
            local usage=$(df -h "$path" | awk 'NR==2 {print $5}' | sed 's/%//')
            local available=$(df -h "$path" | awk 'NR==2 {print $4}')
            
            if [[ $usage -lt 80 ]]; then
                log_success "$path: ${usage}% used, ${available} available"
                ((CHECKS_PASSED++))
            elif [[ $usage -lt 90 ]]; then
                log_warning "$path: ${usage}% used, ${available} available"
                ((CHECKS_WARNING++))
            else
                log_error "$path: ${usage}% used, ${available} available (critically low)"
                ((CHECKS_FAILED++))
                HEALTH_STATUS=1
            fi
        else
            log_error "Directory $path does not exist"
            ((CHECKS_FAILED++))
            HEALTH_STATUS=1
        fi
    done
}

# Check memory usage
check_memory() {
    log "Checking memory usage..."
    
    local total_mem=$(free -m | awk 'NR==2{print $2}')
    local used_mem=$(free -m | awk 'NR==2{print $3}')
    local usage_percent=$((used_mem * 100 / total_mem))
    
    if [[ $usage_percent -lt 80 ]]; then
        log_success "Memory usage: ${usage_percent}% (${used_mem}MB/${total_mem}MB)"
        ((CHECKS_PASSED++))
    elif [[ $usage_percent -lt 90 ]]; then
        log_warning "Memory usage: ${usage_percent}% (${used_mem}MB/${total_mem}MB)"
        ((CHECKS_WARNING++))
    else
        log_error "Memory usage: ${usage_percent}% (${used_mem}MB/${total_mem}MB) - critically high"
        ((CHECKS_FAILED++))
        HEALTH_STATUS=1
    fi
    
    # Check NoteSage process memory
    local notesage_mem=$(ps -o pid,vsz,rss,comm -C notesage-server 2>/dev/null | tail -n +2 | awk '{print $3}')
    if [[ -n "$notesage_mem" ]]; then
        local notesage_mem_mb=$((notesage_mem / 1024))
        log_success "NoteSage process memory: ${notesage_mem_mb}MB"
        ((CHECKS_PASSED++))
    else
        log_warning "Could not determine NoteSage process memory usage"
        ((CHECKS_WARNING++))
    fi
}

# Check log files
check_logs() {
    log "Checking log files..."
    
    local log_files=(
        "/var/log/notesage/server.log"
        "/var/log/notesage/access.log"
    )
    
    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_file" ]]; then
            local size=$(du -h "$log_file" | cut -f1)
            local lines=$(wc -l < "$log_file")
            log_success "$log_file: $size, $lines lines"
            ((CHECKS_PASSED++))
            
            # Check for recent errors
            local recent_errors=$(tail -n 100 "$log_file" | grep -i error | wc -l)
            if [[ $recent_errors -eq 0 ]]; then
                log_success "No recent errors in $log_file"
                ((CHECKS_PASSED++))
            elif [[ $recent_errors -lt 5 ]]; then
                log_warning "$recent_errors recent errors in $log_file"
                ((CHECKS_WARNING++))
            else
                log_error "$recent_errors recent errors in $log_file"
                ((CHECKS_FAILED++))
                HEALTH_STATUS=1
            fi
        else
            log_warning "Log file $log_file does not exist"
            ((CHECKS_WARNING++))
        fi
    done
}

# Check configuration
check_configuration() {
    log "Checking configuration..."
    
    if [[ -f "$CONFIG_FILE" ]]; then
        log_success "Configuration file exists: $CONFIG_FILE"
        ((CHECKS_PASSED++))
        
        # Check file permissions
        local perms=$(stat -c "%a" "$CONFIG_FILE")
        if [[ "$perms" == "640" ]]; then
            log_success "Configuration file has correct permissions (640)"
            ((CHECKS_PASSED++))
        else
            log_warning "Configuration file permissions: $perms (should be 640)"
            ((CHECKS_WARNING++))
        fi
        
        # Validate YAML syntax
        if command -v python3 >/dev/null 2>&1; then
            if python3 -c "import yaml; yaml.safe_load(open('$CONFIG_FILE'))" 2>/dev/null; then
                log_success "Configuration file has valid YAML syntax"
                ((CHECKS_PASSED++))
            else
                log_error "Configuration file has invalid YAML syntax"
                ((CHECKS_FAILED++))
                HEALTH_STATUS=1
            fi
        fi
    else
        log_error "Configuration file not found: $CONFIG_FILE"
        ((CHECKS_FAILED++))
        HEALTH_STATUS=1
    fi
}

# Check network connectivity
check_network() {
    log "Checking network connectivity..."
    
    # Check if port is listening
    if netstat -ln | grep -q ":${NOTESAGE_PORT} "; then
        log_success "NoteSage is listening on port $NOTESAGE_PORT"
        ((CHECKS_PASSED++))
    else
        log_error "NoteSage is not listening on port $NOTESAGE_PORT"
        ((CHECKS_FAILED++))
        HEALTH_STATUS=1
    fi
    
    # Check firewall status
    if command -v ufw >/dev/null 2>&1; then
        if ufw status | grep -q "${NOTESAGE_PORT}/tcp"; then
            log_success "Firewall allows traffic on port $NOTESAGE_PORT"
            ((CHECKS_PASSED++))
        else
            log_warning "Firewall may be blocking port $NOTESAGE_PORT"
            ((CHECKS_WARNING++))
        fi
    fi
}

# Check backup status
check_backups() {
    log "Checking backup status..."
    
    local backup_dir="/var/lib/notesage/backups"
    
    if [[ -d "$backup_dir" ]]; then
        local backup_count=$(find "$backup_dir" -name "*.sql.gz" -mtime -7 | wc -l)
        
        if [[ $backup_count -gt 0 ]]; then
            log_success "$backup_count recent backups found"
            ((CHECKS_PASSED++))
            
            # Check latest backup
            local latest_backup=$(find "$backup_dir" -name "*.sql.gz" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
            if [[ -n "$latest_backup" ]]; then
                local backup_age=$(find "$latest_backup" -mtime +1 | wc -l)
                if [[ $backup_age -eq 0 ]]; then
                    log_success "Latest backup is recent: $(basename "$latest_backup")"
                    ((CHECKS_PASSED++))
                else
                    log_warning "Latest backup is older than 24 hours: $(basename "$latest_backup")"
                    ((CHECKS_WARNING++))
                fi
            fi
        else
            log_warning "No recent backups found"
            ((CHECKS_WARNING++))
        fi
    else
        log_warning "Backup directory does not exist: $backup_dir"
        ((CHECKS_WARNING++))
    fi
}

# Generate health report
generate_report() {
    echo
    echo "========================================"
    echo "  NoteSage Server Health Check Report"
    echo "========================================"
    echo "Date: $(date)"
    echo "Host: $(hostname)"
    echo
    echo "Summary:"
    echo "  ✓ Checks Passed: $CHECKS_PASSED"
    echo "  ⚠ Warnings: $CHECKS_WARNING"
    echo "  ✗ Checks Failed: $CHECKS_FAILED"
    echo
    
    if [[ $HEALTH_STATUS -eq 0 ]]; then
        if [[ $CHECKS_WARNING -eq 0 ]]; then
            echo -e "${GREEN}Overall Status: HEALTHY${NC}"
        else
            echo -e "${YELLOW}Overall Status: HEALTHY (with warnings)${NC}"
        fi
    else
        echo -e "${RED}Overall Status: UNHEALTHY${NC}"
    fi
    
    echo
    echo "Log file: $LOG_FILE"
    echo
}

# Main health check function
main() {
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log "Starting NoteSage health check..."
    
    check_service_status
    check_http_endpoint
    check_database
    check_disk_space
    check_memory
    check_logs
    check_configuration
    check_network
    check_backups
    
    generate_report
    
    exit $HEALTH_STATUS
}

# Handle script options
case "${1:-}" in
    --quiet)
        exec > /dev/null 2>&1
        main
        ;;
    --json)
        # Output JSON format for monitoring systems
        main > /dev/null 2>&1
        echo "{\"status\":\"$([ $HEALTH_STATUS -eq 0 ] && echo "healthy" || echo "unhealthy")\",\"checks_passed\":$CHECKS_PASSED,\"checks_failed\":$CHECKS_FAILED,\"warnings\":$CHECKS_WARNING,\"timestamp\":\"$(date -Iseconds)\"}"
        exit $HEALTH_STATUS
        ;;
    *)
        main
        ;;
esac
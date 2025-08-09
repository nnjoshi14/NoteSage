#!/bin/bash
# NoteSage Server Maintenance Script
# This script performs automated maintenance tasks

set -e

# Configuration
NOTESAGE_HOME="/opt/notesage"
NOTESAGE_CONFIG="/etc/notesage"
NOTESAGE_DATA="/var/lib/notesage"
LOG_FILE="/var/log/notesage/maintenance.log"
BACKUP_DIR="/var/lib/notesage/backups"
TEMP_DIR="/tmp/notesage-maintenance"

# Maintenance thresholds
MAX_LOG_SIZE_MB=1000
MAX_BACKUP_AGE_DAYS=90
MAX_TEMP_FILE_AGE_DAYS=7
MIN_FREE_SPACE_MB=1024
DATABASE_VACUUM_THRESHOLD_DAYS=7

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

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Create maintenance lock
create_maintenance_lock() {
    local lock_file="/var/run/notesage-maintenance.lock"
    
    if [[ -f "$lock_file" ]]; then
        local lock_pid=$(cat "$lock_file")
        if kill -0 "$lock_pid" 2>/dev/null; then
            log_error "Another maintenance process is already running (PID: $lock_pid)"
            exit 1
        else
            log_warning "Removing stale maintenance lock"
            rm -f "$lock_file"
        fi
    fi
    
    echo $$ > "$lock_file"
    log "Created maintenance lock: $lock_file"
    
    # Ensure lock is removed on exit
    trap 'rm -f "$lock_file"' EXIT
}

# Check disk space
check_disk_space() {
    log "Checking disk space..."
    
    local paths=(
        "/opt/notesage"
        "/var/lib/notesage"
        "/var/log/notesage"
        "/etc/notesage"
        "/tmp"
    )
    
    local critical_space=false
    
    for path in "${paths[@]}"; do
        if [[ -d "$path" ]]; then
            local available_kb=$(df "$path" | awk 'NR==2 {print $4}')
            local available_mb=$((available_kb / 1024))
            local usage_percent=$(df "$path" | awk 'NR==2 {print $5}' | sed 's/%//')
            
            if [[ $available_mb -lt $MIN_FREE_SPACE_MB ]]; then
                log_error "$path: Only ${available_mb}MB available (critical)"
                critical_space=true
            elif [[ $usage_percent -gt 90 ]]; then
                log_warning "$path: ${usage_percent}% used, ${available_mb}MB available"
            else
                log_success "$path: ${usage_percent}% used, ${available_mb}MB available"
            fi
        fi
    done
    
    if [[ "$critical_space" == "true" ]]; then
        log_error "Critical disk space detected, running emergency cleanup"
        emergency_cleanup
    fi
}

# Emergency cleanup when disk space is critical
emergency_cleanup() {
    log "Running emergency cleanup..."
    
    # Remove old compressed logs
    find /var/log/notesage -name "*.gz" -mtime +3 -delete 2>/dev/null || true
    log "Removed old compressed logs"
    
    # Remove old backup files (keep only last 7 days)
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
    log "Removed old backup files"
    
    # Clean temporary files
    find /tmp -name "notesage-*" -mtime +1 -delete 2>/dev/null || true
    log "Cleaned temporary files"
    
    # Clean package cache if available
    if command -v apt-get >/dev/null 2>&1; then
        apt-get clean 2>/dev/null || true
        log "Cleaned package cache"
    fi
}

# Clean up log files
cleanup_logs() {
    log "Cleaning up log files..."
    
    local cleaned_count=0
    local saved_space=0
    
    # Find large log files
    while IFS= read -r -d '' logfile; do
        local size_mb=$(du -m "$logfile" | cut -f1)
        
        if [[ $size_mb -gt $MAX_LOG_SIZE_MB ]]; then
            log_warning "Large log file detected: $logfile (${size_mb}MB)"
            
            # Truncate the log file to last 10000 lines
            local temp_file=$(mktemp)
            tail -n 10000 "$logfile" > "$temp_file"
            cat "$temp_file" > "$logfile"
            rm -f "$temp_file"
            
            local new_size_mb=$(du -m "$logfile" | cut -f1)
            local saved=$((size_mb - new_size_mb))
            saved_space=$((saved_space + saved))
            cleaned_count=$((cleaned_count + 1))
            
            log_success "Truncated $logfile, saved ${saved}MB"
        fi
    done < <(find /var/log/notesage -name "*.log" -type f -print0 2>/dev/null)
    
    if [[ $cleaned_count -gt 0 ]]; then
        log_success "Cleaned $cleaned_count log files, saved ${saved_space}MB"
    else
        log "No large log files found"
    fi
    
    # Remove old rotated logs
    local old_logs=$(find /var/log/notesage -name "*.log.*" -mtime +30 2>/dev/null | wc -l)
    if [[ $old_logs -gt 0 ]]; then
        find /var/log/notesage -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
        log_success "Removed $old_logs old rotated log files"
    fi
}

# Clean up backup files
cleanup_backups() {
    log "Cleaning up old backup files..."
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "Backup directory does not exist: $BACKUP_DIR"
        return 0
    fi
    
    local cleaned_count=0
    local saved_space=0
    
    # Remove old backup files
    while IFS= read -r -d '' backup_file; do
        local size_mb=$(du -m "$backup_file" | cut -f1)
        saved_space=$((saved_space + size_mb))
        cleaned_count=$((cleaned_count + 1))
        rm -f "$backup_file"
    done < <(find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.sql.gz" -mtime +$MAX_BACKUP_AGE_DAYS -print0 2>/dev/null)
    
    if [[ $cleaned_count -gt 0 ]]; then
        log_success "Removed $cleaned_count old backup files, saved ${saved_space}MB"
    else
        log "No old backup files found"
    fi
    
    # Clean up empty backup directories
    find "$BACKUP_DIR" -type d -empty -delete 2>/dev/null || true
}

# Clean up temporary files
cleanup_temp_files() {
    log "Cleaning up temporary files..."
    
    local cleaned_count=0
    local saved_space=0
    
    # Clean NoteSage temporary files
    while IFS= read -r -d '' temp_file; do
        local size_mb=$(du -m "$temp_file" | cut -f1)
        saved_space=$((saved_space + size_mb))
        cleaned_count=$((cleaned_count + 1))
        rm -rf "$temp_file"
    done < <(find /tmp -name "notesage-*" -mtime +$MAX_TEMP_FILE_AGE_DAYS -print0 2>/dev/null)
    
    # Clean up maintenance temp directory
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
        mkdir -p "$TEMP_DIR"
    fi
    
    if [[ $cleaned_count -gt 0 ]]; then
        log_success "Removed $cleaned_count temporary files, saved ${saved_space}MB"
    else
        log "No old temporary files found"
    fi
}

# Optimize database
optimize_database() {
    log "Optimizing database..."
    
    # Check if database optimization is needed
    local last_vacuum_file="/var/lib/notesage/.last_vacuum"
    local needs_vacuum=false
    
    if [[ ! -f "$last_vacuum_file" ]]; then
        needs_vacuum=true
    else
        local last_vacuum=$(cat "$last_vacuum_file")
        local days_since_vacuum=$(( ($(date +%s) - last_vacuum) / 86400 ))
        
        if [[ $days_since_vacuum -gt $DATABASE_VACUUM_THRESHOLD_DAYS ]]; then
            needs_vacuum=true
        fi
    fi
    
    if [[ "$needs_vacuum" == "true" ]]; then
        log "Running database vacuum and analyze..."
        
        # Run VACUUM and ANALYZE on PostgreSQL
        if sudo -u postgres psql -d notesage -c "VACUUM ANALYZE;" 2>/dev/null; then
            log_success "Database vacuum completed"
            echo "$(date +%s)" > "$last_vacuum_file"
            chown notesage:notesage "$last_vacuum_file"
        else
            log_error "Database vacuum failed"
        fi
    else
        log "Database vacuum not needed (last run $days_since_vacuum days ago)"
    fi
    
    # Update database statistics
    if sudo -u postgres psql -d notesage -c "ANALYZE;" 2>/dev/null; then
        log_success "Database statistics updated"
    else
        log_warning "Failed to update database statistics"
    fi
}

# Check service health
check_service_health() {
    log "Checking service health..."
    
    # Check if service is running
    if systemctl is-active --quiet notesage; then
        log_success "NoteSage service is running"
        
        # Check if service is responding
        if curl -f -s --max-time 10 "http://localhost:8080/health" >/dev/null 2>&1; then
            log_success "Service is responding to health checks"
        else
            log_warning "Service is running but not responding to health checks"
            
            # Try to restart the service
            log "Attempting to restart service..."
            if systemctl restart notesage; then
                sleep 10
                if curl -f -s --max-time 10 "http://localhost:8080/health" >/dev/null 2>&1; then
                    log_success "Service restarted and is now responding"
                else
                    log_error "Service restarted but still not responding"
                fi
            else
                log_error "Failed to restart service"
            fi
        fi
    else
        log_error "NoteSage service is not running"
        
        # Try to start the service
        log "Attempting to start service..."
        if systemctl start notesage; then
            log_success "Service started successfully"
        else
            log_error "Failed to start service"
        fi
    fi
    
    # Check service logs for errors
    local error_count=$(journalctl -u notesage --since "1 hour ago" --no-pager | grep -i error | wc -l)
    if [[ $error_count -gt 0 ]]; then
        log_warning "Found $error_count errors in service logs in the last hour"
    else
        log_success "No errors found in recent service logs"
    fi
}

# Update system packages (optional)
update_system_packages() {
    log "Checking for system updates..."
    
    if command -v apt-get >/dev/null 2>&1; then
        # Update package list
        if apt-get update >/dev/null 2>&1; then
            log_success "Package list updated"
            
            # Check for available updates
            local updates=$(apt list --upgradable 2>/dev/null | grep -c upgradable || echo "0")
            if [[ $updates -gt 0 ]]; then
                log_warning "$updates system packages can be updated"
                
                # Only update security packages automatically
                if apt-get -s upgrade | grep -q "security"; then
                    log "Installing security updates..."
                    if DEBIAN_FRONTEND=noninteractive apt-get -y upgrade -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" 2>/dev/null; then
                        log_success "Security updates installed"
                    else
                        log_warning "Some security updates failed to install"
                    fi
                fi
            else
                log_success "System packages are up to date"
            fi
        else
            log_warning "Failed to update package list"
        fi
    fi
}

# Generate maintenance report
generate_maintenance_report() {
    log "Generating maintenance report..."
    
    local report_file="/var/log/notesage/maintenance_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
NoteSage Server Maintenance Report
Generated: $(date)
Hostname: $(hostname)

=== System Information ===
Uptime: $(uptime)
Load Average: $(cat /proc/loadavg)
Memory Usage: $(free -h | grep Mem)
Disk Usage:
$(df -h | grep -E "(Filesystem|/dev/)")

=== Service Status ===
NoteSage Service: $(systemctl is-active notesage)
PostgreSQL Service: $(systemctl is-active postgresql)

=== Database Information ===
Database Size: $(sudo -u postgres psql -d notesage -t -c "SELECT pg_size_pretty(pg_database_size('notesage'));" 2>/dev/null | xargs || echo "unknown")
Active Connections: $(sudo -u postgres psql -d notesage -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='notesage';" 2>/dev/null | xargs || echo "unknown")

=== Log File Sizes ===
$(du -sh /var/log/notesage/*.log 2>/dev/null || echo "No log files found")

=== Backup Information ===
Backup Directory Size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
Number of Backups: $(find "$BACKUP_DIR" -name "*.sql.gz" 2>/dev/null | wc -l)
Latest Backup: $(find "$BACKUP_DIR" -name "*.sql.gz" -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- | xargs basename 2>/dev/null || echo "none")

=== Recent Errors ===
$(journalctl -u notesage --since "24 hours ago" --no-pager | grep -i error | tail -10 || echo "No recent errors")

=== Maintenance Actions Taken ===
$(tail -50 "$LOG_FILE" | grep -E "(✓|⚠|✗)" || echo "No recent maintenance actions")

EOF

    chown notesage:notesage "$report_file"
    log_success "Maintenance report generated: $report_file"
    
    # Send report via email if configured
    if command -v mail >/dev/null 2>&1 && [[ -n "${ADMIN_EMAIL:-}" ]]; then
        mail -s "NoteSage Maintenance Report - $(hostname)" "$ADMIN_EMAIL" < "$report_file"
        log_success "Maintenance report sent to $ADMIN_EMAIL"
    fi
}

# Main maintenance function
run_maintenance() {
    local maintenance_type="${1:-full}"
    
    log "Starting NoteSage server maintenance (type: $maintenance_type)..."
    
    # Create maintenance lock
    create_maintenance_lock
    
    # Create temp directory
    mkdir -p "$TEMP_DIR"
    
    case "$maintenance_type" in
        "quick")
            check_disk_space
            check_service_health
            ;;
        "cleanup")
            check_disk_space
            cleanup_logs
            cleanup_backups
            cleanup_temp_files
            ;;
        "database")
            optimize_database
            ;;
        "full")
            check_disk_space
            cleanup_logs
            cleanup_backups
            cleanup_temp_files
            optimize_database
            check_service_health
            update_system_packages
            generate_maintenance_report
            ;;
        *)
            log_error "Unknown maintenance type: $maintenance_type"
            exit 1
            ;;
    esac
    
    # Cleanup temp directory
    rm -rf "$TEMP_DIR"
    
    log_success "Maintenance completed successfully"
}

# Show usage information
show_usage() {
    echo "NoteSage Server Maintenance Script"
    echo
    echo "Usage: $0 [OPTIONS] [TYPE]"
    echo
    echo "Maintenance Types:"
    echo "  quick      Quick health check and disk space check"
    echo "  cleanup    Clean up logs, backups, and temporary files"
    echo "  database   Optimize database performance"
    echo "  full       Complete maintenance (default)"
    echo
    echo "Options:"
    echo "  --dry-run  Show what would be done without executing"
    echo "  --quiet    Suppress output (log to file only)"
    echo "  --help     Show this help message"
    echo
    echo "Examples:"
    echo "  $0                Run full maintenance"
    echo "  $0 quick          Run quick health check"
    echo "  $0 cleanup        Clean up old files"
    echo "  $0 --dry-run      Show what would be done"
    echo
}

# Parse command line arguments
DRY_RUN=false
QUIET=false
MAINTENANCE_TYPE="full"

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        quick|cleanup|database|full)
            MAINTENANCE_TYPE="$1"
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

# Run maintenance
if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY RUN MODE - No changes will be made"
    log "Would run maintenance type: $MAINTENANCE_TYPE"
    exit 0
fi

run_maintenance "$MAINTENANCE_TYPE"
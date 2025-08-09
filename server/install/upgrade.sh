#!/bin/bash
# NoteSage Server Upgrade Script
# This script upgrades the NoteSage server to the latest version

set -e

# Configuration
NOTESAGE_HOME="/opt/notesage"
NOTESAGE_CONFIG="/etc/notesage"
NOTESAGE_DATA="/var/lib/notesage"
LOG_FILE="/var/log/notesage/upgrade.log"
BACKUP_DIR="/var/lib/notesage/backups"
GITHUB_REPO="notesage/server"
CURRENT_VERSION_FILE="/opt/notesage/VERSION"

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

# Get current version
get_current_version() {
    if [[ -f "$CURRENT_VERSION_FILE" ]]; then
        cat "$CURRENT_VERSION_FILE"
    elif [[ -x "$NOTESAGE_HOME/notesage-server" ]]; then
        # Try to get version from binary
        "$NOTESAGE_HOME/notesage-server" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown"
    else
        echo "unknown"
    fi
}

# Get latest version from GitHub
get_latest_version() {
    if command -v curl >/dev/null 2>&1; then
        curl -s "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | \
            grep '"tag_name":' | \
            sed -E 's/.*"([^"]+)".*/\1/' | \
            sed 's/^v//'
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | \
            grep '"tag_name":' | \
            sed -E 's/.*"([^"]+)".*/\1/' | \
            sed 's/^v//'
    else
        log_error "Neither curl nor wget is available"
        return 1
    fi
}

# Compare versions
version_compare() {
    local version1="$1"
    local version2="$2"
    
    if [[ "$version1" == "$version2" ]]; then
        return 0  # Equal
    fi
    
    local IFS=.
    local i ver1=($version1) ver2=($version2)
    
    # Fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 1  # version1 > version2
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2  # version1 < version2
        fi
    done
    
    return 0  # Equal
}

# Check for updates
check_for_updates() {
    log "Checking for updates..."
    
    local current_version=$(get_current_version)
    local latest_version=$(get_latest_version)
    
    if [[ -z "$latest_version" ]] || [[ "$latest_version" == "null" ]]; then
        log_error "Could not fetch latest version information"
        return 1
    fi
    
    log "Current version: $current_version"
    log "Latest version: $latest_version"
    
    version_compare "$current_version" "$latest_version"
    local result=$?
    
    case $result in
        0)
            log_success "NoteSage is already up to date"
            return 1
            ;;
        1)
            log_warning "Current version is newer than latest release"
            return 1
            ;;
        2)
            log "Update available: $current_version → $latest_version"
            return 0
            ;;
    esac
}

# Create pre-upgrade backup
create_pre_upgrade_backup() {
    log "Creating pre-upgrade backup..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="pre_upgrade_${timestamp}"
    
    # Use the backup script if available
    if [[ -x "$NOTESAGE_HOME/../install/backup.sh" ]]; then
        if "$NOTESAGE_HOME/../install/backup.sh" create --backup-dir "$BACKUP_DIR/upgrades"; then
            log_success "Pre-upgrade backup created"
            echo "$backup_name"
            return 0
        else
            log_error "Failed to create pre-upgrade backup"
            return 1
        fi
    else
        # Manual backup
        local backup_dir="$BACKUP_DIR/upgrades/$backup_name"
        mkdir -p "$backup_dir"
        
        # Backup binary
        if [[ -f "$NOTESAGE_HOME/notesage-server" ]]; then
            cp "$NOTESAGE_HOME/notesage-server" "$backup_dir/notesage-server.backup"
        fi
        
        # Backup configuration
        if [[ -d "$NOTESAGE_CONFIG" ]]; then
            tar -czf "$backup_dir/config.tar.gz" -C "$NOTESAGE_CONFIG" .
        fi
        
        # Backup database
        if sudo -u postgres pg_dump notesage | gzip > "$backup_dir/database.sql.gz"; then
            log_success "Pre-upgrade backup created: $backup_dir"
            echo "$backup_name"
            return 0
        else
            log_error "Failed to create database backup"
            return 1
        fi
    fi
}

# Download new version
download_new_version() {
    local version="$1"
    local temp_dir="/tmp/notesage-upgrade-$$"
    
    log "Downloading NoteSage server version $version..."
    
    mkdir -p "$temp_dir"
    
    local download_url="https://github.com/$GITHUB_REPO/releases/download/v${version}/notesage-server-linux-amd64"
    local binary_path="$temp_dir/notesage-server"
    
    if command -v curl >/dev/null 2>&1; then
        if curl -L -o "$binary_path" "$download_url"; then
            log_success "Downloaded new version"
        else
            log_error "Failed to download new version"
            rm -rf "$temp_dir"
            return 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -O "$binary_path" "$download_url"; then
            log_success "Downloaded new version"
        else
            log_error "Failed to download new version"
            rm -rf "$temp_dir"
            return 1
        fi
    else
        log_error "Neither curl nor wget is available"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Verify download
    if [[ ! -f "$binary_path" ]] || [[ ! -s "$binary_path" ]]; then
        log_error "Downloaded file is empty or missing"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Make executable
    chmod +x "$binary_path"
    
    # Test binary
    if "$binary_path" --version >/dev/null 2>&1; then
        log_success "New binary is valid"
        echo "$binary_path"
        return 0
    else
        log_error "Downloaded binary is not valid"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Stop NoteSage service
stop_service() {
    log "Stopping NoteSage service..."
    
    if systemctl is-active --quiet notesage; then
        systemctl stop notesage
        
        # Wait for service to stop
        local timeout=30
        while systemctl is-active --quiet notesage && [[ $timeout -gt 0 ]]; do
            sleep 1
            ((timeout--))
        done
        
        if systemctl is-active --quiet notesage; then
            log_error "Service did not stop within timeout"
            return 1
        else
            log_success "NoteSage service stopped"
        fi
    else
        log "NoteSage service is not running"
    fi
}

# Install new binary
install_new_binary() {
    local new_binary="$1"
    local version="$2"
    
    log "Installing new binary..."
    
    # Backup current binary
    if [[ -f "$NOTESAGE_HOME/notesage-server" ]]; then
        cp "$NOTESAGE_HOME/notesage-server" "$NOTESAGE_HOME/notesage-server.backup"
        log_success "Current binary backed up"
    fi
    
    # Install new binary
    cp "$new_binary" "$NOTESAGE_HOME/notesage-server"
    chown notesage:notesage "$NOTESAGE_HOME/notesage-server"
    chmod +x "$NOTESAGE_HOME/notesage-server"
    
    # Update version file
    echo "$version" > "$CURRENT_VERSION_FILE"
    chown notesage:notesage "$CURRENT_VERSION_FILE"
    
    log_success "New binary installed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    if sudo -u notesage "$NOTESAGE_HOME/notesage-server" migrate --config "$NOTESAGE_CONFIG/config.yaml"; then
        log_success "Database migrations completed"
    else
        log_error "Database migrations failed"
        return 1
    fi
}

# Start NoteSage service
start_service() {
    log "Starting NoteSage service..."
    
    systemctl start notesage
    
    # Wait for service to start
    local timeout=60
    while ! systemctl is-active --quiet notesage && [[ $timeout -gt 0 ]]; do
        sleep 1
        ((timeout--))
    done
    
    if systemctl is-active --quiet notesage; then
        log_success "NoteSage service started"
        
        # Test health endpoint
        sleep 5
        if curl -f -s --max-time 10 "http://localhost:8080/health" >/dev/null; then
            log_success "Service is responding to health checks"
        else
            log_warning "Service started but health check failed"
        fi
    else
        log_error "Failed to start NoteSage service"
        return 1
    fi
}

# Rollback upgrade with comprehensive recovery
rollback_upgrade() {
    local backup_name="$1"
    local rollback_reason="${2:-Unknown error}"
    
    log_error "Rolling back upgrade due to: $rollback_reason"
    
    # Create rollback log
    local rollback_log="/var/log/notesage/rollback_$(date +%Y%m%d_%H%M%S).log"
    exec 3>&1 4>&2
    exec 1> >(tee -a "$rollback_log")
    exec 2> >(tee -a "$rollback_log" >&2)
    
    # Stop service gracefully
    log "Stopping NoteSage service for rollback..."
    if systemctl is-active --quiet notesage; then
        systemctl stop notesage
        
        # Wait for service to stop
        local timeout=30
        while systemctl is-active --quiet notesage && [[ $timeout -gt 0 ]]; do
            sleep 1
            ((timeout--))
        done
        
        if systemctl is-active --quiet notesage; then
            log_warning "Service did not stop gracefully, forcing stop"
            systemctl kill notesage
            sleep 5
        fi
    fi
    
    # Restore binary
    if [[ -f "$NOTESAGE_HOME/notesage-server.backup" ]]; then
        log "Restoring binary from backup..."
        cp "$NOTESAGE_HOME/notesage-server.backup" "$NOTESAGE_HOME/notesage-server"
        chown notesage:notesage "$NOTESAGE_HOME/notesage-server"
        chmod +x "$NOTESAGE_HOME/notesage-server"
        log_success "Binary restored from backup"
    else
        log_error "No binary backup found"
    fi
    
    # Restore database if backup exists
    local backup_dir="$BACKUP_DIR/upgrades/$backup_name"
    if [[ -f "$backup_dir/database.sql.gz" ]]; then
        log "Restoring database from backup..."
        
        # Create database backup before rollback (in case rollback fails)
        local pre_rollback_backup="/tmp/pre_rollback_$(date +%Y%m%d_%H%M%S).sql"
        if sudo -u postgres pg_dump notesage > "$pre_rollback_backup" 2>/dev/null; then
            log "Created pre-rollback database backup: $pre_rollback_backup"
        fi
        
        # Terminate active connections to the database
        sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'notesage' AND pid <> pg_backend_pid();" 2>/dev/null || true
        
        # Drop and recreate database
        sudo -u postgres dropdb notesage 2>/dev/null || true
        sudo -u postgres createdb notesage
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE notesage TO notesage;" 2>/dev/null
        
        # Restore database
        if gunzip -c "$backup_dir/database.sql.gz" | sudo -u postgres psql notesage 2>/dev/null; then
            log_success "Database restored from backup"
        else
            log_error "Failed to restore database from backup"
            
            # Try to restore from pre-rollback backup
            if [[ -f "$pre_rollback_backup" ]]; then
                log "Attempting to restore from pre-rollback backup..."
                sudo -u postgres dropdb notesage 2>/dev/null || true
                sudo -u postgres createdb notesage
                sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE notesage TO notesage;" 2>/dev/null
                
                if sudo -u postgres psql notesage < "$pre_rollback_backup" 2>/dev/null; then
                    log_warning "Restored from pre-rollback backup"
                else
                    log_error "Failed to restore from pre-rollback backup"
                fi
            fi
        fi
        
        # Clean up temporary backup
        rm -f "$pre_rollback_backup"
    else
        log_warning "No database backup found for rollback"
    fi
    
    # Restore configuration if backup exists
    if [[ -f "$backup_dir/config.tar.gz" ]]; then
        log "Restoring configuration from backup..."
        if tar -xzf "$backup_dir/config.tar.gz" -C "$NOTESAGE_CONFIG" 2>/dev/null; then
            log_success "Configuration restored from backup"
        else
            log_error "Failed to restore configuration from backup"
        fi
    fi
    
    # Restore version file
    if [[ -f "$backup_dir/VERSION" ]]; then
        cp "$backup_dir/VERSION" "$CURRENT_VERSION_FILE" 2>/dev/null || true
    fi
    
    # Start service
    log "Starting NoteSage service after rollback..."
    systemctl start notesage
    
    # Wait for service to start and verify
    local timeout=60
    while ! systemctl is-active --quiet notesage && [[ $timeout -gt 0 ]]; do
        sleep 1
        ((timeout--))
    done
    
    if systemctl is-active --quiet notesage; then
        log_success "NoteSage service started after rollback"
        
        # Test health endpoint
        sleep 10
        if curl -f -s --max-time 10 "http://localhost:8080/health" >/dev/null 2>&1; then
            log_success "Service is responding to health checks after rollback"
        else
            log_warning "Service started but health check failed after rollback"
        fi
    else
        log_error "Failed to start NoteSage service after rollback"
        
        # Try to diagnose the issue
        log "Service status:"
        systemctl status notesage --no-pager || true
        
        log "Recent service logs:"
        journalctl -u notesage --no-pager -n 20 || true
    fi
    
    # Restore original stdout/stderr
    exec 1>&3 2>&4
    exec 3>&- 4>&-
    
    log_warning "Rollback completed. Check rollback log: $rollback_log"
    
    # Send rollback notification
    send_upgrade_notification "rollback" "$(get_current_version)" "unknown" "Rollback completed due to: $rollback_reason"
}

# Test rollback functionality
test_rollback() {
    log "Testing rollback functionality..."
    
    # Check if we have necessary tools
    local missing_tools=()
    
    if ! command -v pg_dump >/dev/null 2>&1; then
        missing_tools+=("pg_dump")
    fi
    
    if ! command -v systemctl >/dev/null 2>&1; then
        missing_tools+=("systemctl")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools for rollback: ${missing_tools[*]}"
        return 1
    fi
    
    # Check database connectivity
    if ! sudo -u postgres psql -d notesage -c "SELECT 1;" >/dev/null 2>&1; then
        log_error "Cannot connect to database for rollback test"
        return 1
    fi
    
    # Check service management
    if ! systemctl status notesage >/dev/null 2>&1; then
        log_error "Cannot manage NoteSage service for rollback"
        return 1
    fi
    
    # Check backup directory
    if [[ ! -w "$BACKUP_DIR" ]]; then
        log_error "Backup directory is not writable: $BACKUP_DIR"
        return 1
    fi
    
    log_success "Rollback functionality test passed"
    return 0
}

# Create rollback point manually
create_rollback_point() {
    local point_name="${1:-manual_$(date +%Y%m%d_%H%M%S)}"
    
    log "Creating rollback point: $point_name"
    
    local rollback_dir="$BACKUP_DIR/rollback_points/$point_name"
    mkdir -p "$rollback_dir"
    
    # Backup current binary
    if [[ -f "$NOTESAGE_HOME/notesage-server" ]]; then
        cp "$NOTESAGE_HOME/notesage-server" "$rollback_dir/notesage-server"
        log_success "Binary backed up"
    fi
    
    # Backup current version
    if [[ -f "$CURRENT_VERSION_FILE" ]]; then
        cp "$CURRENT_VERSION_FILE" "$rollback_dir/VERSION"
    fi
    
    # Backup configuration
    if [[ -d "$NOTESAGE_CONFIG" ]]; then
        tar -czf "$rollback_dir/config.tar.gz" -C "$NOTESAGE_CONFIG" . 2>/dev/null
        log_success "Configuration backed up"
    fi
    
    # Backup database
    if sudo -u postgres pg_dump notesage | gzip > "$rollback_dir/database.sql.gz" 2>/dev/null; then
        log_success "Database backed up"
    else
        log_error "Failed to backup database"
        return 1
    fi
    
    # Create rollback metadata
    cat > "$rollback_dir/metadata.json" << EOF
{
  "name": "$point_name",
  "created_at": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "version": "$(get_current_version)",
  "created_by": "manual"
}
EOF
    
    chown -R notesage:notesage "$rollback_dir"
    chmod -R 640 "$rollback_dir"/*
    
    log_success "Rollback point created: $rollback_dir"
    echo "$point_name"
}

# List available rollback points
list_rollback_points() {
    log "Available rollback points:"
    
    local rollback_points_dir="$BACKUP_DIR/rollback_points"
    if [[ ! -d "$rollback_points_dir" ]]; then
        echo "No rollback points found."
        return 0
    fi
    
    for point_dir in "$rollback_points_dir"/*; do
        if [[ -d "$point_dir" ]]; then
            local point_name=$(basename "$point_dir")
            local metadata_file="$point_dir/metadata.json"
            
            if [[ -f "$metadata_file" ]] && command -v jq >/dev/null 2>&1; then
                local created_at=$(jq -r '.created_at' "$metadata_file" 2>/dev/null)
                local version=$(jq -r '.version' "$metadata_file" 2>/dev/null)
                echo "  $point_name (version: $version, created: $created_at)"
            else
                echo "  $point_name"
            fi
        fi
    done
}

# Restore from rollback point
restore_from_rollback_point() {
    local point_name="$1"
    
    if [[ -z "$point_name" ]]; then
        log_error "Rollback point name is required"
        return 1
    fi
    
    local rollback_dir="$BACKUP_DIR/rollback_points/$point_name"
    
    if [[ ! -d "$rollback_dir" ]]; then
        log_error "Rollback point not found: $point_name"
        return 1
    fi
    
    log "Restoring from rollback point: $point_name"
    
    # Use the same rollback logic but with different backup location
    rollback_upgrade "$point_name" "Manual restore from rollback point"
}

# Cleanup temporary files
cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove temporary directories
    rm -rf /tmp/notesage-upgrade-*
    
    # Remove backup binary if upgrade was successful
    if [[ -f "$NOTESAGE_HOME/notesage-server.backup" ]]; then
        rm -f "$NOTESAGE_HOME/notesage-server.backup"
    fi
    
    log_success "Cleanup completed"
}

# Validate upgrade prerequisites
validate_prerequisites() {
    log "Validating upgrade prerequisites..."
    
    # Check disk space (need at least 500MB free)
    local free_space=$(df /opt/notesage | awk 'NR==2 {print $4}')
    local required_space=512000  # 500MB in KB
    
    if [[ $free_space -lt $required_space ]]; then
        log_error "Insufficient disk space. Need at least 500MB free, have $(($free_space/1024))MB"
        return 1
    fi
    
    # Check if backup directory is writable
    if [[ ! -w "$BACKUP_DIR" ]]; then
        log_error "Backup directory is not writable: $BACKUP_DIR"
        return 1
    fi
    
    # Check database connectivity
    if ! sudo -u postgres psql -d notesage -c "SELECT 1;" >/dev/null 2>&1; then
        log_error "Cannot connect to database"
        return 1
    fi
    
    # Check if service is manageable
    if ! systemctl status notesage >/dev/null 2>&1; then
        log_error "Cannot manage NoteSage service"
        return 1
    fi
    
    log_success "Prerequisites validation passed"
    return 0
}

# Test new binary before installation
test_new_binary() {
    local binary_path="$1"
    
    log "Testing new binary..."
    
    # Test version command
    if ! "$binary_path" --version >/dev/null 2>&1; then
        log_error "New binary version command failed"
        return 1
    fi
    
    # Test config validation
    if ! "$binary_path" validate-config --config "$NOTESAGE_CONFIG/config.yaml" >/dev/null 2>&1; then
        log_warning "New binary config validation failed (may be expected for new features)"
    fi
    
    # Test database connection (dry run)
    if ! "$binary_path" test-db --config "$NOTESAGE_CONFIG/config.yaml" >/dev/null 2>&1; then
        log_error "New binary cannot connect to database"
        return 1
    fi
    
    log_success "New binary tests passed"
    return 0
}

# Create upgrade lock to prevent concurrent upgrades
create_upgrade_lock() {
    local lock_file="/var/run/notesage-upgrade.lock"
    
    if [[ -f "$lock_file" ]]; then
        local lock_pid=$(cat "$lock_file")
        if kill -0 "$lock_pid" 2>/dev/null; then
            log_error "Another upgrade is already in progress (PID: $lock_pid)"
            return 1
        else
            log_warning "Removing stale upgrade lock"
            rm -f "$lock_file"
        fi
    fi
    
    echo $$ > "$lock_file"
    log "Created upgrade lock: $lock_file"
    return 0
}

# Remove upgrade lock
remove_upgrade_lock() {
    local lock_file="/var/run/notesage-upgrade.lock"
    rm -f "$lock_file"
    log "Removed upgrade lock"
}

# Send upgrade notifications
send_upgrade_notification() {
    local status="$1"
    local from_version="$2"
    local to_version="$3"
    local details="$4"
    
    # Log to system journal
    if [[ "$status" == "success" ]]; then
        logger -t notesage-upgrade "Upgrade completed successfully: $from_version → $to_version"
    else
        logger -t notesage-upgrade "Upgrade failed: $from_version → $to_version - $details"
    fi
    
    # Send email notification if configured
    if command -v mail >/dev/null 2>&1 && [[ -n "${ADMIN_EMAIL:-}" ]]; then
        local subject="NoteSage Upgrade $status: $from_version → $to_version"
        local body="Upgrade $status on $(hostname) at $(date)\n\nDetails: $details\n\nLog: $LOG_FILE"
        echo -e "$body" | mail -s "$subject" "$ADMIN_EMAIL"
    fi
    
    # Webhook notification if configured
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        local payload="{\"status\":\"$status\",\"from_version\":\"$from_version\",\"to_version\":\"$to_version\",\"hostname\":\"$(hostname)\",\"timestamp\":\"$(date -Iseconds)\",\"details\":\"$details\"}"
        curl -X POST -H "Content-Type: application/json" -d "$payload" "$WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
}

# Main upgrade function
perform_upgrade() {
    local force="$1"
    local target_version="$2"
    
    log "Starting NoteSage server upgrade..."
    
    # Create upgrade lock
    if ! create_upgrade_lock; then
        return 1
    fi
    
    # Ensure lock is removed on exit
    trap remove_upgrade_lock EXIT
    
    # Validate prerequisites
    if ! validate_prerequisites; then
        log_error "Prerequisites validation failed"
        return 1
    fi
    
    # Check for updates
    local current_version=$(get_current_version)
    local latest_version
    
    if [[ -n "$target_version" ]]; then
        latest_version="$target_version"
        log "Upgrading to specified version: $latest_version"
    else
        latest_version=$(get_latest_version)
        if ! check_for_updates && [[ "$force" != "true" ]]; then
            return 0
        fi
    fi
    
    # Confirm upgrade
    if [[ "$force" != "true" ]]; then
        echo
        log "Upgrade will update from $current_version to $latest_version"
        read -p "Do you want to continue? (yes/no): " confirm
        
        if [[ "$confirm" != "yes" ]]; then
            log "Upgrade cancelled by user"
            return 0
        fi
    fi
    
    # Create pre-upgrade backup
    local backup_name
    if ! backup_name=$(create_pre_upgrade_backup); then
        log_error "Failed to create pre-upgrade backup"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Backup creation failed"
        return 1
    fi
    
    # Download new version
    local new_binary
    if ! new_binary=$(download_new_version "$latest_version"); then
        log_error "Failed to download new version"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Download failed"
        return 1
    fi
    
    # Test new binary
    if ! test_new_binary "$new_binary"; then
        log_error "New binary failed tests"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Binary validation failed"
        cleanup
        return 1
    fi
    
    # Stop service
    if ! stop_service; then
        log_error "Failed to stop service"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Service stop failed"
        cleanup
        return 1
    fi
    
    # Install new binary
    if ! install_new_binary "$new_binary" "$latest_version"; then
        log_error "Failed to install new binary"
        rollback_upgrade "$backup_name"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Binary installation failed"
        cleanup
        return 1
    fi
    
    # Run migrations
    if ! run_migrations; then
        log_error "Database migrations failed"
        rollback_upgrade "$backup_name"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Database migration failed"
        cleanup
        return 1
    fi
    
    # Start service
    if ! start_service; then
        log_error "Failed to start service after upgrade"
        rollback_upgrade "$backup_name"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Service start failed"
        cleanup
        return 1
    fi
    
    # Post-upgrade validation
    sleep 10  # Allow service to fully start
    if ! curl -f -s --max-time 10 "http://localhost:8080/health" >/dev/null; then
        log_error "Service health check failed after upgrade"
        rollback_upgrade "$backup_name"
        send_upgrade_notification "failed" "$current_version" "$latest_version" "Post-upgrade health check failed"
        cleanup
        return 1
    fi
    
    # Cleanup
    cleanup
    
    log_success "Upgrade completed successfully!"
    log "NoteSage server upgraded from $current_version to $latest_version"
    send_upgrade_notification "success" "$current_version" "$latest_version" "Upgrade completed successfully"
    
    return 0
}

# Show usage information
show_usage() {
    echo "NoteSage Server Upgrade Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  check               Check for available updates"
    echo "  upgrade             Perform upgrade (default)"
    echo "  --force             Skip confirmation prompts"
    echo "  --version VERSION   Upgrade to specific version"
    echo "  --help              Show this help message"
    echo
    echo "Examples:"
    echo "  $0                  Check and upgrade if available"
    echo "  $0 check            Only check for updates"
    echo "  $0 upgrade          Perform upgrade with confirmation"
    echo "  $0 --force          Upgrade without confirmation"
    echo "  $0 --version 1.2.0  Upgrade to specific version"
    echo
}

# Parse command line arguments
FORCE=false
ACTION="upgrade"
TARGET_VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        check)
            ACTION="check"
            shift
            ;;
        upgrade)
            ACTION="upgrade"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --version)
            TARGET_VERSION="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check root privileges
check_root

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Execute requested action
case $ACTION in
    check)
        if check_for_updates; then
            exit 0
        else
            exit 1
        fi
        ;;
    upgrade)
        perform_upgrade "$FORCE"
        ;;
    *)
        log_error "Invalid action: $ACTION"
        show_usage
        exit 1
        ;;
esac
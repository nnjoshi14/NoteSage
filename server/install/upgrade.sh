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

# Rollback upgrade
rollback_upgrade() {
    local backup_name="$1"
    
    log_error "Rolling back upgrade..."
    
    # Stop service
    systemctl stop notesage 2>/dev/null || true
    
    # Restore binary
    if [[ -f "$NOTESAGE_HOME/notesage-server.backup" ]]; then
        cp "$NOTESAGE_HOME/notesage-server.backup" "$NOTESAGE_HOME/notesage-server"
        log_success "Binary restored from backup"
    fi
    
    # Restore database if backup exists
    local backup_dir="$BACKUP_DIR/upgrades/$backup_name"
    if [[ -f "$backup_dir/database.sql.gz" ]]; then
        log "Restoring database from backup..."
        
        # Drop and recreate database
        sudo -u postgres dropdb notesage 2>/dev/null || true
        sudo -u postgres createdb notesage
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE notesage TO notesage;"
        
        # Restore database
        if gunzip -c "$backup_dir/database.sql.gz" | sudo -u postgres psql notesage; then
            log_success "Database restored from backup"
        else
            log_error "Failed to restore database from backup"
        fi
    fi
    
    # Start service
    systemctl start notesage
    
    log_warning "Rollback completed"
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

# Main upgrade function
perform_upgrade() {
    local force="$1"
    
    log "Starting NoteSage server upgrade..."
    
    # Check for updates
    if ! check_for_updates && [[ "$force" != "true" ]]; then
        return 0
    fi
    
    local current_version=$(get_current_version)
    local latest_version=$(get_latest_version)
    
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
        return 1
    fi
    
    # Download new version
    local new_binary
    if ! new_binary=$(download_new_version "$latest_version"); then
        log_error "Failed to download new version"
        return 1
    fi
    
    # Stop service
    if ! stop_service; then
        log_error "Failed to stop service"
        cleanup
        return 1
    fi
    
    # Install new binary
    if ! install_new_binary "$new_binary" "$latest_version"; then
        log_error "Failed to install new binary"
        rollback_upgrade "$backup_name"
        cleanup
        return 1
    fi
    
    # Run migrations
    if ! run_migrations; then
        log_error "Database migrations failed"
        rollback_upgrade "$backup_name"
        cleanup
        return 1
    fi
    
    # Start service
    if ! start_service; then
        log_error "Failed to start service after upgrade"
        rollback_upgrade "$backup_name"
        cleanup
        return 1
    fi
    
    # Cleanup
    cleanup
    
    log_success "Upgrade completed successfully!"
    log "NoteSage server upgraded from $current_version to $latest_version"
    
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
#!/bin/bash
# NoteSage Server Restore Script
# This script restores NoteSage database and files from backup

set -e

# Configuration
BACKUP_DIR="/var/lib/notesage/backups"
DATA_DIR="/var/lib/notesage"
CONFIG_DIR="/etc/notesage"
LOG_FILE="/var/log/notesage/restore.log"
DB_NAME="notesage"
DB_USER="notesage"

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

# List available backups
list_backups() {
    log "Available backups:"
    echo
    
    if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
        echo "No backups found in $BACKUP_DIR"
        return 1
    fi
    
    local backup_count=0
    
    # Find all manifest files and display backup information
    while IFS= read -r -d '' manifest; do
        if [[ -f "$manifest" ]]; then
            ((backup_count++))
            local backup_name=$(basename "$manifest" "_manifest.json")
            
            if command -v jq >/dev/null 2>&1; then
                local timestamp=$(jq -r '.timestamp' "$manifest" 2>/dev/null)
                local db_size=$(jq -r '.database.size' "$manifest" 2>/dev/null)
                local files_size=$(jq -r '.files.size' "$manifest" 2>/dev/null)
                
                echo "$backup_count. $backup_name"
                echo "   Date: $timestamp"
                echo "   Database: $(numfmt --to=iec "$db_size" 2>/dev/null || echo "$db_size bytes")"
                echo "   Files: $(numfmt --to=iec "$files_size" 2>/dev/null || echo "$files_size bytes")"
            else
                echo "$backup_count. $backup_name"
                echo "   Date: $(stat -c %y "$manifest" | cut -d. -f1)"
            fi
            echo
        fi
    done < <(find "$BACKUP_DIR" -name "*_manifest.json" -print0 2>/dev/null | sort -zr)
    
    if [[ $backup_count -eq 0 ]]; then
        echo "No valid backups found."
        return 1
    fi
    
    return 0
}

# Validate backup files
validate_backup() {
    local backup_name="$1"
    local manifest_file="${BACKUP_DIR}/${backup_name}_manifest.json"
    
    log "Validating backup: $backup_name"
    
    # Check if manifest exists
    if [[ ! -f "$manifest_file" ]]; then
        log_error "Backup manifest not found: $manifest_file"
        return 1
    fi
    
    # Parse manifest
    if command -v jq >/dev/null 2>&1; then
        local db_file=$(jq -r '.database.file' "$manifest_file" 2>/dev/null)
        local files_file=$(jq -r '.files.file' "$manifest_file" 2>/dev/null)
        local db_checksum=$(jq -r '.database.checksum' "$manifest_file" 2>/dev/null)
        local files_checksum=$(jq -r '.files.checksum' "$manifest_file" 2>/dev/null)
    else
        log_warning "jq not available, skipping checksum validation"
        local db_file="${backup_name}_database.sql.gz"
        local files_file="${backup_name}_files.tar.gz"
    fi
    
    # Check if backup files exist
    local db_backup_path="${BACKUP_DIR}/${db_file}"
    local files_backup_path="${BACKUP_DIR}/${files_file}"
    
    if [[ ! -f "$db_backup_path" ]]; then
        log_error "Database backup file not found: $db_backup_path"
        return 1
    fi
    
    if [[ ! -f "$files_backup_path" ]]; then
        log_error "Files backup file not found: $files_backup_path"
        return 1
    fi
    
    # Verify checksums if available
    if [[ -n "$db_checksum" ]] && [[ "$db_checksum" != "null" ]]; then
        local actual_db_checksum=$(sha256sum "$db_backup_path" | cut -d' ' -f1)
        if [[ "$actual_db_checksum" != "$db_checksum" ]]; then
            log_error "Database backup checksum mismatch"
            return 1
        fi
        log_success "Database backup checksum verified"
    fi
    
    if [[ -n "$files_checksum" ]] && [[ "$files_checksum" != "null" ]]; then
        local actual_files_checksum=$(sha256sum "$files_backup_path" | cut -d' ' -f1)
        if [[ "$actual_files_checksum" != "$files_checksum" ]]; then
            log_error "Files backup checksum mismatch"
            return 1
        fi
        log_success "Files backup checksum verified"
    fi
    
    # Test file integrity
    if [[ "$db_backup_path" == *.gz ]]; then
        if ! gzip -t "$db_backup_path" 2>/dev/null; then
            log_error "Database backup file is corrupted"
            return 1
        fi
    fi
    
    if [[ "$files_backup_path" == *.gz ]]; then
        if ! gzip -t "$files_backup_path" 2>/dev/null; then
            log_error "Files backup file is corrupted"
            return 1
        fi
    elif [[ "$files_backup_path" == *.tar ]]; then
        if ! tar -tf "$files_backup_path" >/dev/null 2>&1; then
            log_error "Files backup file is corrupted"
            return 1
        fi
    fi
    
    log_success "Backup validation completed"
    return 0
}

# Stop NoteSage service
stop_service() {
    log "Stopping NoteSage service..."
    
    if systemctl is-active --quiet notesage; then
        systemctl stop notesage
        log_success "NoteSage service stopped"
    else
        log "NoteSage service is not running"
    fi
    
    # Wait for service to fully stop
    sleep 5
}

# Start NoteSage service
start_service() {
    log "Starting NoteSage service..."
    
    systemctl start notesage
    
    # Wait for service to start
    sleep 10
    
    if systemctl is-active --quiet notesage; then
        log_success "NoteSage service started"
    else
        log_error "Failed to start NoteSage service"
        log "Check logs with: journalctl -u notesage -f"
        return 1
    fi
}

# Create pre-restore backup
create_pre_restore_backup() {
    log "Creating pre-restore backup..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local pre_restore_dir="${BACKUP_DIR}/pre_restore_${timestamp}"
    
    mkdir -p "$pre_restore_dir"
    
    # Backup current database
    if sudo -u postgres pg_dump "$DB_NAME" | gzip > "${pre_restore_dir}/database.sql.gz"; then
        log_success "Pre-restore database backup created"
    else
        log_warning "Failed to create pre-restore database backup"
    fi
    
    # Backup current files
    if tar --exclude="$BACKUP_DIR" -czf "${pre_restore_dir}/files.tar.gz" "$DATA_DIR" "$CONFIG_DIR" 2>/dev/null; then
        log_success "Pre-restore files backup created"
    else
        log_warning "Failed to create pre-restore files backup"
    fi
    
    chown -R notesage:notesage "$pre_restore_dir"
    
    log_success "Pre-restore backup saved to: $pre_restore_dir"
}

# Restore database
restore_database() {
    local backup_name="$1"
    local manifest_file="${BACKUP_DIR}/${backup_name}_manifest.json"
    
    log "Restoring database..."
    
    # Get database backup file from manifest
    local db_file
    if command -v jq >/dev/null 2>&1 && [[ -f "$manifest_file" ]]; then
        db_file=$(jq -r '.database.file' "$manifest_file" 2>/dev/null)
    else
        db_file="${backup_name}_database.sql.gz"
    fi
    
    local db_backup_path="${BACKUP_DIR}/${db_file}"
    
    if [[ ! -f "$db_backup_path" ]]; then
        log_error "Database backup file not found: $db_backup_path"
        return 1
    fi
    
    # Drop existing database connections
    sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
    
    # Drop and recreate database
    sudo -u postgres dropdb "$DB_NAME" 2>/dev/null || true
    sudo -u postgres createdb "$DB_NAME"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    # Restore database
    if [[ "$db_backup_path" == *.gz ]]; then
        if gunzip -c "$db_backup_path" | sudo -u postgres psql "$DB_NAME"; then
            log_success "Database restored successfully"
        else
            log_error "Failed to restore database"
            return 1
        fi
    else
        if sudo -u postgres psql "$DB_NAME" < "$db_backup_path"; then
            log_success "Database restored successfully"
        else
            log_error "Failed to restore database"
            return 1
        fi
    fi
    
    return 0
}

# Restore files
restore_files() {
    local backup_name="$1"
    local manifest_file="${BACKUP_DIR}/${backup_name}_manifest.json"
    
    log "Restoring files..."
    
    # Get files backup file from manifest
    local files_file
    if command -v jq >/dev/null 2>&1 && [[ -f "$manifest_file" ]]; then
        files_file=$(jq -r '.files.file' "$manifest_file" 2>/dev/null)
    else
        files_file="${backup_name}_files.tar.gz"
    fi
    
    local files_backup_path="${BACKUP_DIR}/${files_file}"
    
    if [[ ! -f "$files_backup_path" ]]; then
        log_error "Files backup file not found: $files_backup_path"
        return 1
    fi
    
    # Extract files
    if [[ "$files_backup_path" == *.gz ]]; then
        if tar -xzf "$files_backup_path" -C /; then
            log_success "Files restored successfully"
        else
            log_error "Failed to restore files"
            return 1
        fi
    else
        if tar -xf "$files_backup_path" -C /; then
            log_success "Files restored successfully"
        else
            log_error "Failed to restore files"
            return 1
        fi
    fi
    
    # Fix permissions
    chown -R notesage:notesage "$DATA_DIR"
    chown -R root:notesage "$CONFIG_DIR"
    chmod 750 "$CONFIG_DIR"
    chmod 640 "$CONFIG_DIR"/*.yaml 2>/dev/null || true
    
    return 0
}

# Verify restore
verify_restore() {
    log "Verifying restore..."
    
    # Check if database is accessible
    if sudo -u postgres psql -d "$DB_NAME" -c "SELECT COUNT(*) FROM information_schema.tables;" >/dev/null 2>&1; then
        log_success "Database is accessible"
    else
        log_error "Database is not accessible"
        return 1
    fi
    
    # Check if configuration file exists
    if [[ -f "$CONFIG_DIR/config.yaml" ]]; then
        log_success "Configuration file exists"
    else
        log_error "Configuration file missing"
        return 1
    fi
    
    # Check if data directory exists
    if [[ -d "$DATA_DIR" ]]; then
        log_success "Data directory exists"
    else
        log_error "Data directory missing"
        return 1
    fi
    
    return 0
}

# Interactive backup selection
select_backup_interactive() {
    echo "Available backups:"
    echo
    
    local backups=()
    local backup_count=0
    
    # Collect backup names
    while IFS= read -r -d '' manifest; do
        if [[ -f "$manifest" ]]; then
            ((backup_count++))
            local backup_name=$(basename "$manifest" "_manifest.json")
            backups+=("$backup_name")
            
            if command -v jq >/dev/null 2>&1; then
                local timestamp=$(jq -r '.timestamp' "$manifest" 2>/dev/null)
                echo "$backup_count. $backup_name ($timestamp)"
            else
                echo "$backup_count. $backup_name"
            fi
        fi
    done < <(find "$BACKUP_DIR" -name "*_manifest.json" -print0 2>/dev/null | sort -zr)
    
    if [[ $backup_count -eq 0 ]]; then
        log_error "No backups available"
        return 1
    fi
    
    echo
    read -p "Select backup to restore (1-$backup_count): " selection
    
    if [[ "$selection" =~ ^[0-9]+$ ]] && [[ $selection -ge 1 ]] && [[ $selection -le $backup_count ]]; then
        local selected_backup="${backups[$((selection-1))]}"
        echo "$selected_backup"
        return 0
    else
        log_error "Invalid selection"
        return 1
    fi
}

# Main restore function
restore_backup() {
    local backup_name="$1"
    local force="$2"
    
    log "Starting NoteSage restore process..."
    
    # If no backup specified, show interactive selection
    if [[ -z "$backup_name" ]]; then
        if ! backup_name=$(select_backup_interactive); then
            return 1
        fi
    fi
    
    log "Selected backup: $backup_name"
    
    # Validate backup
    if ! validate_backup "$backup_name"; then
        log_error "Backup validation failed"
        return 1
    fi
    
    # Confirm restore
    if [[ "$force" != "true" ]]; then
        echo
        log_warning "This will overwrite all current data!"
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [[ "$confirm" != "yes" ]]; then
            log "Restore cancelled by user"
            return 0
        fi
    fi
    
    # Stop service
    stop_service
    
    # Create pre-restore backup
    create_pre_restore_backup
    
    # Restore database
    if ! restore_database "$backup_name"; then
        log_error "Database restore failed"
        return 1
    fi
    
    # Restore files
    if ! restore_files "$backup_name"; then
        log_error "Files restore failed"
        return 1
    fi
    
    # Verify restore
    if ! verify_restore; then
        log_error "Restore verification failed"
        return 1
    fi
    
    # Start service
    if ! start_service; then
        log_error "Failed to start service after restore"
        return 1
    fi
    
    log_success "Restore completed successfully"
    return 0
}

# Show usage information
show_usage() {
    echo "NoteSage Restore Script"
    echo
    echo "Usage: $0 [OPTIONS] [BACKUP_NAME]"
    echo
    echo "Options:"
    echo "  list                List available backups"
    echo "  restore [NAME]      Restore from backup (interactive if NAME not provided)"
    echo "  --force             Skip confirmation prompts"
    echo "  --backup-dir DIR    Set backup directory (default: $BACKUP_DIR)"
    echo "  --help              Show this help message"
    echo
    echo "Examples:"
    echo "  $0 list                           List all available backups"
    echo "  $0 restore                        Interactive backup selection"
    echo "  $0 restore notesage_backup_20240115_120000  Restore specific backup"
    echo "  $0 restore --force backup_name    Restore without confirmation"
    echo
}

# Parse command line arguments
FORCE=false
ACTION=""
BACKUP_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        list)
            ACTION="list"
            shift
            ;;
        restore)
            ACTION="restore"
            if [[ -n "$2" ]] && [[ "$2" != --* ]]; then
                BACKUP_NAME="$2"
                shift 2
            else
                shift
            fi
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            if [[ -z "$ACTION" ]]; then
                ACTION="restore"
                BACKUP_NAME="$1"
            else
                log_error "Unknown option: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Default action
ACTION=${ACTION:-list}

# Check root privileges for restore operations
if [[ "$ACTION" == "restore" ]]; then
    check_root
fi

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Execute requested action
case $ACTION in
    list)
        list_backups
        ;;
    restore)
        restore_backup "$BACKUP_NAME" "$FORCE"
        ;;
    *)
        log_error "Invalid action: $ACTION"
        show_usage
        exit 1
        ;;
esac
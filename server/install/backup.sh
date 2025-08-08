#!/bin/bash
# NoteSage Server Backup Script
# This script creates backups of the NoteSage database and files

set -e

# Configuration
BACKUP_DIR="/var/lib/notesage/backups"
DATA_DIR="/var/lib/notesage"
CONFIG_DIR="/etc/notesage"
LOG_FILE="/var/log/notesage/backup.log"
RETENTION_DAYS=30
COMPRESS=true
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

# Create backup directory
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        chown notesage:notesage "$BACKUP_DIR"
        chmod 750 "$BACKUP_DIR"
        log_success "Created backup directory: $BACKUP_DIR"
    fi
}

# Generate backup filename
generate_backup_name() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    echo "notesage_backup_${timestamp}"
}

# Backup database
backup_database() {
    local backup_name="$1"
    local db_backup_file="${BACKUP_DIR}/${backup_name}_database.sql"
    
    log "Creating database backup..."
    
    # Create database dump
    if sudo -u postgres pg_dump "$DB_NAME" > "$db_backup_file"; then
        log_success "Database backup created: $db_backup_file"
        
        # Compress if enabled
        if [[ "$COMPRESS" == "true" ]]; then
            gzip "$db_backup_file"
            db_backup_file="${db_backup_file}.gz"
            log_success "Database backup compressed: $db_backup_file"
        fi
        
        # Set permissions
        chown notesage:notesage "$db_backup_file"
        chmod 640 "$db_backup_file"
        
        echo "$db_backup_file"
    else
        log_error "Failed to create database backup"
        return 1
    fi
}

# Backup files
backup_files() {
    local backup_name="$1"
    local files_backup_file="${BACKUP_DIR}/${backup_name}_files.tar"
    
    log "Creating files backup..."
    
    # Create list of directories to backup
    local backup_paths=()
    
    # Add data directory (excluding backups to avoid recursion)
    if [[ -d "$DATA_DIR" ]]; then
        backup_paths+=("$DATA_DIR")
    fi
    
    # Add configuration directory
    if [[ -d "$CONFIG_DIR" ]]; then
        backup_paths+=("$CONFIG_DIR")
    fi
    
    if [[ ${#backup_paths[@]} -eq 0 ]]; then
        log_warning "No files to backup"
        return 0
    fi
    
    # Create tar archive
    if tar --exclude="${BACKUP_DIR}" -cf "$files_backup_file" "${backup_paths[@]}" 2>/dev/null; then
        log_success "Files backup created: $files_backup_file"
        
        # Compress if enabled
        if [[ "$COMPRESS" == "true" ]]; then
            gzip "$files_backup_file"
            files_backup_file="${files_backup_file}.gz"
            log_success "Files backup compressed: $files_backup_file"
        fi
        
        # Set permissions
        chown notesage:notesage "$files_backup_file"
        chmod 640 "$files_backup_file"
        
        echo "$files_backup_file"
    else
        log_error "Failed to create files backup"
        return 1
    fi
}

# Create backup manifest
create_manifest() {
    local backup_name="$1"
    local db_backup="$2"
    local files_backup="$3"
    local manifest_file="${BACKUP_DIR}/${backup_name}_manifest.json"
    
    log "Creating backup manifest..."
    
    cat > "$manifest_file" << EOF
{
  "backup_name": "$backup_name",
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "version": "1.0.0",
  "database": {
    "file": "$(basename "$db_backup")",
    "size": $(stat -c%s "$db_backup" 2>/dev/null || echo 0),
    "checksum": "$(sha256sum "$db_backup" | cut -d' ' -f1)"
  },
  "files": {
    "file": "$(basename "$files_backup")",
    "size": $(stat -c%s "$files_backup" 2>/dev/null || echo 0),
    "checksum": "$(sha256sum "$files_backup" | cut -d' ' -f1)"
  },
  "retention_date": "$(date -d "+${RETENTION_DAYS} days" -Iseconds)"
}
EOF

    chown notesage:notesage "$manifest_file"
    chmod 640 "$manifest_file"
    
    log_success "Backup manifest created: $manifest_file"
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
        log "Deleted old backup: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "notesage_backup_*" -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_success "Cleaned up $deleted_count old backup files"
    else
        log "No old backups to clean up"
    fi
}

# Verify backup integrity
verify_backup() {
    local db_backup="$1"
    local files_backup="$2"
    
    log "Verifying backup integrity..."
    
    # Verify database backup
    if [[ -f "$db_backup" ]]; then
        if [[ "$db_backup" == *.gz ]]; then
            if gzip -t "$db_backup" 2>/dev/null; then
                log_success "Database backup integrity verified"
            else
                log_error "Database backup is corrupted"
                return 1
            fi
        else
            # For uncompressed SQL files, check if it's valid SQL
            if head -n 1 "$db_backup" | grep -q "PostgreSQL database dump"; then
                log_success "Database backup integrity verified"
            else
                log_error "Database backup appears invalid"
                return 1
            fi
        fi
    fi
    
    # Verify files backup
    if [[ -f "$files_backup" ]]; then
        if [[ "$files_backup" == *.gz ]]; then
            if gzip -t "$files_backup" 2>/dev/null; then
                log_success "Files backup integrity verified"
            else
                log_error "Files backup is corrupted"
                return 1
            fi
        else
            if tar -tf "$files_backup" >/dev/null 2>&1; then
                log_success "Files backup integrity verified"
            else
                log_error "Files backup is corrupted"
                return 1
            fi
        fi
    fi
    
    return 0
}

# Send backup notification
send_notification() {
    local status="$1"
    local backup_name="$2"
    local db_size="$3"
    local files_size="$4"
    
    # This could be extended to send email, Slack, etc.
    if [[ "$status" == "success" ]]; then
        log_success "Backup completed successfully: $backup_name"
        log "Database backup size: $(du -h "$db_size" 2>/dev/null | cut -f1 || echo "unknown")"
        log "Files backup size: $(du -h "$files_size" 2>/dev/null | cut -f1 || echo "unknown")"
    else
        log_error "Backup failed: $backup_name"
    fi
}

# List available backups
list_backups() {
    log "Available backups:"
    echo
    
    if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
        echo "No backups found."
        return 0
    fi
    
    # Find all manifest files and display backup information
    while IFS= read -r -d '' manifest; do
        if [[ -f "$manifest" ]] && command -v jq >/dev/null 2>&1; then
            local backup_name=$(jq -r '.backup_name' "$manifest" 2>/dev/null)
            local timestamp=$(jq -r '.timestamp' "$manifest" 2>/dev/null)
            local db_size=$(jq -r '.database.size' "$manifest" 2>/dev/null)
            local files_size=$(jq -r '.files.size' "$manifest" 2>/dev/null)
            
            echo "Backup: $backup_name"
            echo "  Date: $timestamp"
            echo "  Database: $(numfmt --to=iec "$db_size" 2>/dev/null || echo "$db_size bytes")"
            echo "  Files: $(numfmt --to=iec "$files_size" 2>/dev/null || echo "$files_size bytes")"
            echo
        fi
    done < <(find "$BACKUP_DIR" -name "*_manifest.json" -print0 2>/dev/null | sort -z)
}

# Main backup function
create_backup() {
    log "Starting NoteSage backup process..."
    
    # Create backup directory
    create_backup_dir
    
    # Generate backup name
    local backup_name=$(generate_backup_name)
    log "Backup name: $backup_name"
    
    # Create database backup
    local db_backup
    if ! db_backup=$(backup_database "$backup_name"); then
        log_error "Database backup failed"
        return 1
    fi
    
    # Create files backup
    local files_backup
    if ! files_backup=$(backup_files "$backup_name"); then
        log_error "Files backup failed"
        return 1
    fi
    
    # Verify backup integrity
    if ! verify_backup "$db_backup" "$files_backup"; then
        log_error "Backup verification failed"
        return 1
    fi
    
    # Create manifest
    create_manifest "$backup_name" "$db_backup" "$files_backup"
    
    # Clean up old backups
    cleanup_old_backups
    
    # Send notification
    send_notification "success" "$backup_name" "$db_backup" "$files_backup"
    
    log_success "Backup process completed successfully"
    return 0
}

# Show usage information
show_usage() {
    echo "NoteSage Backup Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  create              Create a new backup (default)"
    echo "  list                List available backups"
    echo "  --retention DAYS    Set retention period (default: $RETENTION_DAYS)"
    echo "  --no-compress       Disable compression"
    echo "  --backup-dir DIR    Set backup directory (default: $BACKUP_DIR)"
    echo "  --help              Show this help message"
    echo
    echo "Examples:"
    echo "  $0                  Create a backup with default settings"
    echo "  $0 create           Create a backup"
    echo "  $0 list             List all available backups"
    echo "  $0 --retention 60   Create backup with 60-day retention"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        create)
            ACTION="create"
            shift
            ;;
        list)
            ACTION="list"
            shift
            ;;
        --retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --no-compress)
            COMPRESS=false
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
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Default action
ACTION=${ACTION:-create}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Execute requested action
case $ACTION in
    create)
        create_backup
        ;;
    list)
        list_backups
        ;;
    *)
        log_error "Invalid action: $ACTION"
        show_usage
        exit 1
        ;;
esac
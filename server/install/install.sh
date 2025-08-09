#!/bin/bash
# NoteSage Server Installation Script for Ubuntu
# This script installs and configures the NoteSage server with all dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NOTESAGE_USER="notesage"
NOTESAGE_HOME="/opt/notesage"
NOTESAGE_CONFIG="/etc/notesage"
NOTESAGE_DATA="/var/lib/notesage"
NOTESAGE_LOGS="/var/log/notesage"
NOTESAGE_VERSION="1.0.0"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Ubuntu version
    if ! lsb_release -d | grep -q "Ubuntu"; then
        log_error "This installer requires Ubuntu Linux"
        exit 1
    fi
    
    local ubuntu_version=$(lsb_release -rs)
    local major_version=$(echo $ubuntu_version | cut -d. -f1)
    
    if [[ $major_version -lt 20 ]]; then
        log_error "Ubuntu 20.04 or later is required (found: $ubuntu_version)"
        exit 1
    fi
    
    log_success "Ubuntu $ubuntu_version detected"
    
    # Check for required commands
    local required_commands=("systemctl" "wget" "curl" "tar")
    for cmd in "${required_commands[@]}"; do
        if ! command -v $cmd >/dev/null 2>&1; then
            log_error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check available disk space (minimum 1GB)
    local available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 1048576 ]]; then
        log_error "Insufficient disk space. At least 1GB required"
        exit 1
    fi
    
    log_success "System requirements check passed"
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    apt update
    
    # Install required packages
    local packages=(
        "postgresql"
        "postgresql-contrib"
        "nginx"
        "certbot"
        "python3-certbot-nginx"
        "ufw"
        "logrotate"
        "cron"
        "jq"
        "htop"
        "curl"
        "wget"
        "unzip"
    )
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            log "Installing $package..."
            apt install -y $package
        else
            log_success "$package already installed"
        fi
    done
    
    log_success "System dependencies installed"
}

# Setup PostgreSQL database
setup_database() {
    log "Setting up PostgreSQL database..."
    
    # Start and enable PostgreSQL
    systemctl enable postgresql
    systemctl start postgresql
    
    # Create database and user
    sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = 'notesage'" | grep -q 1 || \
        sudo -u postgres createdb notesage
    
    sudo -u postgres psql -c "SELECT 1 FROM pg_user WHERE usename = 'notesage'" | grep -q 1 || \
        sudo -u postgres createuser notesage
    
    # Generate random password
    local db_password=$(openssl rand -base64 32)
    sudo -u postgres psql -c "ALTER USER notesage WITH PASSWORD '$db_password';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE notesage TO notesage;"
    
    # Store password for configuration
    echo "$db_password" > /tmp/notesage_db_password
    chmod 600 /tmp/notesage_db_password
    
    log_success "PostgreSQL database configured"
}

# Create system user and directories
create_user_and_directories() {
    log "Creating NoteSage user and directories..."
    
    # Create system user
    if ! id "$NOTESAGE_USER" &>/dev/null; then
        useradd -r -s /bin/false -d $NOTESAGE_HOME $NOTESAGE_USER
        log_success "Created user: $NOTESAGE_USER"
    else
        log_success "User $NOTESAGE_USER already exists"
    fi
    
    # Create directories
    local directories=(
        "$NOTESAGE_HOME"
        "$NOTESAGE_CONFIG"
        "$NOTESAGE_DATA"
        "$NOTESAGE_LOGS"
        "$NOTESAGE_DATA/backups"
        "$NOTESAGE_DATA/uploads"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        log_success "Created directory: $dir"
    done
    
    # Set permissions
    chown -R $NOTESAGE_USER:$NOTESAGE_USER $NOTESAGE_DATA
    chown -R $NOTESAGE_USER:$NOTESAGE_USER $NOTESAGE_LOGS
    chown -R root:$NOTESAGE_USER $NOTESAGE_CONFIG
    chmod 750 $NOTESAGE_CONFIG
    
    log_success "User and directories configured"
}

# Install NoteSage server binary
install_server_binary() {
    log "Installing NoteSage server binary..."
    
    # Download binary (in production, this would be from a release)
    if [[ -f "./notesage-server" ]]; then
        # Use local binary if available
        cp ./notesage-server $NOTESAGE_HOME/
        log_success "Installed local NoteSage server binary"
    else
        # Download from GitHub releases (placeholder URL)
        local download_url="https://github.com/notesage/server/releases/download/v${NOTESAGE_VERSION}/notesage-server-linux-amd64"
        log "Downloading NoteSage server from $download_url"
        
        if wget -q --spider "$download_url"; then
            wget -O $NOTESAGE_HOME/notesage-server "$download_url"
        else
            log_error "Could not download NoteSage server binary"
            log_error "Please ensure the binary is available at: $download_url"
            log_error "Or place the binary in the current directory as 'notesage-server'"
            exit 1
        fi
    fi
    
    # Make binary executable
    chmod +x $NOTESAGE_HOME/notesage-server
    chown $NOTESAGE_USER:$NOTESAGE_USER $NOTESAGE_HOME/notesage-server
    
    log_success "NoteSage server binary installed"
}

# Create configuration files
create_configuration() {
    log "Creating configuration files..."
    
    # Get database password
    local db_password=$(cat /tmp/notesage_db_password)
    
    # Generate JWT secret
    local jwt_secret=$(openssl rand -base64 64)
    
    # Create main configuration file
    cat > $NOTESAGE_CONFIG/config.yaml << EOF
# NoteSage Server Configuration
server:
  host: "0.0.0.0"
  port: 8080
  tls:
    enabled: false
    cert_file: ""
    key_file: ""
  cors:
    enabled: true
    origins: ["*"]
  rate_limit:
    enabled: true
    requests_per_minute: 100

database:
  type: "postgres"
  host: "localhost"
  port: 5432
  name: "notesage"
  user: "notesage"
  password: "$db_password"
  ssl_mode: "disable"
  max_connections: 25
  connection_timeout: "30s"

auth:
  jwt_secret: "$jwt_secret"
  session_timeout: "24h"
  password_min_length: 8
  max_login_attempts: 5
  lockout_duration: "15m"

logging:
  level: "info"
  file: "$NOTESAGE_LOGS/server.log"
  max_size: 100  # MB
  max_backups: 5
  max_age: 30    # days
  compress: true

features:
  ai_enabled: true
  websocket_enabled: true
  file_uploads: true
  max_upload_size: "10MB"
  backup_enabled: true
  metrics_enabled: true

backup:
  enabled: true
  schedule: "0 2 * * *"  # Daily at 2 AM
  retention_days: 30
  storage_path: "$NOTESAGE_DATA/backups"
  compress: true

monitoring:
  health_check_interval: "30s"
  metrics_port: 9090
  prometheus_enabled: false
EOF

    # Set configuration file permissions
    chmod 640 $NOTESAGE_CONFIG/config.yaml
    chown root:$NOTESAGE_USER $NOTESAGE_CONFIG/config.yaml
    
    # Clean up temporary password file
    rm -f /tmp/notesage_db_password
    
    log_success "Configuration files created"
}

# Create systemd service
create_systemd_service() {
    log "Creating systemd service..."
    
    cat > /etc/systemd/system/notesage.service << EOF
[Unit]
Description=NoteSage Server
Documentation=https://github.com/notesage/server
After=network.target postgresql.service
Requires=postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=$NOTESAGE_USER
Group=$NOTESAGE_USER
WorkingDirectory=$NOTESAGE_HOME
ExecStart=$NOTESAGE_HOME/notesage-server --config $NOTESAGE_CONFIG/config.yaml
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=3

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$NOTESAGE_DATA $NOTESAGE_LOGS
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=notesage

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable notesage
    
    log_success "Systemd service created and enabled"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/notesage << EOF
$NOTESAGE_LOGS/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $NOTESAGE_USER $NOTESAGE_USER
    postrotate
        systemctl reload notesage > /dev/null 2>&1 || true
    endscript
}
EOF

    log_success "Log rotation configured"
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."
    
    # Enable UFW if not already enabled
    if ! ufw status | grep -q "Status: active"; then
        ufw --force enable
    fi
    
    # Allow SSH (important!)
    ufw allow ssh
    
    # Allow NoteSage server port
    ufw allow 8080/tcp comment 'NoteSage Server'
    
    # Allow HTTP and HTTPS for nginx (if used)
    ufw allow 'Nginx Full'
    
    log_success "Firewall configured"
}

# Initialize database schema
initialize_database() {
    log "Initializing database schema..."
    
    # Run database migrations
    sudo -u $NOTESAGE_USER $NOTESAGE_HOME/notesage-server migrate --config $NOTESAGE_CONFIG/config.yaml
    
    log_success "Database schema initialized"
}

# Create admin user
create_admin_user() {
    log "Creating admin user..."
    
    # Generate random admin password
    local admin_password=$(openssl rand -base64 16)
    
    # Create admin user (this would be done via the server's admin API)
    # For now, we'll store the credentials for manual setup
    cat > $NOTESAGE_CONFIG/admin-credentials.txt << EOF
NoteSage Admin Credentials
=========================
Username: admin
Password: $admin_password
Email: admin@localhost

Please change these credentials after first login.
This file will be deleted after first successful login.
EOF

    chmod 600 $NOTESAGE_CONFIG/admin-credentials.txt
    chown root:root $NOTESAGE_CONFIG/admin-credentials.txt
    
    log_success "Admin credentials created (see $NOTESAGE_CONFIG/admin-credentials.txt)"
}

# Start services
start_services() {
    log "Starting NoteSage services..."
    
    # Start PostgreSQL if not running
    if ! systemctl is-active --quiet postgresql; then
        systemctl start postgresql
    fi
    
    # Start NoteSage server
    systemctl start notesage
    
    # Wait for service to start
    sleep 5
    
    # Check if service is running
    if systemctl is-active --quiet notesage; then
        log_success "NoteSage server started successfully"
    else
        log_error "Failed to start NoteSage server"
        log "Check logs with: journalctl -u notesage -f"
        exit 1
    fi
}

# Display installation summary
display_summary() {
    log_success "NoteSage server installation completed!"
    echo
    echo "==================================="
    echo "  NoteSage Server Installation"
    echo "==================================="
    echo
    echo "Server Status:"
    echo "  Service: $(systemctl is-active notesage)"
    echo "  Port: 8080"
    echo "  Config: $NOTESAGE_CONFIG/config.yaml"
    echo "  Logs: $NOTESAGE_LOGS/server.log"
    echo "  Data: $NOTESAGE_DATA"
    echo
    echo "Admin Credentials:"
    echo "  File: $NOTESAGE_CONFIG/admin-credentials.txt"
    echo
    echo "Useful Commands:"
    echo "  Status: sudo systemctl status notesage"
    echo "  Logs: sudo journalctl -u notesage -f"
    echo "  Restart: sudo systemctl restart notesage"
    echo "  Health: curl http://localhost:8080/health"
    echo
    echo "Next Steps:"
    echo "  1. Review configuration in $NOTESAGE_CONFIG/config.yaml"
    echo "  2. Set up SSL/TLS certificates if needed"
    echo "  3. Configure nginx reverse proxy if desired"
    echo "  4. Access admin panel and change default credentials"
    echo "  5. Configure backup schedule"
    echo
    echo "Documentation: https://github.com/notesage/server/docs"
    echo
}

# Main installation function
main() {
    echo "NoteSage Server Installation Script"
    echo "==================================="
    echo
    
    check_root
    check_requirements
    install_dependencies
    setup_database
    create_user_and_directories
    install_server_binary
    create_configuration
    create_systemd_service
    setup_log_rotation
    setup_firewall
    initialize_database
    create_admin_user
    start_services
    display_summary
}

# Handle script interruption
trap 'log_error "Installation interrupted"; exit 1' INT TERM

# Run main installation
main "$@"
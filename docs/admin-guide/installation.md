# NoteSage Server Installation Guide

This comprehensive guide provides step-by-step instructions for installing and configuring NoteSage server on Ubuntu Linux systems.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- **Operating System**: Ubuntu 20.04 LTS or later
- **CPU**: 2 cores, 2.4 GHz
- **Memory**: 4 GB RAM
- **Storage**: 20 GB available disk space
- **Network**: Internet connection for setup and AI features

**Recommended Requirements:**
- **Operating System**: Ubuntu 22.04 LTS
- **CPU**: 4 cores, 3.0 GHz or higher
- **Memory**: 8 GB RAM or more
- **Storage**: 100 GB SSD
- **Network**: Stable broadband connection
- **Database**: Dedicated PostgreSQL server

**Supported Platforms:**
- **Primary**: Ubuntu 20.04 LTS, 22.04 LTS
- **Secondary**: Debian 10+, CentOS 8+ (manual installation)
- **Architecture**: x86_64 (AMD64)

### User Privileges
- Root or sudo access for installation
- Ability to create system users and services
- Permission to modify system configuration files
- Network access to download packages and updates

### Network Requirements
- **Inbound**: Port 8080 (default) or custom port
- **Outbound**: HTTPS (443) for AI providers and updates
- **Database**: Port 5432 for PostgreSQL (if remote)
- **Firewall**: Configure to allow NoteSage traffic

## Pre-Installation Checklist

Before beginning installation:

```bash
# Check Ubuntu version
lsb_release -a

# Verify system resources
free -h
df -h
nproc

# Check network connectivity
ping -c 3 google.com

# Verify sudo access
sudo whoami

# Check if ports are available
sudo netstat -tlnp | grep :8080
```

## Installation Methods

### Method 1: Automated Installation (Recommended)

The automated installer provides the fastest and most reliable installation:

```bash
# Download the official installer
wget https://releases.notesage.com/latest/install.sh

# Verify installer integrity (optional but recommended)
wget https://releases.notesage.com/latest/install.sh.sha256
sha256sum -c install.sh.sha256

# Make installer executable
chmod +x install.sh

# Run the installer with options
sudo ./install.sh --interactive

# Or run with default settings
sudo ./install.sh --auto
```

**Installer Options:**
- `--interactive`: Step-by-step configuration
- `--auto`: Use default settings
- `--database=postgres|sqlite`: Choose database type
- `--port=8080`: Set custom port
- `--domain=example.com`: Configure domain name
- `--ssl`: Enable SSL/TLS configuration

**What the installer does:**
1. Validates system requirements
2. Installs required dependencies (PostgreSQL, etc.)
3. Creates system user and directories
4. Downloads and installs NoteSage server binary
5. Generates secure configuration
6. Sets up systemd service
7. Configures database and initial schema
8. Sets up log rotation and basic monitoring
9. Creates first admin user
10. Starts and enables the service

### Method 2: Manual Installation

For advanced users who need custom configuration:

#### Step 1: System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential dependencies
sudo apt install -y \
    curl \
    wget \
    unzip \
    gnupg \
    software-properties-common \
    apt-transport-https \
    ca-certificates

# Install build tools (if compiling from source)
sudo apt install -y build-essential git
```

#### Step 2: Database Installation

**PostgreSQL (Recommended for Production):**
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib postgresql-client

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Secure PostgreSQL installation
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'secure_postgres_password';"

# Create NoteSage database and user
sudo -u postgres createdb notesage
sudo -u postgres createuser notesage
sudo -u postgres psql -c "ALTER USER notesage WITH PASSWORD 'secure_notesage_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE notesage TO notesage;"
sudo -u postgres psql -c "ALTER DATABASE notesage OWNER TO notesage;"

# Configure PostgreSQL for NoteSage
sudo tee -a /etc/postgresql/*/main/postgresql.conf > /dev/null <<EOF

# NoteSage Configuration
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**SQLite (Development/Single User):**
```bash
# SQLite is included with Ubuntu, no additional installation needed
# Database file will be created automatically
```

#### Step 3: System User and Directories

```bash
# Create dedicated system user
sudo useradd -r -s /bin/false -d /var/lib/notesage notesage

# Create directory structure
sudo mkdir -p /opt/notesage
sudo mkdir -p /etc/notesage
sudo mkdir -p /var/log/notesage
sudo mkdir -p /var/lib/notesage
sudo mkdir -p /var/lib/notesage/backups
sudo mkdir -p /var/lib/notesage/uploads

# Set proper ownership
sudo chown -R notesage:notesage /var/log/notesage
sudo chown -R notesage:notesage /var/lib/notesage
sudo chown root:notesage /etc/notesage
sudo chmod 750 /etc/notesage
```

#### Step 4: Download and Install Binary

```bash
# Download latest release
LATEST_VERSION=$(curl -s https://api.github.com/repos/notesage/server/releases/latest | grep tag_name | cut -d '"' -f 4)
wget "https://github.com/notesage/server/releases/download/${LATEST_VERSION}/notesage-server-linux-amd64"

# Verify download integrity
wget "https://github.com/notesage/server/releases/download/${LATEST_VERSION}/checksums.txt"
sha256sum -c checksums.txt --ignore-missing

# Install binary
sudo cp notesage-server-linux-amd64 /opt/notesage/notesage-server
sudo chmod +x /opt/notesage/notesage-server
sudo chown root:root /opt/notesage/notesage-server

# Verify installation
/opt/notesage/notesage-server --version
```

#### Step 5: Configuration

```bash
# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create main configuration file
sudo tee /etc/notesage/config.yaml > /dev/null <<EOF
# NoteSage Server Configuration
server:
  host: "0.0.0.0"
  port: 8080
  read_timeout: "30s"
  write_timeout: "30s"
  idle_timeout: "120s"
  max_header_bytes: 1048576
  tls:
    enabled: false
    cert_file: ""
    key_file: ""
    auto_cert: false
    auto_cert_domains: []

database:
  type: "postgres"  # or "sqlite"
  host: "localhost"
  port: 5432
  name: "notesage"
  user: "notesage"
  password: "secure_notesage_password"
  ssl_mode: "disable"
  max_open_conns: 25
  max_idle_conns: 5
  conn_max_lifetime: "5m"
  
  # SQLite configuration (if using SQLite)
  # file: "/var/lib/notesage/notesage.db"

auth:
  jwt_secret: "${JWT_SECRET}"
  session_timeout: "24h"
  password_min_length: 8
  max_login_attempts: 5
  lockout_duration: "15m"

logging:
  level: "info"  # debug, info, warn, error
  format: "json"  # json, text
  file: "/var/log/notesage/server.log"
  max_size: 100  # MB
  max_backups: 5
  max_age: 30  # days
  compress: true

features:
  ai_enabled: true
  websocket_enabled: true
  file_uploads: true
  max_upload_size: "10MB"
  collaboration: true
  version_history: true

ai:
  providers:
    openai:
      enabled: false
      api_key: ""
      model: "gpt-3.5-turbo"
      max_tokens: 1000
    gemini:
      enabled: false
      api_key: ""
      model: "gemini-pro"
    grok:
      enabled: false
      api_key: ""

security:
  cors_origins: ["*"]
  rate_limit:
    enabled: true
    requests_per_minute: 60
    burst: 10
  csrf_protection: true
  content_security_policy: true

backup:
  enabled: true
  schedule: "0 2 * * *"  # Daily at 2 AM
  retention_days: 30
  compression: true
  location: "/var/lib/notesage/backups"

monitoring:
  health_check_enabled: true
  metrics_enabled: true
  prometheus_endpoint: "/metrics"
EOF

# Set secure permissions
sudo chown root:notesage /etc/notesage/config.yaml
sudo chmod 640 /etc/notesage/config.yaml
```

#### Step 6: Systemd Service

```bash
# Create systemd service file
sudo tee /etc/systemd/system/notesage.service > /dev/null <<EOF
[Unit]
Description=NoteSage Knowledge Management Server
Documentation=https://docs.notesage.com
After=network.target postgresql.service
Wants=postgresql.service
Requires=network.target

[Service]
Type=simple
User=notesage
Group=notesage
WorkingDirectory=/opt/notesage
ExecStart=/opt/notesage/notesage-server --config /etc/notesage/config.yaml
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
StartLimitInterval=0

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/notesage /var/lib/notesage
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

# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable notesage
```

#### Step 7: Database Initialization

```bash
# Initialize database schema
sudo -u notesage /opt/notesage/notesage-server migrate --config /etc/notesage/config.yaml

# Create first admin user
sudo -u notesage /opt/notesage/notesage-server admin create-user \
  --config /etc/notesage/config.yaml \
  --username admin \
  --email admin@example.com \
  --password "$(openssl rand -base64 12)" \
  --role admin

# The generated password will be displayed - save it securely
```

## Post-Installation Configuration

### Start and Verify Service

```bash
# Start NoteSage service
sudo systemctl start notesage

# Check service status
sudo systemctl status notesage

# View service logs
sudo journalctl -u notesage -f

# Test server health
curl -f http://localhost:8080/health || echo "Health check failed"

# Test API endpoint
curl -f http://localhost:8080/api/v1/status || echo "API check failed"
```

### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 8080/tcp

# For production with specific IP ranges
sudo ufw allow from 192.168.1.0/24 to any port 8080
sudo ufw allow from 10.0.0.0/8 to any port 8080

# Enable firewall
sudo ufw --force enable

# Check firewall status
sudo ufw status verbose
```

### SSL/TLS Configuration (Production)

**Option 1: Let's Encrypt (Recommended)**
```bash
# Install Certbot
sudo apt install -y certbot

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Update configuration
sudo tee -a /etc/notesage/config.yaml > /dev/null <<EOF
server:
  port: 8443
  tls:
    enabled: true
    cert_file: "/etc/letsencrypt/live/your-domain.com/fullchain.pem"
    key_file: "/etc/letsencrypt/live/your-domain.com/privkey.pem"
EOF

# Set up certificate renewal
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet && systemctl reload notesage
```

**Option 2: Self-Signed Certificate**
```bash
# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/notesage.key \
  -out /etc/ssl/certs/notesage.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"

# Set permissions
sudo chmod 600 /etc/ssl/private/notesage.key
sudo chmod 644 /etc/ssl/certs/notesage.crt

# Update configuration
sudo sed -i 's/enabled: false/enabled: true/' /etc/notesage/config.yaml
sudo sed -i 's|cert_file: ""|cert_file: "/etc/ssl/certs/notesage.crt"|' /etc/notesage/config.yaml
sudo sed -i 's|key_file: ""|key_file: "/etc/ssl/private/notesage.key"|' /etc/notesage/config.yaml
```

### Backup System Setup

```bash
# Create backup script
sudo tee /opt/notesage/backup.sh > /dev/null <<'EOF'
#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="/var/lib/notesage/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database backup
if [ -f /etc/notesage/config.yaml ]; then
    DB_TYPE=$(grep "type:" /etc/notesage/config.yaml | awk '{print $2}' | tr -d '"')
    
    if [ "$DB_TYPE" = "postgres" ]; then
        DB_NAME=$(grep "name:" /etc/notesage/config.yaml | awk '{print $2}' | tr -d '"')
        DB_USER=$(grep "user:" /etc/notesage/config.yaml | awk '{print $2}' | tr -d '"')
        
        PGPASSWORD=$(grep "password:" /etc/notesage/config.yaml | awk '{print $2}' | tr -d '"') \
        pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/database_$DATE.sql"
        
    elif [ "$DB_TYPE" = "sqlite" ]; then
        DB_FILE=$(grep "file:" /etc/notesage/config.yaml | awk '{print $2}' | tr -d '"')
        cp "$DB_FILE" "$BACKUP_DIR/database_$DATE.db"
    fi
fi

# Compress backup
gzip "$BACKUP_DIR/database_$DATE.*"

# Configuration backup
cp /etc/notesage/config.yaml "$BACKUP_DIR/config_$DATE.yaml"

# Clean old backups
find "$BACKUP_DIR" -name "database_*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "config_*.yaml" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
EOF

# Make script executable
sudo chmod +x /opt/notesage/backup.sh
sudo chown notesage:notesage /opt/notesage/backup.sh

# Test backup script
sudo -u notesage /opt/notesage/backup.sh

# Schedule daily backups
sudo -u notesage crontab -e
# Add: 0 2 * * * /opt/notesage/backup.sh >> /var/log/notesage/backup.log 2>&1
```

### Monitoring and Logging

```bash
# Set up log rotation
sudo tee /etc/logrotate.d/notesage > /dev/null <<EOF
/var/log/notesage/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 notesage notesage
    postrotate
        systemctl reload notesage > /dev/null 2>&1 || true
    endscript
}
EOF

# Create health monitoring script
sudo tee /opt/notesage/health-monitor.sh > /dev/null <<'EOF'
#!/bin/bash
set -euo pipefail

HEALTH_URL="http://localhost:8080/health"
LOG_FILE="/var/log/notesage/health-monitor.log"
MAX_RETRIES=3
RETRY_DELAY=5

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

check_health() {
    local retry=0
    while [ $retry -lt $MAX_RETRIES ]; do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            return 0
        fi
        retry=$((retry + 1))
        sleep $RETRY_DELAY
    done
    return 1
}

if ! check_health; then
    log_message "ERROR: Health check failed after $MAX_RETRIES attempts"
    log_message "INFO: Restarting NoteSage service"
    systemctl restart notesage
    
    # Wait for service to start
    sleep 10
    
    if check_health; then
        log_message "INFO: Service restarted successfully"
    else
        log_message "CRITICAL: Service restart failed"
        # Send alert notification here
    fi
else
    log_message "INFO: Health check passed"
fi
EOF

sudo chmod +x /opt/notesage/health-monitor.sh
sudo chown notesage:notesage /opt/notesage/health-monitor.sh

# Schedule health checks every 5 minutes
sudo crontab -e
# Add: */5 * * * * /opt/notesage/health-monitor.sh
```

## Security Hardening

### System Security

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install security updates automatically
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Configure fail2ban for SSH protection
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Disable unnecessary services
sudo systemctl disable apache2 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true
```

### Database Security

```bash
# Secure PostgreSQL configuration
sudo tee -a /etc/postgresql/*/main/postgresql.conf > /dev/null <<EOF

# Security settings
ssl = on
password_encryption = scram-sha-256
log_connections = on
log_disconnections = on
log_statement = 'mod'
EOF

# Update pg_hba.conf for secure authentication
sudo sed -i 's/local   all             all                                     peer/local   all             all                                     scram-sha-256/' /etc/postgresql/*/main/pg_hba.conf

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Application Security

```bash
# Set secure file permissions
sudo chmod 600 /etc/notesage/config.yaml
sudo chown root:notesage /etc/notesage/config.yaml

# Secure log directory
sudo chmod 750 /var/log/notesage
sudo chown notesage:notesage /var/log/notesage

# Secure data directory
sudo chmod 750 /var/lib/notesage
sudo chown notesage:notesage /var/lib/notesage
```

## Troubleshooting Installation

### Common Issues and Solutions

**Service fails to start:**
```bash
# Check service status and logs
sudo systemctl status notesage
sudo journalctl -u notesage --no-pager -l

# Common fixes:
# 1. Verify configuration syntax
sudo -u notesage /opt/notesage/notesage-server --config /etc/notesage/config.yaml --validate

# 2. Check database connectivity
sudo -u notesage /opt/notesage/notesage-server --config /etc/notesage/config.yaml --test-db

# 3. Verify file permissions
sudo chown -R notesage:notesage /var/log/notesage /var/lib/notesage
sudo chmod 640 /etc/notesage/config.yaml
```

**Database connection errors:**
```bash
# Test PostgreSQL connection
sudo -u notesage psql -h localhost -U notesage -d notesage -c "SELECT version();"

# Check PostgreSQL service
sudo systemctl status postgresql

# Review PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

**Port binding errors:**
```bash
# Check if port is in use
sudo netstat -tlnp | grep :8080
sudo lsof -i :8080

# Kill conflicting processes if necessary
sudo fuser -k 8080/tcp
```

**Permission errors:**
```bash
# Fix common permission issues
sudo chown -R notesage:notesage /var/log/notesage /var/lib/notesage
sudo chown root:notesage /etc/notesage/config.yaml
sudo chmod 640 /etc/notesage/config.yaml
sudo chmod 750 /var/log/notesage /var/lib/notesage
```

### Diagnostic Commands

```bash
# System information
uname -a
lsb_release -a
free -h
df -h

# Service diagnostics
sudo systemctl status notesage
sudo journalctl -u notesage --since "1 hour ago"

# Network diagnostics
sudo netstat -tlnp | grep notesage
sudo ss -tlnp | grep :8080

# Database diagnostics
sudo -u postgres psql -c "\l" | grep notesage
sudo -u notesage psql -h localhost -U notesage -d notesage -c "\dt"

# Configuration validation
sudo -u notesage /opt/notesage/notesage-server --config /etc/notesage/config.yaml --validate
```

## Performance Tuning

### Database Optimization

```bash
# PostgreSQL tuning for NoteSage
sudo tee -a /etc/postgresql/*/main/postgresql.conf > /dev/null <<EOF

# Performance tuning
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
EOF

sudo systemctl restart postgresql
```

### System Optimization

```bash
# Increase file descriptor limits
sudo tee -a /etc/security/limits.conf > /dev/null <<EOF
notesage soft nofile 65536
notesage hard nofile 65536
EOF

# Optimize kernel parameters
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF
# NoteSage optimizations
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
vm.swappiness = 10
EOF

sudo sysctl -p
```

## Next Steps

After successful installation:

1. **User Management**: Create user accounts for your team
2. **Desktop Client Setup**: Install and configure desktop applications
3. **AI Configuration**: Set up AI providers for enhanced features
4. **Backup Verification**: Test backup and restore procedures
5. **Monitoring Setup**: Implement comprehensive monitoring
6. **Security Review**: Conduct security assessment
7. **Performance Testing**: Test with expected user load
8. **Documentation**: Document your specific configuration

For detailed configuration options, see the [Configuration Guide](configuration.md).
For ongoing maintenance, see the [Maintenance and Upgrades Guide](upgrades.md).
For user management, see the [User Management Guide](user-management.md).
# NoteSage Server Installation Guide

This guide provides comprehensive instructions for installing, configuring, and managing the NoteSage server on Ubuntu Linux.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Installation](#quick-installation)
- [Manual Installation](#manual-installation)
- [Configuration](#configuration)
- [Service Management](#service-management)
- [Backup and Restore](#backup-and-restore)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Upgrades](#upgrades)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## System Requirements

### Minimum Requirements
- **Operating System**: Ubuntu 20.04 LTS or later
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 10GB available disk space
- **CPU**: 1 core minimum, 2 cores recommended
- **Network**: Internet connection for installation and updates

### Software Dependencies
The installation script will automatically install these dependencies:
- PostgreSQL 12 or later
- systemd (for service management)
- curl or wget (for downloads)
- gzip (for backups)
- UFW firewall (optional but recommended)

## Quick Installation

### Automated Installation

1. **Download the installation script:**
   ```bash
   wget https://github.com/notesage/server/releases/latest/download/install.sh
   chmod +x install.sh
   ```

2. **Run the installation:**
   ```bash
   sudo ./install.sh
   ```

3. **Follow the installation prompts and wait for completion.**

4. **Access your NoteSage server:**
   - Server URL: `http://your-server-ip:8080`
   - Admin credentials: Check `/etc/notesage/admin-credentials.txt`

### What the Installation Does

The automated installation script performs the following actions:

1. **System Checks**: Verifies Ubuntu version and system requirements
2. **Dependencies**: Installs PostgreSQL, nginx, and other required packages
3. **Database Setup**: Creates NoteSage database and user with secure password
4. **User Creation**: Creates `notesage` system user for running the service
5. **Directory Structure**: Creates all necessary directories with proper permissions
6. **Binary Installation**: Downloads and installs the NoteSage server binary
7. **Configuration**: Generates secure configuration files with random secrets
8. **Service Setup**: Creates and enables systemd service
9. **Firewall**: Configures UFW firewall rules
10. **Database Migration**: Initializes database schema
11. **Service Start**: Starts the NoteSage service

## Manual Installation

If you prefer to install manually or need to customize the installation:

### Step 1: Prepare the System

```bash
# Update package list
sudo apt update

# Install dependencies
sudo apt install -y postgresql postgresql-contrib nginx ufw curl wget unzip
```

### Step 2: Setup Database

```bash
# Start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres createdb notesage
sudo -u postgres createuser notesage
sudo -u postgres psql -c "ALTER USER notesage WITH PASSWORD 'your-secure-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE notesage TO notesage;"
```

### Step 3: Create System User

```bash
# Create notesage user
sudo useradd -r -s /bin/false -d /opt/notesage notesage

# Create directories
sudo mkdir -p /opt/notesage
sudo mkdir -p /etc/notesage
sudo mkdir -p /var/lib/notesage
sudo mkdir -p /var/log/notesage

# Set permissions
sudo chown -R notesage:notesage /var/lib/notesage
sudo chown -R notesage:notesage /var/log/notesage
sudo chown -R root:notesage /etc/notesage
sudo chmod 750 /etc/notesage
```

### Step 4: Install Binary

```bash
# Download NoteSage server binary
wget -O /tmp/notesage-server https://github.com/notesage/server/releases/latest/download/notesage-server-linux-amd64

# Install binary
sudo cp /tmp/notesage-server /opt/notesage/notesage-server
sudo chmod +x /opt/notesage/notesage-server
sudo chown notesage:notesage /opt/notesage/notesage-server
```

### Step 5: Configure Service

```bash
# Copy configuration files
sudo cp config.yaml /etc/notesage/
sudo cp notesage.service /etc/systemd/system/

# Update configuration with your database password
sudo sed -i 's/REPLACE_WITH_GENERATED_PASSWORD/your-secure-password/' /etc/notesage/config.yaml

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 64)
sudo sed -i "s/REPLACE_WITH_GENERATED_SECRET/$JWT_SECRET/" /etc/notesage/config.yaml

# Set permissions
sudo chmod 640 /etc/notesage/config.yaml
sudo chown root:notesage /etc/notesage/config.yaml

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable notesage
sudo systemctl start notesage
```

## Configuration

### Main Configuration File

The main configuration file is located at `/etc/notesage/config.yaml`. Key sections include:

#### Server Configuration
```yaml
server:
  host: "0.0.0.0"          # Bind to all interfaces
  port: 8080               # Server port
  tls:
    enabled: false         # Enable for HTTPS
    cert_file: "/path/to/cert.pem"
    key_file: "/path/to/key.pem"
```

#### Database Configuration
```yaml
database:
  type: "postgres"         # postgres or sqlite
  host: "localhost"
  port: 5432
  name: "notesage"
  user: "notesage"
  password: "your-password"
```

#### Authentication Configuration
```yaml
auth:
  jwt_secret: "your-jwt-secret"
  session_timeout: "24h"
  password_min_length: 8
```

### Environment-Specific Configuration

The configuration supports environment-specific overrides:

```yaml
environments:
  production:
    logging:
      level: "info"
    server:
      tls:
        enabled: true
  
  development:
    logging:
      level: "debug"
      console: true
```

### SSL/TLS Configuration

To enable HTTPS:

1. **Obtain SSL certificates** (Let's Encrypt recommended):
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

2. **Update configuration**:
   ```yaml
   server:
     tls:
       enabled: true
       cert_file: "/etc/letsencrypt/live/your-domain.com/fullchain.pem"
       key_file: "/etc/letsencrypt/live/your-domain.com/privkey.pem"
   ```

3. **Restart service**:
   ```bash
   sudo systemctl restart notesage
   ```

## Service Management

### Basic Service Commands

```bash
# Check service status
sudo systemctl status notesage

# Start service
sudo systemctl start notesage

# Stop service
sudo systemctl stop notesage

# Restart service
sudo systemctl restart notesage

# Reload configuration
sudo systemctl reload notesage

# Enable auto-start
sudo systemctl enable notesage

# Disable auto-start
sudo systemctl disable notesage
```

### View Logs

```bash
# View recent logs
sudo journalctl -u notesage -n 50

# Follow logs in real-time
sudo journalctl -u notesage -f

# View logs for specific date
sudo journalctl -u notesage --since "2024-01-15"

# View application logs
sudo tail -f /var/log/notesage/server.log
```

### Health Check

```bash
# Quick health check
curl http://localhost:8080/health

# Comprehensive health check
sudo /opt/notesage/health-check.sh

# JSON output for monitoring
sudo /opt/notesage/health-check.sh --json
```

## Backup and Restore

### Automated Backups

Backups are automatically created daily at 2 AM by default. To configure:

```yaml
backup:
  enabled: true
  schedule: "0 2 * * *"    # Cron format
  retention_days: 30
  storage_path: "/var/lib/notesage/backups"
```

### Manual Backup

```bash
# Create backup
sudo /opt/notesage/backup.sh create

# List available backups
sudo /opt/notesage/backup.sh list

# Create backup with custom retention
sudo /opt/notesage/backup.sh --retention 60
```

### Restore from Backup

```bash
# List available backups
sudo /opt/notesage/restore.sh list

# Interactive restore
sudo /opt/notesage/restore.sh restore

# Restore specific backup
sudo /opt/notesage/restore.sh restore notesage_backup_20240115_120000

# Force restore without confirmation
sudo /opt/notesage/restore.sh restore --force backup_name
```

### Backup Contents

Each backup includes:
- **Database dump**: Complete PostgreSQL database export
- **Configuration files**: All files from `/etc/notesage/`
- **User data**: Files from `/var/lib/notesage/`
- **Manifest file**: Backup metadata and checksums

## Monitoring and Health Checks

### Health Check Script

The health check script monitors various aspects of the system:

```bash
# Run comprehensive health check
sudo /opt/notesage/health-check.sh

# Quiet mode (for cron jobs)
sudo /opt/notesage/health-check.sh --quiet

# JSON output (for monitoring systems)
sudo /opt/notesage/health-check.sh --json
```

### Monitored Components

- Service status and uptime
- HTTP endpoint responsiveness
- Database connectivity
- Disk space usage
- Memory consumption
- Log file analysis
- Configuration validation
- Network connectivity
- Backup status

### Setting Up Monitoring

Add to crontab for regular monitoring:

```bash
# Edit crontab
sudo crontab -e

# Add health check every 5 minutes
*/5 * * * * /opt/notesage/health-check.sh --quiet
```

### Metrics and Prometheus

If Prometheus monitoring is enabled:

```yaml
monitoring:
  prometheus_enabled: true
  metrics_port: 9090
```

Access metrics at: `http://your-server:9090/metrics`

## Upgrades

### Automatic Upgrade Check

```bash
# Check for available updates
sudo /opt/notesage/upgrade.sh check

# Perform upgrade with confirmation
sudo /opt/notesage/upgrade.sh upgrade

# Force upgrade without confirmation
sudo /opt/notesage/upgrade.sh --force
```

### Upgrade Process

The upgrade script performs these steps:

1. **Backup**: Creates pre-upgrade backup
2. **Download**: Downloads new version
3. **Stop**: Stops the service
4. **Install**: Replaces binary
5. **Migrate**: Runs database migrations
6. **Start**: Starts the service
7. **Verify**: Checks service health

### Rollback

If an upgrade fails, the script automatically rolls back:
- Restores previous binary
- Restores database from backup
- Restarts service

## Troubleshooting

### Common Issues

#### Service Won't Start

1. **Check logs**:
   ```bash
   sudo journalctl -u notesage -n 50
   ```

2. **Verify configuration**:
   ```bash
   sudo /opt/notesage/notesage-server --config /etc/notesage/config.yaml --validate
   ```

3. **Check permissions**:
   ```bash
   ls -la /opt/notesage/
   ls -la /etc/notesage/
   ```

#### Database Connection Issues

1. **Check PostgreSQL status**:
   ```bash
   sudo systemctl status postgresql
   ```

2. **Test database connection**:
   ```bash
   sudo -u postgres psql -d notesage -c "SELECT 1;"
   ```

3. **Verify credentials in config**:
   ```bash
   sudo grep -A 10 "database:" /etc/notesage/config.yaml
   ```

#### Port Already in Use

1. **Check what's using the port**:
   ```bash
   sudo netstat -tlnp | grep :8080
   ```

2. **Change port in configuration**:
   ```yaml
   server:
     port: 8081  # Use different port
   ```

#### High Memory Usage

1. **Check memory usage**:
   ```bash
   free -h
   ps aux | grep notesage-server
   ```

2. **Adjust configuration**:
   ```yaml
   database:
     max_connections: 10  # Reduce connections
   ```

#### SSL Certificate Issues

1. **Check certificate validity**:
   ```bash
   openssl x509 -in /path/to/cert.pem -text -noout
   ```

2. **Verify certificate permissions**:
   ```bash
   ls -la /etc/letsencrypt/live/your-domain.com/
   ```

### Log Analysis

#### Application Logs
```bash
# View error logs
sudo grep -i error /var/log/notesage/server.log

# View recent activity
sudo tail -f /var/log/notesage/server.log

# Search for specific patterns
sudo grep "database" /var/log/notesage/server.log
```

#### System Logs
```bash
# View systemd logs
sudo journalctl -u notesage --since "1 hour ago"

# View system messages
sudo tail -f /var/log/syslog | grep notesage
```

### Performance Tuning

#### Database Optimization
```yaml
database:
  max_connections: 25
  max_idle_connections: 5
  connection_timeout: "30s"
```

#### Memory Settings
```yaml
cache:
  memory_cache:
    max_size: "100MB"
    ttl: "1h"
```

#### Logging Optimization
```yaml
logging:
  level: "info"  # Use "warn" or "error" for production
  max_size: 50   # Smaller log files
```

## Security Considerations

### Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow ssh

# Allow NoteSage port
sudo ufw allow 8080/tcp

# Allow HTTPS if using SSL
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### Secure Configuration

1. **Use strong passwords**:
   - Database password: 32+ characters
   - JWT secret: 64+ characters
   - Admin password: 16+ characters

2. **Enable TLS/SSL**:
   ```yaml
   server:
     tls:
       enabled: true
   ```

3. **Restrict CORS origins**:
   ```yaml
   server:
     cors:
       origins: ["https://your-domain.com"]
   ```

4. **Enable security headers**:
   ```yaml
   security:
     security_headers: true
     csp:
       enabled: true
   ```

### File Permissions

Ensure proper file permissions:

```bash
# Configuration files
sudo chmod 640 /etc/notesage/*.yaml
sudo chown root:notesage /etc/notesage/*.yaml

# Data directory
sudo chmod 750 /var/lib/notesage
sudo chown notesage:notesage /var/lib/notesage

# Log directory
sudo chmod 750 /var/log/notesage
sudo chown notesage:notesage /var/log/notesage
```

### Regular Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update NoteSage
sudo /opt/notesage/upgrade.sh check
```

## Support and Documentation

### Getting Help

- **GitHub Issues**: https://github.com/notesage/server/issues
- **Documentation**: https://github.com/notesage/server/docs
- **Community**: https://github.com/notesage/server/discussions

### Useful Commands Reference

```bash
# Service management
sudo systemctl {start|stop|restart|status} notesage

# View logs
sudo journalctl -u notesage -f
sudo tail -f /var/log/notesage/server.log

# Health and monitoring
sudo /opt/notesage/health-check.sh
curl http://localhost:8080/health

# Backup and restore
sudo /opt/notesage/backup.sh create
sudo /opt/notesage/restore.sh list

# Upgrades
sudo /opt/notesage/upgrade.sh check
sudo /opt/notesage/upgrade.sh upgrade

# Configuration
sudo nano /etc/notesage/config.yaml
sudo systemctl reload notesage
```

### File Locations

- **Binary**: `/opt/notesage/notesage-server`
- **Configuration**: `/etc/notesage/config.yaml`
- **Data**: `/var/lib/notesage/`
- **Logs**: `/var/log/notesage/`
- **Backups**: `/var/lib/notesage/backups/`
- **Service**: `/etc/systemd/system/notesage.service`

This completes the comprehensive installation and deployment guide for the NoteSage server.
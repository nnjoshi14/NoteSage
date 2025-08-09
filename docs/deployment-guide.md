# NoteSage Production Deployment Guide

This guide covers production deployment strategies, infrastructure setup, and operational best practices for NoteSage.

## Deployment Architecture Overview

NoteSage supports multiple deployment architectures to meet different organizational needs:

```
┌─────────────────────────────────────────────────────────────┐
│                Production Deployment Options                │
├─────────────────────────────────────────────────────────────┤
│  Single Server Deployment                                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Ubuntu Server                                          │ │
│  │  ├── NoteSage Server (Go)                              │ │
│  │  ├── PostgreSQL Database                               │ │
│  │  ├── Nginx Reverse Proxy                               │ │
│  │  └── SSL/TLS Termination                               │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  High Availability Deployment                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Load Balancer  │  │  Load Balancer  │                  │
│  │     (Primary)   │  │   (Secondary)   │                  │
│  └─────────┬───────┘  └─────────┬───────┘                  │
│            │                    │                          │
│  ┌─────────┴───────┐  ┌─────────┴───────┐                  │
│  │ NoteSage Server │  │ NoteSage Server │                  │
│  │    (Node 1)     │  │    (Node 2)     │                  │
│  └─────────┬───────┘  └─────────┬───────┘                  │
│            │                    │                          │
│  ┌─────────┴────────────────────┴───────┐                  │
│  │        PostgreSQL Cluster            │                  │
│  │  ┌─────────┐  ┌─────────┐  ┌───────┐ │                  │
│  │  │ Primary │  │Standby 1│  │Standby│ │                  │
│  │  └─────────┘  └─────────┘  └───────┘ │                  │
│  └───────────────────────────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Cloud Deployment (Future)                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Container Orchestration (Kubernetes/Docker Swarm)     │ │
│  │  ├── NoteSage Server Pods/Containers                   │ │
│  │  ├── Managed Database (RDS/Cloud SQL)                  │ │
│  │  ├── Load Balancer (ALB/Cloud Load Balancer)          │ │
│  │  ├── Auto-scaling Groups                               │ │
│  │  └── Monitoring & Logging (CloudWatch/Stackdriver)    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Single Server Production Deployment

### Prerequisites

**Server Requirements:**
- Ubuntu 22.04 LTS (recommended)
- 4 CPU cores, 8GB RAM minimum
- 100GB SSD storage
- Static IP address or domain name
- SSL certificate (Let's Encrypt recommended)

**Network Requirements:**
- Ports 80, 443 open for HTTP/HTTPS
- Port 22 for SSH administration
- Firewall configured for security

### Step 1: Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl \
    wget \
    unzip \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    fail2ban \
    ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Step 2: Database Setup

```bash
# Secure PostgreSQL installation
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'secure_postgres_password';"

# Create production database
sudo -u postgres createdb notesage_prod
sudo -u postgres createuser notesage_prod
sudo -u postgres psql -c "ALTER USER notesage_prod WITH PASSWORD 'secure_notesage_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE notesage_prod TO notesage_prod;"
sudo -u postgres psql -c "ALTER DATABASE notesage_prod OWNER TO notesage_prod;"

# Configure PostgreSQL for production
sudo tee -a /etc/postgresql/*/main/postgresql.conf > /dev/null <<EOF

# Production Configuration
max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 8MB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_connections = on
log_disconnections = on
log_statement = 'mod'

# Security
ssl = on
password_encryption = scram-sha-256
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Step 3: NoteSage Server Installation

```bash
# Download and install NoteSage server
wget https://releases.notesage.com/latest/install.sh
chmod +x install.sh

# Run production installation
sudo ./install.sh \
    --database=postgres \
    --domain=notesage.yourdomain.com \
    --ssl \
    --production

# Verify installation
sudo systemctl status notesage
curl -f http://localhost:8080/health
```

### Step 4: Nginx Reverse Proxy Setup

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/notesage > /dev/null <<'EOF'
# NoteSage Production Configuration
upstream notesage_backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

server {
    listen 80;
    server_name notesage.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name notesage.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/notesage.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notesage.yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Logging
    access_log /var/log/nginx/notesage.access.log;
    error_log /var/log/nginx/notesage.error.log;
    
    # Client settings
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # API endpoints with rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=10 nodelay;
        proxy_pass http://notesage_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://notesage_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://notesage_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Health check (no rate limiting)
    location /health {
        proxy_pass http://notesage_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # Static files (if serving any)
    location /static/ {
        alias /var/lib/notesage/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security: Block access to sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ \.(sql|conf|log)$ {
        deny all;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/notesage /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 5: SSL Certificate Setup

```bash
# Obtain Let's Encrypt certificate
sudo certbot --nginx -d notesage.yourdomain.com

# Set up automatic renewal
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet && systemctl reload nginx

# Test renewal
sudo certbot renew --dry-run
```

### Step 6: Production Configuration

```bash
# Update NoteSage configuration for production
sudo tee /etc/notesage/config.yaml > /dev/null <<EOF
# Production Configuration
server:
  host: "127.0.0.1"  # Only bind to localhost (Nginx handles external)
  port: 8080
  read_timeout: "30s"
  write_timeout: "30s"
  idle_timeout: "120s"

database:
  type: "postgres"
  host: "localhost"
  port: 5432
  name: "notesage_prod"
  user: "notesage_prod"
  password: "secure_notesage_password"
  ssl_mode: "require"
  max_open_conns: 50
  max_idle_conns: 10
  conn_max_lifetime: "5m"

auth:
  jwt_secret: "$(openssl rand -base64 32)"
  session_timeout: "24h"
  password_min_length: 12
  max_login_attempts: 5
  lockout_duration: "30m"

logging:
  level: "info"
  format: "json"
  file: "/var/log/notesage/server.log"
  max_size: 100
  max_backups: 10
  max_age: 30
  compress: true

features:
  ai_enabled: true
  websocket_enabled: true
  file_uploads: true
  max_upload_size: "10MB"

security:
  cors_origins: ["https://notesage.yourdomain.com"]
  rate_limit:
    enabled: true
    requests_per_minute: 60
    burst: 20
  csrf_protection: true
  content_security_policy: true

backup:
  enabled: true
  schedule: "0 2 * * *"
  retention_days: 30
  compression: true
  location: "/var/lib/notesage/backups"

monitoring:
  health_check_enabled: true
  metrics_enabled: true
  prometheus_endpoint: "/metrics"
EOF

# Restart NoteSage
sudo systemctl restart notesage
```

## High Availability Deployment

### Architecture Components

**Load Balancer Setup:**
```bash
# Install HAProxy for load balancing
sudo apt install -y haproxy

# Configure HAProxy
sudo tee /etc/haproxy/haproxy.cfg > /dev/null <<'EOF'
global
    daemon
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    option dontlognull

frontend notesage_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/notesage.pem
    redirect scheme https if !{ ssl_fc }
    
    # Health check
    acl health_check path_beg /health
    use_backend notesage_health if health_check
    
    # WebSocket detection
    acl is_websocket hdr(Upgrade) -i websocket
    use_backend notesage_websocket if is_websocket
    
    default_backend notesage_backend

backend notesage_backend
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    
    server notesage1 10.0.1.10:8080 check
    server notesage2 10.0.1.11:8080 check

backend notesage_websocket
    balance source
    option httpchk GET /health
    http-check expect status 200
    
    server notesage1 10.0.1.10:8080 check
    server notesage2 10.0.1.11:8080 check

backend notesage_health
    option httpchk GET /health
    http-check expect status 200
    
    server notesage1 10.0.1.10:8080 check
    server notesage2 10.0.1.11:8080 check

listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats admin if TRUE
EOF

sudo systemctl restart haproxy
```

**PostgreSQL Cluster Setup:**
```bash
# Primary server setup
sudo -u postgres initdb -D /var/lib/postgresql/data
sudo -u postgres pg_ctl -D /var/lib/postgresql/data -l /var/lib/postgresql/logfile start

# Configure replication
sudo tee -a /var/lib/postgresql/data/postgresql.conf > /dev/null <<EOF
# Replication settings
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
synchronous_commit = on
synchronous_standby_names = 'standby1,standby2'
EOF

# Configure authentication for replication
sudo tee -a /var/lib/postgresql/data/pg_hba.conf > /dev/null <<EOF
# Replication connections
host replication replicator 10.0.1.0/24 md5
EOF

# Create replication user
sudo -u postgres psql -c "CREATE USER replicator REPLICATION LOGIN ENCRYPTED PASSWORD 'replication_password';"

# Restart primary
sudo systemctl restart postgresql
```

### Application Server Configuration

**Node 1 Configuration:**
```yaml
# /etc/notesage/config.yaml on Node 1
server:
  host: "0.0.0.0"
  port: 8080

database:
  type: "postgres"
  host: "10.0.1.20"  # Primary database server
  port: 5432
  name: "notesage_prod"
  user: "notesage_prod"
  password: "secure_password"
  max_open_conns: 25

# Redis for session sharing
redis:
  enabled: true
  url: "redis://10.0.1.30:6379/0"
  password: "redis_password"

# Node identification
node:
  id: "node1"
  region: "us-east-1a"
```

**Node 2 Configuration:**
```yaml
# /etc/notesage/config.yaml on Node 2
server:
  host: "0.0.0.0"
  port: 8080

database:
  type: "postgres"
  host: "10.0.1.20"  # Same primary database
  port: 5432
  name: "notesage_prod"
  user: "notesage_prod"
  password: "secure_password"
  max_open_conns: 25

redis:
  enabled: true
  url: "redis://10.0.1.30:6379/0"
  password: "redis_password"

node:
  id: "node2"
  region: "us-east-1b"
```

## Container Deployment (Docker)

### Docker Compose Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  notesage-server:
    image: notesage/server:1.0.0
    restart: unless-stopped
    environment:
      - NOTESAGE_DATABASE_TYPE=postgres
      - NOTESAGE_DATABASE_HOST=postgres
      - NOTESAGE_DATABASE_NAME=notesage
      - NOTESAGE_DATABASE_USER=notesage
      - NOTESAGE_DATABASE_PASSWORD=secure_password
      - NOTESAGE_AUTH_JWT_SECRET=${JWT_SECRET}
      - NOTESAGE_REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    networks:
      - notesage-network
    volumes:
      - notesage-data:/var/lib/notesage
      - notesage-logs:/var/log/notesage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      - POSTGRES_DB=notesage
      - POSTGRES_USER=notesage
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - notesage-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notesage"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass redis_password
    volumes:
      - redis-data:/data
    networks:
      - notesage-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
      - nginx-logs:/var/log/nginx
    depends_on:
      - notesage-server
    networks:
      - notesage-network

volumes:
  notesage-data:
  notesage-logs:
  postgres-data:
  redis-data:
  nginx-logs:

networks:
  notesage-network:
    driver: bridge
```

### Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: notesage

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: notesage-config
  namespace: notesage
data:
  config.yaml: |
    server:
      host: "0.0.0.0"
      port: 8080
    database:
      type: "postgres"
      host: "postgres-service"
      port: 5432
      name: "notesage"
      user: "notesage"
    logging:
      level: "info"
      format: "json"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: notesage-secrets
  namespace: notesage
type: Opaque
data:
  database-password: <base64-encoded-password>
  jwt-secret: <base64-encoded-jwt-secret>
  redis-password: <base64-encoded-redis-password>

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notesage-server
  namespace: notesage
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notesage-server
  template:
    metadata:
      labels:
        app: notesage-server
    spec:
      containers:
      - name: notesage-server
        image: notesage/server:1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: NOTESAGE_DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: notesage-secrets
              key: database-password
        - name: NOTESAGE_AUTH_JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: notesage-secrets
              key: jwt-secret
        volumeMounts:
        - name: config
          mountPath: /etc/notesage
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: config
        configMap:
          name: notesage-config

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: notesage-service
  namespace: notesage
spec:
  selector:
    app: notesage-server
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: notesage-ingress
  namespace: notesage
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-read-timeout: "86400"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "86400"
    nginx.ingress.kubernetes.io/websocket-services: notesage-service
spec:
  tls:
  - hosts:
    - notesage.yourdomain.com
    secretName: notesage-tls
  rules:
  - host: notesage.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: notesage-service
            port:
              number: 80
```

## Monitoring and Observability

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "notesage_rules.yml"

scrape_configs:
  - job_name: 'notesage'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "NoteSage Production Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"notesage\"}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes / 1024 / 1024",
            "legendFormat": "Memory (MB)"
          }
        ]
      }
    ]
  }
}
```

### Alert Rules

```yaml
# notesage_rules.yml
groups:
- name: notesage
  rules:
  - alert: NoteSageDown
    expr: up{job="notesage"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "NoteSage server is down"
      description: "NoteSage server has been down for more than 1 minute"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time"
      description: "95th percentile response time is above 2 seconds"

  - alert: DatabaseConnectionsHigh
    expr: pg_stat_database_numbackends{datname="notesage"} > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High database connections"
      description: "Database connections are above 80"

  - alert: DiskSpaceHigh
    expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Disk space usage high"
      description: "Disk space usage is above 85%"
```

## Backup and Disaster Recovery

### Automated Backup Script

```bash
#!/bin/bash
# /opt/notesage/backup-production.sh

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/notesage"
S3_BUCKET="notesage-backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
echo "Starting database backup..."
PGPASSWORD="secure_password" pg_dump \
    -h localhost \
    -U notesage_prod \
    -d notesage_prod \
    --verbose \
    --no-owner \
    --no-privileges \
    > "$BACKUP_DIR/database_$DATE.sql"

# Compress database backup
gzip "$BACKUP_DIR/database_$DATE.sql"

# Application data backup
echo "Backing up application data..."
tar -czf "$BACKUP_DIR/appdata_$DATE.tar.gz" \
    /var/lib/notesage \
    /etc/notesage \
    --exclude="/var/lib/notesage/cache"

# Configuration backup
echo "Backing up configuration..."
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    /etc/notesage \
    /etc/nginx/sites-available/notesage \
    /etc/systemd/system/notesage.service

# Upload to S3 (if configured)
if command -v aws &> /dev/null; then
    echo "Uploading to S3..."
    aws s3 cp "$BACKUP_DIR/" "s3://$S3_BUCKET/$(hostname)/" --recursive --exclude "*" --include "*_$DATE.*"
fi

# Clean old local backups
echo "Cleaning old backups..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

# Verify backup integrity
echo "Verifying backup integrity..."
if gzip -t "$BACKUP_DIR/database_$DATE.sql.gz"; then
    echo "Database backup verified successfully"
else
    echo "ERROR: Database backup verification failed"
    exit 1
fi

if tar -tzf "$BACKUP_DIR/appdata_$DATE.tar.gz" > /dev/null; then
    echo "Application data backup verified successfully"
else
    echo "ERROR: Application data backup verification failed"
    exit 1
fi

echo "Backup completed successfully: $DATE"

# Send notification (optional)
if command -v mail &> /dev/null; then
    echo "NoteSage backup completed successfully on $(hostname) at $(date)" | \
        mail -s "NoteSage Backup Success" admin@yourdomain.com
fi
```

### Disaster Recovery Procedure

```bash
#!/bin/bash
# /opt/notesage/restore-production.sh

set -euo pipefail

BACKUP_FILE="$1"
RESTORE_TYPE="${2:-full}"  # full, database, config

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file> [restore_type]"
    echo "Restore types: full, database, config"
    exit 1
fi

echo "Starting disaster recovery..."
echo "Backup file: $BACKUP_FILE"
echo "Restore type: $RESTORE_TYPE"

# Stop services
echo "Stopping services..."
sudo systemctl stop notesage
sudo systemctl stop nginx

case "$RESTORE_TYPE" in
    "full"|"database")
        echo "Restoring database..."
        
        # Drop existing database
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS notesage_prod;"
        sudo -u postgres psql -c "CREATE DATABASE notesage_prod OWNER notesage_prod;"
        
        # Restore database
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -d notesage_prod
        else
            sudo -u postgres psql -d notesage_prod < "$BACKUP_FILE"
        fi
        
        echo "Database restored successfully"
        ;&  # Fall through to next case
        
    "full"|"config")
        if [ "$RESTORE_TYPE" = "full" ] || [ "$RESTORE_TYPE" = "config" ]; then
            echo "Restoring configuration..."
            
            # Backup current config
            sudo cp -r /etc/notesage /etc/notesage.backup.$(date +%Y%m%d_%H%M%S)
            
            # Restore configuration files
            sudo tar -xzf "$BACKUP_FILE" -C / --overwrite
            
            echo "Configuration restored successfully"
        fi
        ;;
        
    *)
        echo "Invalid restore type: $RESTORE_TYPE"
        exit 1
        ;;
esac

# Start services
echo "Starting services..."
sudo systemctl start notesage
sudo systemctl start nginx

# Verify restoration
echo "Verifying restoration..."
sleep 10

if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "✓ NoteSage server is responding"
else
    echo "✗ NoteSage server is not responding"
    exit 1
fi

if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✓ Nginx proxy is working"
else
    echo "✗ Nginx proxy is not working"
    exit 1
fi

echo "Disaster recovery completed successfully!"
```

## Performance Optimization

### Database Optimization

```sql
-- Performance tuning queries
-- Run these periodically to maintain optimal performance

-- Update table statistics
ANALYZE;

-- Reindex tables
REINDEX DATABASE notesage_prod;

-- Check for unused indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;

-- Monitor slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;
```

### Application Performance Tuning

```yaml
# Production performance configuration
server:
  # Connection settings
  read_timeout: "30s"
  write_timeout: "30s"
  idle_timeout: "120s"
  max_header_bytes: 1048576

database:
  # Connection pool optimization
  max_open_conns: 50
  max_idle_conns: 10
  conn_max_lifetime: "5m"
  conn_max_idle_time: "30s"

# Caching configuration
cache:
  memory:
    enabled: true
    max_size: "512MB"
    ttl: "1h"
    cleanup_interval: "10m"
  
  redis:
    enabled: true
    url: "redis://localhost:6379/0"
    pool_size: 20
    min_idle_conns: 5
    max_conn_age: "30m"

# Rate limiting
security:
  rate_limit:
    enabled: true
    requests_per_minute: 120
    burst: 30
    
# Logging optimization
logging:
  level: "info"  # Reduce to "warn" for high-traffic
  format: "json"
  max_size: 100
  max_backups: 5
  compress: true
```

## Security Hardening

### System Security

```bash
#!/bin/bash
# Security hardening script

# Update system
sudo apt update && sudo apt upgrade -y

# Install security tools
sudo apt install -y \
    fail2ban \
    ufw \
    rkhunter \
    chkrootkit \
    aide \
    auditd

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Configure fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

sudo systemctl restart fail2ban

# Configure automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Secure shared memory
echo "tmpfs /run/shm tmpfs defaults,noexec,nosuid 0 0" | sudo tee -a /etc/fstab

# Disable unused network protocols
echo "install dccp /bin/true" | sudo tee -a /etc/modprobe.d/blacklist-rare-network.conf
echo "install sctp /bin/true" | sudo tee -a /etc/modprobe.d/blacklist-rare-network.conf
echo "install rds /bin/true" | sudo tee -a /etc/modprobe.d/blacklist-rare-network.conf
echo "install tipc /bin/true" | sudo tee -a /etc/modprobe.d/blacklist-rare-network.conf

# Configure kernel parameters
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF
# IP Spoofing protection
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1

# Ignore ping requests
net.ipv4.icmp_echo_ignore_all = 1
EOF

sudo sysctl -p
```

### Application Security

```yaml
# Security-focused configuration
security:
  # CORS restrictions
  cors:
    enabled: true
    allowed_origins:
      - "https://notesage.yourdomain.com"
    allowed_methods: ["GET", "POST", "PUT", "DELETE"]
    allow_credentials: true
    max_age: 86400

  # Security headers
  headers:
    content_security_policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:"
    x_frame_options: "DENY"
    x_content_type_options: "nosniff"
    x_xss_protection: "1; mode=block"
    referrer_policy: "strict-origin-when-cross-origin"
    permissions_policy: "geolocation=(), microphone=(), camera=()"

  # Rate limiting
  rate_limiting:
    enabled: true
    global:
      requests_per_minute: 1000
      burst: 100
    per_user:
      requests_per_minute: 60
      burst: 10
    per_ip:
      requests_per_minute: 100
      burst: 20

  # Content security
  content:
    max_input_length: 1000000
    sanitize_html: true
    scan_uploads: true
    quarantine_suspicious: true
    max_scan_size: "50MB"

# Authentication security
auth:
  password_min_length: 12
  password_require_uppercase: true
  password_require_lowercase: true
  password_require_numbers: true
  password_require_symbols: true
  max_login_attempts: 3
  lockout_duration: "30m"
  session_timeout: "8h"
  max_concurrent_sessions: 3
```

## Maintenance Procedures

### Regular Maintenance Tasks

```bash
#!/bin/bash
# Weekly maintenance script

echo "Starting weekly maintenance..."

# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean package cache
sudo apt autoremove -y
sudo apt autoclean

# Rotate logs
sudo logrotate -f /etc/logrotate.conf

# Database maintenance
sudo -u postgres psql -d notesage_prod -c "VACUUM ANALYZE;"
sudo -u postgres psql -d notesage_prod -c "REINDEX DATABASE notesage_prod;"

# Check disk space
df -h

# Check memory usage
free -h

# Check service status
sudo systemctl status notesage
sudo systemctl status postgresql
sudo systemctl status nginx
sudo systemctl status redis

# Check for security updates
sudo unattended-upgrades --dry-run

# Backup verification
if [ -f "/var/backups/notesage/database_$(date +%Y%m%d)*.sql.gz" ]; then
    echo "✓ Recent backup found"
else
    echo "✗ No recent backup found"
fi

# SSL certificate check
if openssl x509 -checkend 2592000 -noout -in /etc/letsencrypt/live/notesage.yourdomain.com/cert.pem; then
    echo "✓ SSL certificate is valid for at least 30 days"
else
    echo "⚠ SSL certificate expires within 30 days"
fi

echo "Weekly maintenance completed"
```

### Health Check Script

```bash
#!/bin/bash
# Comprehensive health check

echo "NoteSage Health Check - $(date)"
echo "=================================="

# Service status
echo "Service Status:"
services=("notesage" "postgresql" "nginx" "redis")
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "✓ $service is running"
    else
        echo "✗ $service is not running"
    fi
done

# HTTP health check
echo -e "\nHTTP Health Check:"
if curl -f -s http://localhost:8080/health > /dev/null; then
    echo "✓ NoteSage API is responding"
else
    echo "✗ NoteSage API is not responding"
fi

if curl -f -s https://notesage.yourdomain.com/health > /dev/null; then
    echo "✓ HTTPS endpoint is responding"
else
    echo "✗ HTTPS endpoint is not responding"
fi

# Database connectivity
echo -e "\nDatabase Check:"
if sudo -u postgres psql -d notesage_prod -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Database is accessible"
    
    # Check database size
    db_size=$(sudo -u postgres psql -d notesage_prod -t -c "SELECT pg_size_pretty(pg_database_size('notesage_prod'));")
    echo "  Database size: $db_size"
    
    # Check connection count
    conn_count=$(sudo -u postgres psql -d notesage_prod -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='notesage_prod';")
    echo "  Active connections: $conn_count"
else
    echo "✗ Database is not accessible"
fi

# Disk space check
echo -e "\nDisk Space:"
df -h | grep -E "(Filesystem|/dev/)"

# Memory usage
echo -e "\nMemory Usage:"
free -h

# Load average
echo -e "\nLoad Average:"
uptime

# SSL certificate check
echo -e "\nSSL Certificate:"
if [ -f "/etc/letsencrypt/live/notesage.yourdomain.com/cert.pem" ]; then
    expiry_date=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/notesage.yourdomain.com/cert.pem | cut -d= -f2)
    echo "  Certificate expires: $expiry_date"
    
    if openssl x509 -checkend 2592000 -noout -in /etc/letsencrypt/live/notesage.yourdomain.com/cert.pem; then
        echo "✓ Certificate is valid for at least 30 days"
    else
        echo "⚠ Certificate expires within 30 days"
    fi
else
    echo "✗ SSL certificate not found"
fi

# Log file sizes
echo -e "\nLog File Sizes:"
du -sh /var/log/notesage/* 2>/dev/null || echo "No NoteSage logs found"
du -sh /var/log/nginx/* 2>/dev/null || echo "No Nginx logs found"

echo -e "\nHealth check completed"
```

This deployment guide provides comprehensive coverage of production deployment scenarios, from single-server setups to high-availability clusters and container orchestration. Choose the deployment strategy that best fits your organization's needs and scale requirements.

---

*For additional deployment assistance, contact support@notesage.com or create an issue on GitHub.*
# NoteSage Server Configuration Guide

This guide covers detailed configuration options for NoteSage server, including advanced settings, performance tuning, and integration options.

## Configuration File Structure

NoteSage uses YAML configuration files located at `/etc/notesage/config.yaml`. The configuration is organized into logical sections:

```yaml
# /etc/notesage/config.yaml
server:          # HTTP server settings
database:        # Database connection and settings
auth:           # Authentication and authorization
logging:        # Logging configuration
features:       # Feature toggles
ai:             # AI provider configuration
security:       # Security settings
backup:         # Backup configuration
monitoring:     # Monitoring and metrics
```

## Server Configuration

### Basic Server Settings

```yaml
server:
  # Network binding
  host: "0.0.0.0"              # Bind to all interfaces
  port: 8080                   # HTTP port
  
  # Timeouts
  read_timeout: "30s"          # Request read timeout
  write_timeout: "30s"         # Response write timeout
  idle_timeout: "120s"         # Keep-alive timeout
  shutdown_timeout: "30s"      # Graceful shutdown timeout
  
  # Request limits
  max_header_bytes: 1048576    # 1MB header limit
  max_request_size: "10MB"     # Maximum request body size
  
  # Performance
  enable_compression: true     # Enable gzip compression
  compression_level: 6         # Compression level (1-9)
```

### TLS/SSL Configuration

```yaml
server:
  tls:
    enabled: true
    cert_file: "/etc/ssl/certs/notesage.crt"
    key_file: "/etc/ssl/private/notesage.key"
    
    # Automatic certificate management (Let's Encrypt)
    auto_cert: true
    auto_cert_domains:
      - "notesage.example.com"
      - "notes.example.com"
    auto_cert_cache_dir: "/var/lib/notesage/autocert"
    
    # TLS settings
    min_version: "1.2"           # Minimum TLS version
    cipher_suites:               # Allowed cipher suites
      - "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
      - "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
    
    # HSTS settings
    hsts_enabled: true
    hsts_max_age: 31536000       # 1 year
    hsts_include_subdomains: true
```

### Reverse Proxy Configuration

When running behind a reverse proxy (nginx, Apache, etc.):

```yaml
server:
  # Trust proxy headers
  trust_proxy: true
  proxy_headers:
    - "X-Forwarded-For"
    - "X-Forwarded-Proto"
    - "X-Forwarded-Host"
  
  # Real IP detection
  real_ip_header: "X-Forwarded-For"
  real_ip_from:
    - "127.0.0.1"
    - "10.0.0.0/8"
    - "172.16.0.0/12"
    - "192.168.0.0/16"
```

## Database Configuration

### PostgreSQL Configuration

```yaml
database:
  type: "postgres"
  host: "localhost"
  port: 5432
  name: "notesage"
  user: "notesage"
  password: "secure_password"
  
  # SSL settings
  ssl_mode: "require"          # disable, require, verify-ca, verify-full
  ssl_cert: "/path/to/client-cert.pem"
  ssl_key: "/path/to/client-key.pem"
  ssl_root_cert: "/path/to/ca-cert.pem"
  
  # Connection pool settings
  max_open_conns: 25           # Maximum open connections
  max_idle_conns: 5            # Maximum idle connections
  conn_max_lifetime: "5m"      # Connection lifetime
  conn_max_idle_time: "30s"    # Idle connection timeout
  
  # Query settings
  default_query_timeout: "30s" # Default query timeout
  slow_query_threshold: "1s"   # Log slow queries
  
  # Migration settings
  auto_migrate: true           # Automatically run migrations
  migration_timeout: "5m"      # Migration timeout
```

### SQLite Configuration

```yaml
database:
  type: "sqlite"
  file: "/var/lib/notesage/notesage.db"
  
  # SQLite-specific settings
  cache_size: 2000             # Page cache size
  busy_timeout: "30s"          # Busy timeout
  journal_mode: "WAL"          # Journal mode (DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF)
  synchronous: "NORMAL"        # Synchronous mode (OFF, NORMAL, FULL, EXTRA)
  
  # Connection pool (SQLite supports limited concurrency)
  max_open_conns: 1
  max_idle_conns: 1
```

### Database Backup Configuration

```yaml
database:
  backup:
    enabled: true
    schedule: "0 2 * * *"       # Cron schedule (daily at 2 AM)
    retention_days: 30          # Keep backups for 30 days
    compression: true           # Compress backup files
    location: "/var/lib/notesage/backups"
    
    # Backup verification
    verify_backups: true        # Verify backup integrity
    verification_schedule: "0 3 * * 0"  # Weekly verification
    
    # Remote backup (optional)
    remote:
      enabled: false
      type: "s3"                # s3, gcs, azure
      bucket: "notesage-backups"
      region: "us-east-1"
      access_key: "your-access-key"
      secret_key: "your-secret-key"
```

## Authentication Configuration

### Basic Authentication Settings

```yaml
auth:
  # JWT configuration
  jwt_secret: "your-secure-jwt-secret"  # Use openssl rand -base64 32
  jwt_algorithm: "HS256"                # JWT signing algorithm
  session_timeout: "24h"                # Session duration
  refresh_token_timeout: "7d"           # Refresh token duration
  
  # Password policy
  password_min_length: 8                # Minimum password length
  password_require_uppercase: true      # Require uppercase letters
  password_require_lowercase: true      # Require lowercase letters
  password_require_numbers: true        # Require numbers
  password_require_symbols: false       # Require symbols
  
  # Account lockout
  max_login_attempts: 5                 # Max failed attempts
  lockout_duration: "15m"               # Lockout duration
  lockout_reset_time: "24h"             # Reset attempt counter
  
  # Session management
  max_concurrent_sessions: 5            # Max sessions per user
  session_cleanup_interval: "1h"        # Cleanup expired sessions
```

### External Authentication

**LDAP/Active Directory:**
```yaml
auth:
  ldap:
    enabled: true
    server: "ldap://ldap.example.com:389"
    bind_dn: "cn=notesage,ou=services,dc=example,dc=com"
    bind_password: "service-password"
    
    # User search
    user_base_dn: "ou=users,dc=example,dc=com"
    user_filter: "(uid=%s)"
    user_attributes:
      username: "uid"
      email: "mail"
      first_name: "givenName"
      last_name: "sn"
    
    # Group mapping
    group_base_dn: "ou=groups,dc=example,dc=com"
    group_filter: "(member=%s)"
    admin_groups:
      - "cn=notesage-admins,ou=groups,dc=example,dc=com"
    
    # TLS settings
    use_tls: true
    tls_skip_verify: false
    tls_cert_file: "/path/to/ldap-cert.pem"
```

**SAML SSO:**
```yaml
auth:
  saml:
    enabled: true
    entity_id: "https://notesage.example.com"
    acs_url: "https://notesage.example.com/auth/saml/acs"
    sls_url: "https://notesage.example.com/auth/saml/sls"
    
    # Identity Provider
    idp_metadata_url: "https://idp.example.com/metadata"
    idp_cert_file: "/path/to/idp-cert.pem"
    
    # Attribute mapping
    attribute_mapping:
      username: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
      email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
      first_name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
      last_name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
```

**OAuth2/OpenID Connect:**
```yaml
auth:
  oauth2:
    enabled: true
    providers:
      google:
        client_id: "your-google-client-id"
        client_secret: "your-google-client-secret"
        scopes: ["openid", "email", "profile"]
      
      github:
        client_id: "your-github-client-id"
        client_secret: "your-github-client-secret"
        scopes: ["user:email"]
      
      microsoft:
        client_id: "your-microsoft-client-id"
        client_secret: "your-microsoft-client-secret"
        tenant_id: "your-tenant-id"
        scopes: ["openid", "email", "profile"]
```

## Feature Configuration

### Core Features

```yaml
features:
  # Basic features
  notes_enabled: true              # Enable notes functionality
  people_enabled: true             # Enable people management
  todos_enabled: true              # Enable todo management
  graph_enabled: true              # Enable knowledge graph
  
  # Advanced features
  ai_enabled: true                 # Enable AI features
  collaboration_enabled: true     # Enable real-time collaboration
  version_history_enabled: true   # Enable version history
  search_enabled: true             # Enable full-text search
  
  # File handling
  file_uploads_enabled: true       # Enable file uploads
  max_upload_size: "10MB"          # Maximum file size
  allowed_file_types:              # Allowed file extensions
    - "pdf"
    - "doc"
    - "docx"
    - "txt"
    - "md"
    - "png"
    - "jpg"
    - "jpeg"
    - "gif"
  
  # Content limits
  max_note_size: "1MB"             # Maximum note size
  max_notes_per_user: 10000        # Maximum notes per user
  max_people_per_user: 1000        # Maximum people per user
  max_todos_per_note: 100          # Maximum todos per note
```

### WebSocket Configuration

```yaml
features:
  websocket:
    enabled: true
    path: "/ws"                    # WebSocket endpoint path
    
    # Connection limits
    max_connections: 1000          # Maximum concurrent connections
    max_connections_per_user: 10   # Maximum connections per user
    
    # Message limits
    max_message_size: "1MB"        # Maximum message size
    message_rate_limit: 100        # Messages per minute per connection
    
    # Timeouts
    ping_interval: "30s"           # Ping interval
    pong_timeout: "10s"            # Pong timeout
    write_timeout: "10s"           # Write timeout
    read_timeout: "60s"            # Read timeout
    
    # Buffer sizes
    read_buffer_size: 4096         # Read buffer size
    write_buffer_size: 4096        # Write buffer size
```

## AI Configuration

### AI Provider Settings

```yaml
ai:
  # Global AI settings
  enabled: true
  default_provider: "openai"       # Default AI provider
  request_timeout: "30s"           # AI request timeout
  max_retries: 3                   # Maximum retry attempts
  retry_delay: "1s"                # Delay between retries
  
  # Rate limiting
  rate_limit:
    requests_per_minute: 60        # Requests per minute
    requests_per_hour: 1000        # Requests per hour
    requests_per_day: 10000        # Requests per day
  
  providers:
    openai:
      enabled: true
      api_key: "your-openai-api-key"
      base_url: "https://api.openai.com/v1"  # Custom endpoint if needed
      
      # Model configuration
      models:
        default: "gpt-3.5-turbo"
        todo_extraction: "gpt-3.5-turbo"
        people_analysis: "gpt-4"
        insights: "gpt-4"
      
      # Request settings
      max_tokens: 1000
      temperature: 0.7
      top_p: 1.0
      frequency_penalty: 0.0
      presence_penalty: 0.0
    
    gemini:
      enabled: false
      api_key: "your-gemini-api-key"
      base_url: "https://generativelanguage.googleapis.com/v1"
      
      models:
        default: "gemini-pro"
        multimodal: "gemini-pro-vision"
      
      max_tokens: 1000
      temperature: 0.7
    
    grok:
      enabled: false
      api_key: "your-grok-api-key"
      base_url: "https://api.x.ai/v1"
      
      models:
        default: "grok-beta"
      
      max_tokens: 1000
      temperature: 0.7
```

### AI Feature Configuration

```yaml
ai:
  features:
    todo_extraction:
      enabled: true
      auto_extract: true             # Automatically extract todos
      confidence_threshold: 0.8      # Minimum confidence score
      max_todos_per_note: 50         # Maximum todos to extract
    
    people_analysis:
      enabled: true
      auto_analyze: false            # Manual analysis only
      relationship_detection: true   # Detect relationships
      sentiment_analysis: false      # Analyze sentiment
    
    content_insights:
      enabled: true
      schedule: "0 1 * * *"          # Daily at 1 AM
      min_notes_for_insights: 10     # Minimum notes required
      insight_types:
        - "patterns"
        - "connections"
        - "gaps"
        - "trends"
    
    smart_suggestions:
      enabled: true
      suggestion_types:
        - "references"
        - "people"
        - "tags"
        - "categories"
      max_suggestions: 5             # Maximum suggestions per request
```

## Security Configuration

### CORS and Security Headers

```yaml
security:
  # CORS configuration
  cors:
    enabled: true
    allowed_origins:
      - "https://notesage.example.com"
      - "https://app.notesage.example.com"
    allowed_methods:
      - "GET"
      - "POST"
      - "PUT"
      - "DELETE"
      - "OPTIONS"
    allowed_headers:
      - "Authorization"
      - "Content-Type"
      - "X-Requested-With"
    exposed_headers:
      - "X-Total-Count"
    allow_credentials: true
    max_age: 86400                   # Preflight cache duration
  
  # Security headers
  headers:
    content_security_policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    x_frame_options: "DENY"
    x_content_type_options: "nosniff"
    x_xss_protection: "1; mode=block"
    referrer_policy: "strict-origin-when-cross-origin"
    permissions_policy: "geolocation=(), microphone=(), camera=()"
```

### Rate Limiting

```yaml
security:
  rate_limiting:
    enabled: true
    
    # Global rate limits
    global:
      requests_per_minute: 1000
      requests_per_hour: 10000
      burst: 100
    
    # Per-user rate limits
    per_user:
      requests_per_minute: 60
      requests_per_hour: 1000
      burst: 10
    
    # Per-IP rate limits
    per_ip:
      requests_per_minute: 100
      requests_per_hour: 2000
      burst: 20
    
    # Endpoint-specific limits
    endpoints:
      "/api/auth/login":
        requests_per_minute: 5
        burst: 2
      "/api/ai/*":
        requests_per_minute: 10
        burst: 3
    
    # Rate limit storage
    storage: "memory"              # memory, redis
    redis_url: "redis://localhost:6379/0"
```

### Content Security

```yaml
security:
  content:
    # Input validation
    max_input_length: 1000000      # Maximum input length
    sanitize_html: true            # Sanitize HTML content
    allowed_html_tags:             # Allowed HTML tags
      - "p"
      - "br"
      - "strong"
      - "em"
      - "ul"
      - "ol"
      - "li"
      - "h1"
      - "h2"
      - "h3"
      - "h4"
      - "h5"
      - "h6"
    
    # File upload security
    scan_uploads: true             # Scan uploaded files
    quarantine_suspicious: true    # Quarantine suspicious files
    max_scan_size: "50MB"          # Maximum file size to scan
    
    # Content filtering
    profanity_filter: false        # Filter profanity
    spam_detection: true           # Detect spam content
    malware_scanning: true         # Scan for malware
```

## Logging Configuration

### Log Levels and Formats

```yaml
logging:
  # Basic settings
  level: "info"                    # debug, info, warn, error, fatal
  format: "json"                   # json, text, structured
  
  # Output destinations
  outputs:
    - type: "file"
      file: "/var/log/notesage/server.log"
      max_size: 100                # MB
      max_backups: 5               # Number of backup files
      max_age: 30                  # Days to keep logs
      compress: true               # Compress old logs
    
    - type: "syslog"
      network: "udp"
      address: "localhost:514"
      facility: "local0"
    
    - type: "stdout"
      enabled: false               # Disable for production
  
  # Log categories
  categories:
    http: "info"                   # HTTP request logs
    database: "warn"               # Database logs
    auth: "info"                   # Authentication logs
    ai: "info"                     # AI service logs
    websocket: "warn"              # WebSocket logs
    backup: "info"                 # Backup logs
```

### Audit Logging

```yaml
logging:
  audit:
    enabled: true
    file: "/var/log/notesage/audit.log"
    
    # Events to audit
    events:
      - "user_login"
      - "user_logout"
      - "user_created"
      - "user_deleted"
      - "note_created"
      - "note_updated"
      - "note_deleted"
      - "config_changed"
      - "backup_created"
      - "backup_restored"
    
    # Audit log format
    format: "json"
    include_request_body: false    # Include request body in logs
    include_response_body: false   # Include response body in logs
    
    # Retention
    max_size: 500                  # MB
    max_backups: 10
    max_age: 365                   # Days
    compress: true
```

## Monitoring Configuration

### Health Checks

```yaml
monitoring:
  health:
    enabled: true
    endpoint: "/health"            # Health check endpoint
    
    # Health check components
    checks:
      database: true               # Check database connectivity
      redis: false                 # Check Redis connectivity
      disk_space: true             # Check disk space
      memory: true                 # Check memory usage
      
    # Thresholds
    thresholds:
      disk_space_warning: 80       # Warn at 80% disk usage
      disk_space_critical: 95      # Critical at 95% disk usage
      memory_warning: 80           # Warn at 80% memory usage
      memory_critical: 95          # Critical at 95% memory usage
    
    # Response format
    detailed_response: true        # Include detailed health info
    include_version: true          # Include version in response
```

### Metrics and Monitoring

```yaml
monitoring:
  metrics:
    enabled: true
    endpoint: "/metrics"           # Prometheus metrics endpoint
    
    # Metric collection
    collect_runtime_metrics: true  # Go runtime metrics
    collect_http_metrics: true     # HTTP request metrics
    collect_database_metrics: true # Database metrics
    collect_custom_metrics: true   # Application-specific metrics
    
    # Metric labels
    labels:
      service: "notesage"
      environment: "production"
      version: "1.0.0"
    
    # Histogram buckets
    http_duration_buckets:
      - 0.005
      - 0.01
      - 0.025
      - 0.05
      - 0.1
      - 0.25
      - 0.5
      - 1
      - 2.5
      - 5
      - 10
```

### External Monitoring Integration

```yaml
monitoring:
  external:
    # Prometheus
    prometheus:
      enabled: true
      push_gateway: "http://prometheus-pushgateway:9091"
      job_name: "notesage"
      push_interval: "15s"
    
    # Grafana
    grafana:
      enabled: false
      url: "http://grafana:3000"
      api_key: "your-grafana-api-key"
      dashboard_id: "notesage-dashboard"
    
    # New Relic
    newrelic:
      enabled: false
      license_key: "your-newrelic-license-key"
      app_name: "NoteSage"
    
    # DataDog
    datadog:
      enabled: false
      api_key: "your-datadog-api-key"
      service_name: "notesage"
      environment: "production"
```

## Performance Configuration

### Caching

```yaml
performance:
  cache:
    # Memory cache
    memory:
      enabled: true
      max_size: "256MB"            # Maximum cache size
      ttl: "1h"                    # Default TTL
      cleanup_interval: "10m"      # Cleanup interval
    
    # Redis cache
    redis:
      enabled: false
      url: "redis://localhost:6379/0"
      password: ""
      max_retries: 3
      retry_delay: "100ms"
      
      # Connection pool
      pool_size: 10
      min_idle_conns: 5
      max_conn_age: "30m"
      pool_timeout: "4s"
      idle_timeout: "5m"
      idle_check_frequency: "1m"
    
    # Cache policies
    policies:
      notes: "1h"                  # Cache notes for 1 hour
      people: "30m"                # Cache people for 30 minutes
      search_results: "5m"         # Cache search results for 5 minutes
      ai_responses: "24h"          # Cache AI responses for 24 hours
```

### Database Optimization

```yaml
performance:
  database:
    # Query optimization
    query_cache_size: 1000         # Number of queries to cache
    prepared_statement_cache: true # Use prepared statements
    
    # Connection optimization
    connection_lifetime: "1h"      # Maximum connection lifetime
    connection_idle_timeout: "10m" # Idle connection timeout
    
    # Batch operations
    batch_size: 100                # Default batch size
    max_batch_size: 1000           # Maximum batch size
    
    # Indexing
    auto_create_indexes: true      # Automatically create indexes
    index_maintenance_schedule: "0 3 * * 0"  # Weekly index maintenance
```

## Environment-Specific Configuration

### Development Environment

```yaml
# config-development.yaml
server:
  host: "127.0.0.1"
  port: 8080

database:
  type: "sqlite"
  file: "/tmp/notesage-dev.db"

logging:
  level: "debug"
  format: "text"
  outputs:
    - type: "stdout"
      enabled: true

features:
  ai_enabled: false              # Disable AI in development

security:
  cors:
    allowed_origins: ["*"]       # Allow all origins in development
```

### Production Environment

```yaml
# config-production.yaml
server:
  host: "0.0.0.0"
  port: 8443
  tls:
    enabled: true
    auto_cert: true

database:
  type: "postgres"
  ssl_mode: "require"

logging:
  level: "info"
  format: "json"

security:
  rate_limiting:
    enabled: true
  headers:
    content_security_policy: "default-src 'self'"

monitoring:
  metrics:
    enabled: true
  health:
    enabled: true
```

## Configuration Management

### Environment Variables

Override configuration values using environment variables:

```bash
# Server settings
export NOTESAGE_SERVER_HOST="0.0.0.0"
export NOTESAGE_SERVER_PORT="8080"

# Database settings
export NOTESAGE_DATABASE_TYPE="postgres"
export NOTESAGE_DATABASE_HOST="localhost"
export NOTESAGE_DATABASE_PASSWORD="secure_password"

# Authentication
export NOTESAGE_AUTH_JWT_SECRET="your-jwt-secret"

# AI configuration
export NOTESAGE_AI_OPENAI_API_KEY="your-openai-key"
```

### Configuration Validation

```bash
# Validate configuration file
sudo -u notesage /opt/notesage/notesage-server \
  --config /etc/notesage/config.yaml \
  --validate

# Test database connection
sudo -u notesage /opt/notesage/notesage-server \
  --config /etc/notesage/config.yaml \
  --test-db

# Check configuration syntax
yamllint /etc/notesage/config.yaml
```

### Configuration Backup and Versioning

```bash
# Backup configuration before changes
sudo cp /etc/notesage/config.yaml /etc/notesage/config.yaml.backup.$(date +%Y%m%d_%H%M%S)

# Version control configuration
cd /etc/notesage
sudo git init
sudo git add config.yaml
sudo git commit -m "Initial configuration"

# Track changes
sudo git add config.yaml
sudo git commit -m "Updated AI configuration"
```

## Troubleshooting Configuration

### Common Configuration Issues

**Invalid YAML syntax:**
```bash
# Check YAML syntax
yamllint /etc/notesage/config.yaml

# Common issues:
# - Incorrect indentation
# - Missing quotes around special characters
# - Invalid boolean values (use true/false, not yes/no)
```

**Database connection issues:**
```bash
# Test database connectivity
sudo -u notesage /opt/notesage/notesage-server --test-db

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

**Permission issues:**
```bash
# Fix configuration file permissions
sudo chown root:notesage /etc/notesage/config.yaml
sudo chmod 640 /etc/notesage/config.yaml

# Verify notesage user can read configuration
sudo -u notesage cat /etc/notesage/config.yaml
```

### Configuration Debugging

```bash
# Enable debug logging temporarily
sudo sed -i 's/level: "info"/level: "debug"/' /etc/notesage/config.yaml
sudo systemctl reload notesage

# View debug logs
sudo journalctl -u notesage -f

# Restore original log level
sudo sed -i 's/level: "debug"/level: "info"/' /etc/notesage/config.yaml
sudo systemctl reload notesage
```

## Best Practices

### Security Best Practices

1. **Use strong passwords and secrets**
2. **Enable TLS/SSL in production**
3. **Restrict CORS origins**
4. **Enable rate limiting**
5. **Regular security updates**
6. **Monitor audit logs**
7. **Use least privilege principles**

### Performance Best Practices

1. **Enable caching for frequently accessed data**
2. **Optimize database connections**
3. **Use appropriate log levels**
4. **Monitor resource usage**
5. **Regular database maintenance**
6. **Implement proper indexing**

### Operational Best Practices

1. **Version control configuration files**
2. **Test configuration changes in staging**
3. **Backup configuration before changes**
4. **Document custom configurations**
5. **Monitor configuration drift**
6. **Automate configuration deployment**

---

*For more information, see the [Installation Guide](installation.md) and [User Management Guide](user-management.md)*
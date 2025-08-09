# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with NoteSage desktop application and server.

## Quick Diagnostics

### System Health Check
1. **Check Application Status**
   - Is NoteSage running and responsive?
   - Check system resources (CPU, memory, disk space)
   - Verify network connectivity

2. **Server Connection Test**
   - Can you reach the server URL in a web browser?
   - Is the server running and accepting connections?
   - Check firewall and network settings

3. **Data Integrity Check**
   - Are your notes and data visible?
   - Check sync status and last successful sync time
   - Verify local cache is functioning

## Installation Issues

### Desktop Application Won't Install

**Ubuntu Linux (.deb package)**
```bash
# Check package integrity
dpkg -I notesage-desktop_*.deb

# Install with dependency resolution
sudo apt install -f ./notesage-desktop_*.deb

# Check for conflicting packages
sudo apt list --installed | grep notesage

# Manual cleanup if needed
sudo dpkg --remove notesage-desktop
sudo apt autoremove
```

**macOS (.dmg installer)**
- **Security Warning**: Go to System Preferences → Security & Privacy → Allow apps downloaded from App Store and identified developers
- **Quarantine Issues**: Run `xattr -d com.apple.quarantine /Applications/NoteSage.app`
- **Permission Problems**: Check that you have admin privileges
- **Disk Space**: Ensure sufficient disk space (minimum 500MB)

### Application Won't Start

**Check System Requirements**
- **Ubuntu**: 20.04 LTS or later
- **macOS**: 10.15 (Catalina) or later
- **RAM**: Minimum 4GB, recommended 8GB
- **Disk Space**: At least 1GB free space

**Common Solutions**
```bash
# Ubuntu: Check application logs
journalctl --user -u notesage-desktop

# macOS: Check Console app for crash logs
# Look for NoteSage entries in Console.app

# Reset application data (last resort)
rm -rf ~/.config/notesage  # Ubuntu
rm -rf ~/Library/Application\ Support/NoteSage  # macOS
```

## Connection Issues

### Cannot Connect to Server

**Server Unreachable**
1. **Verify Server URL**: Ensure correct protocol (http/https) and port
2. **Network Test**: Try accessing server URL in web browser
3. **Firewall Check**: Ensure port 8080 (or configured port) is open
4. **DNS Resolution**: Try using IP address instead of domain name

**Authentication Failures**
- **Verify Credentials**: Double-check username and password
- **Account Status**: Ensure account is active and not locked
- **Server Logs**: Check server logs for authentication errors
- **Time Sync**: Ensure client and server clocks are synchronized

**Connection Timeouts**
```bash
# Test network connectivity
ping your-server.com
telnet your-server.com 8080

# Check for proxy issues
curl -v http://your-server.com:8080/health

# Test WebSocket connectivity
wscat -c ws://your-server.com:8080/ws
```

### Sync Problems

**Sync Not Working**
1. **Check Connection Status**: Look for connection indicator in status bar
2. **Manual Sync**: Try triggering manual sync
3. **Clear Cache**: Clear local cache and re-sync
4. **Server Status**: Verify server is running and accessible

**Sync Conflicts**
- **Review Conflicts**: Use conflict resolution interface
- **Backup Data**: Export local data before resolving conflicts
- **Choose Resolution Strategy**: Keep local, keep remote, or merge
- **Prevent Future Conflicts**: Coordinate editing with team members

**Slow Sync Performance**
- **Network Speed**: Check internet connection speed
- **Server Load**: Verify server isn't overloaded
- **Data Size**: Large attachments can slow sync
- **Incremental Sync**: Ensure incremental sync is working properly

## Performance Issues

### Application Running Slowly

**Memory Issues**
```bash
# Check memory usage
# Ubuntu
ps aux | grep notesage
free -h

# macOS
top -pid $(pgrep NoteSage)
vm_stat
```

**Solutions for Memory Problems**
- **Restart Application**: Close and reopen NoteSage
- **Reduce Cache Size**: Lower cache limits in settings
- **Close Other Applications**: Free up system memory
- **Upgrade Hardware**: Consider more RAM if consistently low

**Disk Space Issues**
```bash
# Check disk usage
df -h
du -sh ~/.config/notesage  # Ubuntu
du -sh ~/Library/Application\ Support/NoteSage  # macOS

# Clean up cache
rm -rf ~/.config/notesage/cache
rm -rf ~/Library/Application\ Support/NoteSage/cache
```

### Search Performance

**Slow Search Results**
- **Rebuild Search Index**: Go to Settings → Advanced → Rebuild Index
- **Reduce Search Scope**: Use filters to narrow search
- **Check Index Status**: Verify search index is complete
- **Hardware Upgrade**: Consider SSD for better I/O performance

**Search Not Finding Results**
- **Index Corruption**: Rebuild search index
- **Sync Issues**: Ensure all content is synced
- **Filter Problems**: Check if filters are too restrictive
- **Content Issues**: Verify content exists and is properly formatted

## Data Issues

### Missing Notes or Data

**Data Recovery Steps**
1. **Check Sync Status**: Ensure sync is complete
2. **Search Thoroughly**: Use advanced search to locate content
3. **Check Archive**: Look in archived or deleted items
4. **Version History**: Check if content was accidentally deleted
5. **Backup Restore**: Restore from recent backup if available

**Backup and Recovery**
```bash
# Create manual backup
# Export all data through File → Export → All Data

# Locate automatic backups
# Ubuntu: ~/.config/notesage/backups/
# macOS: ~/Library/Application Support/NoteSage/backups/

# Restore from backup
# Import through File → Import → Restore Backup
```

### Data Corruption

**Symptoms of Corruption**
- Notes displaying incorrectly
- Application crashes when opening specific notes
- Sync errors or conflicts
- Search index problems

**Recovery Procedures**
1. **Stop Using Application**: Prevent further corruption
2. **Backup Current State**: Export what you can
3. **Check Server Data**: Verify server has clean copy
4. **Restore from Backup**: Use most recent clean backup
5. **Rebuild Indexes**: Rebuild search and sync indexes

## Server Issues

### Server Won't Start

**Check Server Status**
```bash
# Ubuntu systemd service
sudo systemctl status notesage
sudo journalctl -u notesage -f

# Manual server start for debugging
sudo -u notesage /opt/notesage/notesage-server --config /etc/notesage/config.yaml --debug
```

**Common Server Problems**
- **Port Already in Use**: Another service using port 8080
- **Database Connection**: PostgreSQL not running or misconfigured
- **Permission Issues**: Server user lacks necessary permissions
- **Configuration Errors**: Invalid settings in config.yaml

**Database Issues**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
sudo -u postgres psql -d notesage -c "SELECT version();"

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Server Performance Problems

**High CPU Usage**
- **Check Active Connections**: Monitor concurrent users
- **Database Queries**: Look for slow or inefficient queries
- **Log Analysis**: Check server logs for errors or warnings
- **Resource Monitoring**: Use htop or similar tools

**Memory Leaks**
```bash
# Monitor server memory usage
watch -n 5 'ps aux | grep notesage-server'

# Check for memory leaks
valgrind --tool=memcheck /opt/notesage/notesage-server

# Restart server if memory usage is excessive
sudo systemctl restart notesage
```

## AI Feature Issues

### AI Features Not Working

**Configuration Problems**
- **API Key**: Verify API key is correct and has sufficient credits
- **Provider Status**: Check if AI provider service is operational
- **Network Access**: Ensure server can reach AI provider APIs
- **Feature Enabled**: Verify AI features are enabled in settings

**API Errors**
```bash
# Test API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.openai.com/v1/models

# Check server logs for AI errors
sudo journalctl -u notesage | grep -i "ai\|openai\|gemini"
```

**Performance Issues**
- **Rate Limits**: Check if hitting API rate limits
- **Timeout Settings**: Increase timeout for AI requests
- **Batch Processing**: Use batch operations for efficiency
- **Local Alternatives**: Consider local AI models for privacy

## Network and Firewall Issues

### Firewall Configuration

**Ubuntu UFW Configuration**
```bash
# Allow NoteSage server port
sudo ufw allow 8080/tcp

# Allow from specific IP range (more secure)
sudo ufw allow from 192.168.1.0/24 to any port 8080

# Check firewall status
sudo ufw status verbose
```

**Advanced Network Troubleshooting**
```bash
# Check listening ports
sudo netstat -tlnp | grep :8080

# Monitor network connections
sudo ss -tulpn | grep notesage

# Test connectivity from client
nc -zv your-server.com 8080
```

### Proxy and Corporate Networks

**Proxy Configuration**
- **HTTP Proxy**: Configure proxy settings in application
- **HTTPS Proxy**: Ensure HTTPS proxy supports WebSocket
- **Authentication**: Provide proxy credentials if required
- **Bypass Rules**: Add server to proxy bypass list

**Corporate Firewall Issues**
- **WebSocket Support**: Ensure firewall allows WebSocket connections
- **Port Restrictions**: Use standard ports (80, 443) if possible
- **SSL/TLS**: Configure proper SSL certificates
- **Content Filtering**: Ensure AI API calls aren't blocked

## Error Messages

### Common Error Messages

**"Connection refused"**
- Server is not running
- Wrong port or IP address
- Firewall blocking connection
- Network connectivity issues

**"Authentication failed"**
- Incorrect username or password
- Account locked or disabled
- Server authentication service down
- Time synchronization issues

**"Sync conflict detected"**
- Multiple users edited same content
- Network interruption during sync
- Clock synchronization problems
- Concurrent editing without coordination

**"Database connection failed"**
- PostgreSQL service not running
- Database credentials incorrect
- Database server unreachable
- Connection pool exhausted

### Error Code Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| CONN_001 | Server unreachable | Check network and server status |
| AUTH_002 | Invalid credentials | Verify username and password |
| SYNC_003 | Sync conflict | Use conflict resolution interface |
| DB_004 | Database error | Check database connectivity |
| AI_005 | AI service unavailable | Check API key and service status |
| CACHE_006 | Cache corruption | Clear and rebuild cache |
| INDEX_007 | Search index error | Rebuild search index |
| FILE_008 | File system error | Check disk space and permissions |

## Getting Help

### Before Contacting Support

1. **Check This Guide**: Review relevant troubleshooting sections
2. **Search FAQ**: Look for answers in the FAQ document
3. **Check Logs**: Gather relevant log files and error messages
4. **Test Isolation**: Try to reproduce the issue consistently
5. **Gather Information**: Collect system information and version details

### Information to Include

**System Information**
- Operating system and version
- NoteSage version (desktop and server)
- Hardware specifications (RAM, CPU, disk space)
- Network configuration

**Error Details**
- Exact error messages
- Steps to reproduce the issue
- When the problem started
- What changed recently

**Log Files**
```bash
# Desktop application logs
# Ubuntu: ~/.config/notesage/logs/
# macOS: ~/Library/Logs/NoteSage/

# Server logs
sudo journalctl -u notesage --since "1 hour ago" > notesage-server.log
```

### Support Channels

- **Documentation**: Check online documentation for updates
- **Community Forum**: Search and post in community discussions
- **GitHub Issues**: Report bugs and feature requests
- **Email Support**: Contact support@notesage.com for direct help
- **Enterprise Support**: Dedicated support for enterprise customers

### Emergency Procedures

**Data Loss Prevention**
1. **Stop Using Application**: Prevent further data loss
2. **Backup Immediately**: Export all accessible data
3. **Document Issue**: Record exactly what happened
4. **Contact Support**: Reach out immediately for critical issues
5. **Preserve Evidence**: Keep logs and error messages

**Service Restoration**
1. **Assess Damage**: Determine scope of the problem
2. **Restore from Backup**: Use most recent clean backup
3. **Verify Integrity**: Check restored data for completeness
4. **Resume Operations**: Gradually return to normal usage
5. **Post-Incident Review**: Analyze what went wrong and prevent recurrence

---

*For additional help, see the [FAQ](faq.md) or contact support at support@notesage.com*
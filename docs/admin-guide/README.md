# NoteSage Administrator Guide

This guide provides comprehensive information for system administrators installing, configuring, and maintaining NoteSage server installations.

## Table of Contents

1. [Installation Guide](installation.md)
2. [Configuration](configuration.md)
3. [User Management](user-management.md)
4. [Database Management](database.md)
5. [Security](security.md)
6. [Backup and Recovery](backup-recovery.md)
7. [Monitoring and Logging](monitoring.md)
8. [Upgrades and Maintenance](upgrades.md)
9. [Performance Tuning](performance.md)
10. [Troubleshooting](troubleshooting.md)

## Overview

NoteSage consists of two main components:
- **NoteSage Server**: Go-based backend service providing REST API and WebSocket support
- **Desktop Client**: Electron-based desktop application for end users

This guide focuses on server administration. The server supports:
- Multiple concurrent users
- PostgreSQL or SQLite databases
- JWT-based authentication
- Real-time collaboration via WebSockets
- AI integration with multiple providers
- Automated backup and maintenance

## System Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04 LTS or later
- **CPU**: 2 cores, 2.4 GHz
- **RAM**: 4 GB
- **Storage**: 20 GB available space
- **Network**: Internet connection for AI features (optional)

### Recommended Requirements
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4 cores, 3.0 GHz
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **Network**: Stable internet connection
- **Database**: Dedicated PostgreSQL server

### Supported Platforms
- **Primary**: Ubuntu Linux (20.04, 22.04)
- **Secondary**: Other Linux distributions (manual installation)
- **Future**: Docker containers, cloud deployments

## Quick Start

For experienced administrators who want to get started quickly:

```bash
# Download and run installer
wget https://releases.notesage.com/latest/install.sh
chmod +x install.sh
sudo ./install.sh

# Start service
sudo systemctl start notesage
sudo systemctl enable notesage

# Check status
sudo systemctl status notesage
```

Default configuration:
- **Port**: 8080
- **Database**: SQLite (development) or PostgreSQL (production)
- **Logs**: `/var/log/notesage/`
- **Config**: `/etc/notesage/config.yaml`

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Desktop Client │    │  Desktop Client │    │  Desktop Client │
│   (Electron)    │    │   (Electron)    │    │   (Electron)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │    NoteSage Server        │
                    │      (Go Binary)          │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │    REST API         │  │
                    │  │    WebSocket        │  │
                    │  │    Authentication   │  │
                    │  └─────────────────────┘  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │    Database               │
                    │  (PostgreSQL/SQLite)      │
                    └───────────────────────────┘
```

## Security Considerations

- **Authentication**: JWT tokens with configurable expiration
- **Authorization**: Role-based access control
- **Network**: HTTPS/TLS encryption recommended
- **Database**: Encrypted connections and secure credentials
- **File System**: Proper permissions and user isolation
- **Updates**: Regular security updates and patches

## Support and Resources

- **Documentation**: Complete guides in this directory
- **Community**: GitHub discussions and issues
- **Professional Support**: Available for enterprise deployments
- **Training**: Administrator training sessions available

## Getting Help

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Review [Common Issues](troubleshooting.md#common-issues)
3. Check server logs: `sudo journalctl -u notesage -f`
4. Contact support with detailed error information

---

*NoteSage Administrator Guide v1.0*
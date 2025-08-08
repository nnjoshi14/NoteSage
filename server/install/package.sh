#!/bin/bash
# NoteSage Server Package Creation Script
# This script creates a complete installation package

set -e

# Configuration
PACKAGE_NAME="notesage-server-install"
VERSION="1.0.0"
ARCH="amd64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

# Create package directory structure
create_package_structure() {
    log "Creating package structure..."
    
    local package_dir="${PACKAGE_NAME}-${VERSION}"
    
    # Remove existing package directory
    if [[ -d "$package_dir" ]]; then
        rm -rf "$package_dir"
    fi
    
    # Create directory structure
    mkdir -p "$package_dir"/{install,docs,scripts,config,systemd}
    
    log_success "Package structure created: $package_dir"
    echo "$package_dir"
}

# Copy installation files
copy_installation_files() {
    local package_dir="$1"
    
    log "Copying installation files..."
    
    # Main installation script
    cp install.sh "$package_dir/install/"
    
    # Management scripts
    cp backup.sh "$package_dir/scripts/"
    cp restore.sh "$package_dir/scripts/"
    cp upgrade.sh "$package_dir/scripts/"
    cp health-check.sh "$package_dir/scripts/"
    cp package.sh "$package_dir/scripts/"
    
    # Configuration files
    cp config.yaml "$package_dir/config/"
    cp notesage.logrotate "$package_dir/config/"
    
    # Systemd files
    cp notesage.service "$package_dir/systemd/"
    cp notesage-backup.service "$package_dir/systemd/"
    cp notesage-backup.timer "$package_dir/systemd/"
    
    # Documentation
    cp README.md "$package_dir/docs/"
    cp Makefile "$package_dir/"
    
    # Make scripts executable
    chmod +x "$package_dir"/install/*.sh
    chmod +x "$package_dir"/scripts/*.sh
    
    log_success "Installation files copied"
}

# Create package metadata
create_package_metadata() {
    local package_dir="$1"
    
    log "Creating package metadata..."
    
    # Create package info file
    cat > "$package_dir/PACKAGE_INFO" << EOF
Package: NoteSage Server
Version: $VERSION
Architecture: $ARCH
Maintainer: NoteSage Team
Description: NoteSage Knowledge Management Server
 NoteSage is a comprehensive knowledge management system that allows users
 to create, organize, and connect their notes, todos, and people in an
 intelligent way with AI-powered insights and real-time collaboration.
Homepage: https://github.com/notesage/server
License: MIT
EOF

    # Create installation manifest
    cat > "$package_dir/MANIFEST" << EOF
# NoteSage Server Installation Manifest
# This file lists all components included in the installation package

## Installation Scripts
install/install.sh                 # Main installation script

## Management Scripts  
scripts/backup.sh                  # Backup creation script
scripts/restore.sh                 # Backup restoration script
scripts/upgrade.sh                 # Server upgrade script
scripts/health-check.sh            # Health monitoring script
scripts/package.sh                 # Package creation script

## Configuration Files
config/config.yaml                 # Main server configuration
config/notesage.logrotate          # Log rotation configuration

## Systemd Service Files
systemd/notesage.service           # Main service definition
systemd/notesage-backup.service    # Backup service definition
systemd/notesage-backup.timer      # Backup timer definition

## Documentation
docs/README.md                     # Installation and usage guide
Makefile                          # Build and management commands

## Metadata
PACKAGE_INFO                       # Package information
MANIFEST                          # This file
INSTALL_GUIDE                     # Quick installation guide
EOF

    # Create quick installation guide
    cat > "$package_dir/INSTALL_GUIDE" << EOF
NoteSage Server Quick Installation Guide
========================================

1. Extract the package:
   tar -xzf notesage-server-install-${VERSION}.tar.gz
   cd ${PACKAGE_NAME}-${VERSION}

2. Run the installation:
   sudo ./install/install.sh

3. Check service status:
   sudo systemctl status notesage

4. Access the server:
   http://your-server-ip:8080

For detailed instructions, see docs/README.md

System Requirements:
- Ubuntu 20.04 LTS or later
- 2GB RAM minimum
- 10GB disk space
- Internet connection

Support:
- Documentation: https://github.com/notesage/server/docs
- Issues: https://github.com/notesage/server/issues
EOF

    log_success "Package metadata created"
}

# Create checksums
create_checksums() {
    local package_dir="$1"
    
    log "Creating checksums..."
    
    # Create SHA256 checksums for all files
    find "$package_dir" -type f -exec sha256sum {} \; | \
        sed "s|$package_dir/||" > "$package_dir/SHA256SUMS"
    
    log_success "Checksums created"
}

# Create compressed package
create_compressed_package() {
    local package_dir="$1"
    local package_file="${package_dir}.tar.gz"
    
    log "Creating compressed package..."
    
    # Remove existing package file
    if [[ -f "$package_file" ]]; then
        rm -f "$package_file"
    fi
    
    # Create tar.gz package
    tar -czf "$package_file" "$package_dir"
    
    # Create package checksum
    sha256sum "$package_file" > "${package_file}.sha256"
    
    local package_size=$(du -h "$package_file" | cut -f1)
    
    log_success "Package created: $package_file ($package_size)"
    
    echo "$package_file"
}

# Verify package integrity
verify_package() {
    local package_file="$1"
    
    log "Verifying package integrity..."
    
    # Test tar file
    if tar -tzf "$package_file" >/dev/null 2>&1; then
        log_success "Package archive is valid"
    else
        log_error "Package archive is corrupted"
        return 1
    fi
    
    # Verify checksum
    if [[ -f "${package_file}.sha256" ]]; then
        if sha256sum -c "${package_file}.sha256" >/dev/null 2>&1; then
            log_success "Package checksum verified"
        else
            log_error "Package checksum verification failed"
            return 1
        fi
    fi
    
    return 0
}

# Generate package report
generate_report() {
    local package_file="$1"
    local package_dir="$2"
    
    log "Generating package report..."
    
    local report_file="${package_file%.tar.gz}_report.txt"
    
    cat > "$report_file" << EOF
NoteSage Server Installation Package Report
==========================================

Package Information:
  Name: $PACKAGE_NAME
  Version: $VERSION
  Architecture: $ARCH
  File: $package_file
  Size: $(du -h "$package_file" | cut -f1)
  Created: $(date)
  SHA256: $(sha256sum "$package_file" | cut -d' ' -f1)

Package Contents:
$(tar -tzf "$package_file" | sort)

File Count: $(tar -tzf "$package_file" | wc -l)

Installation Instructions:
1. Extract: tar -xzf $package_file
2. Install: cd ${package_dir} && sudo ./install/install.sh
3. Verify: sudo systemctl status notesage

System Requirements:
- Ubuntu 20.04 LTS or later
- 2GB RAM minimum
- 10GB disk space
- PostgreSQL (installed automatically)

Support:
- Documentation: https://github.com/notesage/server/docs
- Issues: https://github.com/notesage/server/issues
- Community: https://github.com/notesage/server/discussions
EOF

    log_success "Package report created: $report_file"
}

# Main packaging function
main() {
    log "Starting NoteSage server package creation..."
    
    # Check if we're in the right directory
    if [[ ! -f "install.sh" ]]; then
        log_error "install.sh not found. Please run this script from the install directory."
        exit 1
    fi
    
    # Create package structure
    local package_dir=$(create_package_structure)
    
    # Copy files
    copy_installation_files "$package_dir"
    
    # Create metadata
    create_package_metadata "$package_dir"
    
    # Create checksums
    create_checksums "$package_dir"
    
    # Create compressed package
    local package_file=$(create_compressed_package "$package_dir")
    
    # Verify package
    if ! verify_package "$package_file"; then
        log_error "Package verification failed"
        exit 1
    fi
    
    # Generate report
    generate_report "$package_file" "$package_dir"
    
    # Cleanup temporary directory
    rm -rf "$package_dir"
    
    log_success "Package creation completed successfully!"
    echo
    echo "Package Details:"
    echo "  File: $package_file"
    echo "  Size: $(du -h "$package_file" | cut -f1)"
    echo "  SHA256: $(cat "${package_file}.sha256" | cut -d' ' -f1)"
    echo
    echo "To install:"
    echo "  tar -xzf $package_file"
    echo "  cd ${package_dir}"
    echo "  sudo ./install/install.sh"
    echo
}

# Show usage
show_usage() {
    echo "NoteSage Server Package Creation Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --version VERSION    Set package version (default: $VERSION)"
    echo "  --arch ARCH         Set architecture (default: $ARCH)"
    echo "  --help              Show this help message"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --arch)
            ARCH="$2"
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

# Run main function
main "$@"
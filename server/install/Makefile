# NoteSage Server Installation Makefile
# This Makefile provides convenient commands for installing and managing NoteSage server

.PHONY: help install uninstall start stop restart status logs health backup restore upgrade clean

# Default target
help:
	@echo "NoteSage Server Installation Commands"
	@echo "====================================="
	@echo ""
	@echo "Installation:"
	@echo "  make install          Install NoteSage server"
	@echo "  make uninstall        Remove NoteSage server"
	@echo ""
	@echo "Service Management:"
	@echo "  make start            Start NoteSage service"
	@echo "  make stop             Stop NoteSage service"
	@echo "  make restart          Restart NoteSage service"
	@echo "  make status           Show service status"
	@echo "  make logs             Show service logs"
	@echo ""
	@echo "Maintenance:"
	@echo "  make health           Run health check"
	@echo "  make backup           Create backup"
	@echo "  make restore          Restore from backup"
	@echo "  make upgrade          Upgrade to latest version"
	@echo "  make clean            Clean temporary files"
	@echo ""
	@echo "Configuration:"
	@echo "  make config           Edit configuration"
	@echo "  make validate         Validate configuration"
	@echo ""

# Installation
install:
	@echo "Installing NoteSage server..."
	@if [ ! -f "./install.sh" ]; then \
		echo "Error: install.sh not found in current directory"; \
		exit 1; \
	fi
	@chmod +x ./install.sh
	@sudo ./install.sh

# Uninstallation
uninstall:
	@echo "Uninstalling NoteSage server..."
	@if [ -f "/etc/systemd/system/notesage.service" ]; then \
		sudo systemctl stop notesage || true; \
		sudo systemctl disable notesage || true; \
		sudo rm -f /etc/systemd/system/notesage.service; \
		sudo systemctl daemon-reload; \
	fi
	@if [ -d "/opt/notesage" ]; then \
		sudo rm -rf /opt/notesage; \
	fi
	@if [ -d "/etc/notesage" ]; then \
		sudo rm -rf /etc/notesage; \
	fi
	@if [ -d "/var/log/notesage" ]; then \
		sudo rm -rf /var/log/notesage; \
	fi
	@if id notesage >/dev/null 2>&1; then \
		sudo userdel notesage; \
	fi
	@echo "NoteSage server uninstalled"

# Service management
start:
	@echo "Starting NoteSage service..."
	@sudo systemctl start notesage
	@sudo systemctl status notesage --no-pager

stop:
	@echo "Stopping NoteSage service..."
	@sudo systemctl stop notesage
	@sudo systemctl status notesage --no-pager

restart:
	@echo "Restarting NoteSage service..."
	@sudo systemctl restart notesage
	@sudo systemctl status notesage --no-pager

status:
	@sudo systemctl status notesage --no-pager
	@echo ""
	@echo "Service Details:"
	@echo "  Active: $$(sudo systemctl is-active notesage)"
	@echo "  Enabled: $$(sudo systemctl is-enabled notesage)"
	@if sudo systemctl is-active --quiet notesage; then \
		echo "  Health: $$(curl -s -f http://localhost:8080/health >/dev/null && echo "OK" || echo "FAILED")"; \
	fi

logs:
	@echo "NoteSage service logs (press Ctrl+C to exit):"
	@sudo journalctl -u notesage -f

# Maintenance
health:
	@if [ -x "/opt/notesage/health-check.sh" ]; then \
		sudo /opt/notesage/health-check.sh; \
	else \
		echo "Health check script not found"; \
		exit 1; \
	fi

backup:
	@if [ -x "./backup.sh" ]; then \
		sudo ./backup.sh create; \
	else \
		echo "Backup script not found"; \
		exit 1; \
	fi

restore:
	@if [ -x "./restore.sh" ]; then \
		sudo ./restore.sh list; \
		echo ""; \
		echo "To restore, run: make restore-interactive"; \
	else \
		echo "Restore script not found"; \
		exit 1; \
	fi

restore-interactive:
	@if [ -x "./restore.sh" ]; then \
		sudo ./restore.sh restore; \
	else \
		echo "Restore script not found"; \
		exit 1; \
	fi

upgrade:
	@if [ -x "./upgrade.sh" ]; then \
		sudo ./upgrade.sh upgrade; \
	else \
		echo "Upgrade script not found"; \
		exit 1; \
	fi

upgrade-check:
	@if [ -x "./upgrade.sh" ]; then \
		sudo ./upgrade.sh check; \
	else \
		echo "Upgrade script not found"; \
		exit 1; \
	fi

# Configuration
config:
	@if [ -f "/etc/notesage/config.yaml" ]; then \
		sudo nano /etc/notesage/config.yaml; \
		echo "Configuration updated. Restart service with: make restart"; \
	else \
		echo "Configuration file not found"; \
		exit 1; \
	fi

validate:
	@if [ -x "/opt/notesage/notesage-server" ]; then \
		sudo -u notesage /opt/notesage/notesage-server --config /etc/notesage/config.yaml --validate; \
	else \
		echo "NoteSage server binary not found"; \
		exit 1; \
	fi

# Cleanup
clean:
	@echo "Cleaning temporary files..."
	@sudo rm -rf /tmp/notesage-*
	@if [ -f "/opt/notesage/notesage-server.backup" ]; then \
		sudo rm -f /opt/notesage/notesage-server.backup; \
	fi
	@echo "Cleanup completed"

# Development helpers
dev-setup:
	@echo "Setting up development environment..."
	@chmod +x *.sh
	@echo "Development environment ready"

test-scripts:
	@echo "Testing installation scripts..."
	@bash -n install.sh && echo "✓ install.sh syntax OK" || echo "✗ install.sh syntax error"
	@bash -n backup.sh && echo "✓ backup.sh syntax OK" || echo "✗ backup.sh syntax error"
	@bash -n restore.sh && echo "✓ restore.sh syntax OK" || echo "✗ restore.sh syntax error"
	@bash -n upgrade.sh && echo "✓ upgrade.sh syntax OK" || echo "✗ upgrade.sh syntax error"
	@bash -n health-check.sh && echo "✓ health-check.sh syntax OK" || echo "✗ health-check.sh syntax error"

# Package creation
package:
	@echo "Creating installation package..."
	@mkdir -p notesage-server-install
	@cp install.sh notesage-server-install/
	@cp backup.sh notesage-server-install/
	@cp restore.sh notesage-server-install/
	@cp upgrade.sh notesage-server-install/
	@cp health-check.sh notesage-server-install/
	@cp config.yaml notesage-server-install/
	@cp notesage.service notesage-server-install/
	@cp README.md notesage-server-install/
	@cp Makefile notesage-server-install/
	@chmod +x notesage-server-install/*.sh
	@tar -czf notesage-server-install.tar.gz notesage-server-install/
	@rm -rf notesage-server-install/
	@echo "Package created: notesage-server-install.tar.gz"

# Information
info:
	@echo "NoteSage Server Information"
	@echo "=========================="
	@echo ""
	@if [ -f "/opt/notesage/VERSION" ]; then \
		echo "Version: $$(cat /opt/notesage/VERSION)"; \
	elif [ -x "/opt/notesage/notesage-server" ]; then \
		echo "Version: $$(/opt/notesage/notesage-server --version 2>/dev/null || echo "unknown")"; \
	else \
		echo "Version: Not installed"; \
	fi
	@echo "Status: $$(sudo systemctl is-active notesage 2>/dev/null || echo "not running")"
	@echo "Enabled: $$(sudo systemctl is-enabled notesage 2>/dev/null || echo "not enabled")"
	@echo ""
	@echo "File Locations:"
	@echo "  Binary: /opt/notesage/notesage-server"
	@echo "  Config: /etc/notesage/config.yaml"
	@echo "  Data: /var/lib/notesage/"
	@echo "  Logs: /var/log/notesage/"
	@echo "  Service: /etc/systemd/system/notesage.service"
	@echo ""
	@if [ -d "/var/lib/notesage/backups" ]; then \
		echo "Backups: $$(find /var/lib/notesage/backups -name "*.gz" | wc -l) available"; \
	fi

# Quick commands
quick-install: dev-setup install
quick-start: start status
quick-stop: stop
quick-restart: restart status
quick-health: health status
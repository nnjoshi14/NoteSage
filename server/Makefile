.PHONY: build run test clean dev install-deps

# Build the application
build:
	go build -o bin/notesage-server .

# Run the application
run:
	go run .

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf tmp/
	rm -f coverage.out coverage.html

# Clean test database files
clean-test-db:
	find . -name "testdb_*.db*" -type f -delete
	find . -name ":memory:.db*" -type f -delete
	@echo "Test database files cleaned up"

# Development mode with hot reload
dev:
	air

# Install development dependencies
install-deps:
	go mod download
	go install github.com/cosmtrek/air@latest

# Initialize database
init-db:
	@echo "Database will be initialized automatically on first run"

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run

# Tidy dependencies
tidy:
	go mod tidy
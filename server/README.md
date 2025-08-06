# NoteSage Server

The NoteSage server is a Go-based REST API server that provides the backend for the NoteSage knowledge management system.

## Features

- **REST API**: Complete CRUD operations for notes, people, and todos
- **Multi-user support**: JWT-based authentication and user isolation
- **Database flexibility**: Support for PostgreSQL and SQLite
- **Real-time features**: WebSocket support for collaborative editing
- **Full-text search**: Advanced search capabilities across all content
- **AI integration**: Support for multiple AI providers (OpenAI, Gemini, Grok)

## Architecture

```
server/
├── main.go                 # Application entry point
├── internal/
│   ├── config/            # Configuration management
│   ├── database/          # Database connection and migrations
│   ├── handlers/          # HTTP request handlers
│   ├── middleware/        # HTTP middleware
│   ├── models/           # Database models
│   └── router/           # Route definitions
├── go.mod                # Go module definition
└── Makefile             # Build and development commands
```

## Getting Started

### Prerequisites

- Go 1.21 or later
- PostgreSQL 13+ or SQLite 3
- Make (optional, for using Makefile commands)

### Installation

1. Clone the repository and navigate to the server directory:
   ```bash
   git clone <repository-url>
   cd server
   ```

2. Install dependencies:
   ```bash
   go mod download
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Run the server:
   ```bash
   make run
   # or
   go run .
   ```

### Configuration

The server can be configured using environment variables. Copy `.env.example` to `.env` and modify as needed:

```bash
# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=notesage
DB_USER=notesage
DB_PASSWORD=your_password

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# Authentication
JWT_SECRET=your-secret-key
SESSION_TIMEOUT=24h
```

### Database Setup

#### PostgreSQL

1. Create a database and user:
   ```sql
   CREATE DATABASE notesage;
   CREATE USER notesage WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE notesage TO notesage;
   ```

2. The server will automatically create tables on first run.

#### SQLite

For SQLite, just set `DB_TYPE=sqlite` and `DB_NAME=notesage` (will create notesage.db file).

## Development

### Running in Development Mode

Use Air for hot reloading during development:

```bash
# Install Air
go install github.com/cosmtrek/air@latest

# Run with hot reload
make dev
# or
air
```

### Testing

Run the test suite:

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage

# Run specific package tests
go test -v ./internal/handlers
```

### Code Quality

```bash
# Format code
make fmt

# Run linter (requires golangci-lint)
make lint

# Tidy dependencies
make tidy
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Notes

- `GET /api/notes` - List notes (with filtering)
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get specific note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### People

- `GET /api/people` - List people
- `POST /api/people` - Create person
- `GET /api/people/:id` - Get specific person
- `PUT /api/people/:id` - Update person
- `DELETE /api/people/:id` - Delete person

### Todos

- `GET /api/todos` - List todos (with filtering)
- `POST /api/todos` - Create todo
- `GET /api/todos/:id` - Get specific todo
- `PUT /api/todos/:id` - Update todo
- `DELETE /api/todos/:id` - Delete todo

### Health Check

- `GET /health` - Server health status

## Database Models

### User
- ID, Username, Email, Password (hashed)
- Created/Updated timestamps

### Note
- ID, UserID, Title, Content (JSON), Category
- Tags, FolderPath, Scheduling info
- Archive/Pin/Favorite flags
- Version tracking

### Person
- ID, UserID, Name, Contact info
- Company, Title, LinkedIn, Avatar
- Notes field for additional info

### Todo
- ID, NoteID, TodoID (note-scoped)
- Text, Completion status
- Assigned person, Due date

### Connection
- ID, UserID, Source/Target references
- Connection type and strength
- For knowledge graph relationships

## Building and Deployment

### Building

```bash
# Build for current platform
make build

# Build for Linux
GOOS=linux GOARCH=amd64 go build -o bin/notesage-server-linux .

# Build for macOS
GOOS=darwin GOARCH=amd64 go build -o bin/notesage-server-macos .

# Build for Windows
GOOS=windows GOARCH=amd64 go build -o bin/notesage-server.exe .
```

### Deployment

1. Build the binary for your target platform
2. Copy to your server
3. Set up environment variables
4. Configure database
5. Run the binary

Example systemd service:

```ini
[Unit]
Description=NoteSage Server
After=network.target

[Service]
Type=simple
User=notesage
WorkingDirectory=/opt/notesage
ExecStart=/opt/notesage/notesage-server
Restart=always
RestartSec=5
Environment=DB_TYPE=postgres
Environment=DB_HOST=localhost
Environment=DB_NAME=notesage
Environment=JWT_SECRET=your-production-secret

[Install]
WantedBy=multi-user.target
```

## Performance Considerations

- Use PostgreSQL for better performance with multiple users
- Configure appropriate database connection pooling
- Set up proper indexing for search operations
- Consider using Redis for caching in high-load scenarios

## Security

- Always use strong JWT secrets in production
- Use HTTPS in production (configure TLS settings)
- Regularly update dependencies
- Follow Go security best practices
- Validate all user inputs

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check database is running
   - Verify connection parameters
   - Ensure user has proper permissions

2. **JWT token errors**
   - Verify JWT_SECRET is set
   - Check token expiration settings

3. **Port already in use**
   - Change SERVER_PORT in configuration
   - Check for other services using the port

### Logging

The server logs to stdout by default. Configure LOG_FILE to write to a file:

```bash
LOG_FILE=/var/log/notesage/server.log
LOG_LEVEL=info
```

## Contributing

1. Follow Go coding standards
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass before submitting PR

## License

MIT License - see LICENSE file for details.
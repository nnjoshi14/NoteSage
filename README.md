# NoteSage Desktop & Server

NoteSage is a powerful knowledge management application with a desktop-first approach. This repository contains both the Go-based server and Electron-based desktop client.

## Project Structure

```
├── server/                 # Go server application
│   ├── internal/          # Internal Go packages
│   ├── main.go           # Server entry point
│   └── go.mod            # Go dependencies
├── desktop-client/        # Electron desktop application
│   ├── src/              # TypeScript source code
│   ├── package.json      # Node.js dependencies
│   └── webpack.config.js # Build configuration
└── .github/workflows/    # CI/CD pipelines
```

## Features

- **Rich Text Editing**: Advanced note editor with markdown support, @mentions, #references
- **People Management**: Track contacts and relationships in your knowledge base
- **Todo Management**: Extract and manage todos from notes with ID-based format
- **Knowledge Graph**: Visualize connections between notes and people
- **Offline-First**: Desktop client works offline with automatic sync
- **Multi-User**: Server supports multiple concurrent users
- **Cross-Platform**: Desktop client for Ubuntu Linux and macOS

## Quick Start

### Prerequisites

- **Go 1.21+** (for server)
- **Node.js 18+** (for desktop client)
- **PostgreSQL** or **SQLite** (for database)

### Server Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   go mod download
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   # Edit .env with your database settings
   ```

4. Run the server:
   ```bash
   make run
   # or
   go run .
   ```

The server will start on `http://localhost:8080`

### Desktop Client Setup

1. Navigate to the desktop client directory:
   ```bash
   cd desktop-client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development mode:
   ```bash
   npm run dev
   ```

4. In another terminal, start the Electron app:
   ```bash
   npm run start:dev
   ```

## Development

### Server Development

```bash
cd server

# Run with hot reload
make dev

# Run tests
make test

# Run tests with coverage
make test-coverage

# Build binary
make build

# Format code
make fmt
```

### Desktop Client Development

```bash
cd desktop-client

# Start development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Testing

### Server Tests

The server uses Go's built-in testing framework with Testify for assertions:

```bash
cd server
go test -v ./...
```

### Desktop Client Tests

The desktop client uses Jest for testing:

```bash
cd desktop-client
npm test
```

## Building for Production

### Server

Build binaries for different platforms:

```bash
cd server
make build

# Or build for specific platforms
GOOS=linux GOARCH=amd64 go build -o bin/notesage-server-linux .
GOOS=darwin GOARCH=amd64 go build -o bin/notesage-server-macos .
```

### Desktop Client

Build distributables:

```bash
cd desktop-client

# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:linux
npm run dist:mac
```

## Deployment

### Server Deployment

1. Build the server binary for your target platform
2. Copy the binary to your server
3. Set up environment variables
4. Configure your database
5. Run the binary

Example systemd service file is provided in the installation documentation.

### Desktop Client Distribution

The desktop client builds to platform-specific installers:

- **Ubuntu**: `.deb` package
- **macOS**: `.dmg` installer

## Configuration

### Server Configuration

The server can be configured via environment variables or a config file. See `.env.example` for all available options.

Key settings:
- `DB_TYPE`: Database type (postgres/sqlite)
- `DB_HOST`, `DB_PORT`, `DB_NAME`: Database connection
- `JWT_SECRET`: Secret for JWT token signing
- `SERVER_PORT`: Port to run the server on

### Desktop Client Configuration

The desktop client stores configuration locally and connects to the server via the connection setup screen.

## API Documentation

The server provides a REST API for all operations. Key endpoints:

- `POST /api/auth/login` - User authentication
- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `GET /api/people` - List people
- `GET /api/todos` - List todos

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in this repository
- Check the documentation in the `docs/` directory
- Review the troubleshooting guide

## Roadmap

- [ ] Web client (React-based)
- [ ] Mobile clients (iOS/Android)
- [ ] Cloud deployment options
- [ ] Advanced AI features
- [ ] Real-time collaboration
- [ ] Plugin system
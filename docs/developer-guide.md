# NoteSage Developer Guide

This guide provides comprehensive information for developers working on NoteSage, including architecture, development setup, coding standards, and contribution guidelines.

## Architecture Overview

NoteSage follows a clean client-server architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    NoteSage Architecture                     │
├─────────────────────────────────────────────────────────────┤
│  Desktop Client (Electron)                                 │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Main Process   │  │ Renderer Process │                  │
│  │  - IPC Handler  │  │  - React UI     │                  │
│  │  - File System  │  │  - State Mgmt   │                  │
│  │  - Auto Update  │  │  - API Client   │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Server (Go)                                                │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   HTTP API      │  │   WebSocket     │                  │
│  │  - REST Routes  │  │  - Real-time    │                  │
│  │  - Middleware   │  │  - Collaboration│                  │
│  │  - Auth         │  │  - Notifications│                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Services      │  │   Data Layer    │                  │
│  │  - Business     │  │  - GORM Models  │                  │
│  │  - AI Integration│  │  - Migrations  │                  │
│  │  - Search       │  │  - Repositories │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL/SQLite)                              │
│  - Notes, People, Todos, Users                             │
│  - Full-text search indexes                                │
│  - Relationship tracking                                   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Server (Go)
- **Framework**: Gin or Echo for HTTP routing
- **ORM**: GORM for database operations
- **Database**: PostgreSQL (primary), SQLite (development)
- **WebSocket**: Gorilla WebSocket for real-time features
- **Authentication**: JWT tokens with middleware
- **Testing**: Testify for unit and integration tests
- **Build**: Go modules with cross-compilation

### Desktop Client (Electron + TypeScript)
- **Framework**: Electron 28+ with TypeScript 5+
- **UI**: React 18+ with modern hooks
- **State Management**: Redux Toolkit with RTK Query
- **Editor**: TipTap/ProseMirror for rich text editing
- **Styling**: CSS Modules or Styled Components
- **Testing**: Jest for unit tests, Playwright for E2E
- **Build**: Webpack with TypeScript compilation

### Development Tools
- **Version Control**: Git with conventional commits
- **CI/CD**: GitHub Actions for automated testing and builds
- **Code Quality**: ESLint, Prettier, golangci-lint
- **Documentation**: Markdown with automated generation
- **Package Management**: Go modules, npm/yarn

## Development Environment Setup

### Prerequisites

```bash
# Required software
- Go 1.21 or later
- Node.js 18 or later
- PostgreSQL 13 or later (for full development)
- Git 2.30 or later

# Optional but recommended
- Docker and Docker Compose
- VS Code with Go and TypeScript extensions
- Postman or similar API testing tool
```

### Server Development Setup

```bash
# Clone the repository
git clone https://github.com/notesage/notesage.git
cd notesage/server

# Install dependencies
go mod download

# Set up development database
createdb notesage_dev
psql notesage_dev < migrations/schema.sql

# Copy environment configuration
cp .env.example .env.dev
# Edit .env.dev with your database credentials

# Run database migrations
go run cmd/migrate/main.go -env=dev

# Start development server with hot reload
air  # or go run main.go

# Run tests
go test ./...

# Run with race detection
go test -race ./...

# Generate test coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Desktop Client Development Setup

```bash
# Navigate to desktop client directory
cd notesage/desktop-client

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.development
# Configure server URL and other settings

# Start development server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Build for development
npm run build:dev

# Package for distribution
npm run package
```

### Docker Development Environment

```bash
# Start full development environment
docker-compose -f docker-compose.dev.yml up

# Start only database
docker-compose -f docker-compose.dev.yml up postgres

# Run server in container
docker-compose -f docker-compose.dev.yml up server

# Run tests in container
docker-compose -f docker-compose.dev.yml run server go test ./...
```

## Code Organization

### Server Structure

```
server/
├── cmd/                    # Application entry points
│   ├── server/            # Main server application
│   ├── migrate/           # Database migration tool
│   └── admin/             # Admin CLI tool
├── internal/              # Private application code
│   ├── api/               # HTTP API handlers
│   │   ├── handlers/      # Request handlers
│   │   ├── middleware/    # HTTP middleware
│   │   └── routes/        # Route definitions
│   ├── services/          # Business logic services
│   │   ├── notes/         # Notes service
│   │   ├── people/        # People service
│   │   ├── todos/         # Todos service
│   │   ├── ai/            # AI integration service
│   │   └── auth/          # Authentication service
│   ├── models/            # Data models and database schema
│   ├── repositories/      # Data access layer
│   ├── websocket/         # WebSocket handling
│   ├── config/            # Configuration management
│   └── utils/             # Utility functions
├── migrations/            # Database migrations
├── tests/                 # Integration and E2E tests
├── docs/                  # API documentation
└── scripts/               # Build and deployment scripts
```

### Desktop Client Structure

```
desktop-client/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Application entry point
│   │   ├── ipc/           # IPC handlers
│   │   ├── services/      # Main process services
│   │   └── utils/         # Main process utilities
│   ├── renderer/          # Electron renderer process
│   │   ├── components/    # React components
│   │   │   ├── Editor/    # Rich text editor components
│   │   │   ├── Notes/     # Notes management components
│   │   │   ├── People/    # People management components
│   │   │   ├── Todos/     # Todo management components
│   │   │   └── Graph/     # Knowledge graph components
│   │   ├── services/      # API services and utilities
│   │   ├── stores/        # Redux stores and slices
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript type definitions
│   ├── shared/            # Shared code between processes
│   └── assets/            # Static assets
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── build/                 # Build configuration
└── dist/                  # Built application
```

## Coding Standards

### Go Code Standards

```go
// Package naming: lowercase, single word
package notes

// Interface naming: noun or adjective ending in -er
type NoteRepository interface {
    Create(ctx context.Context, note *Note) error
    GetByID(ctx context.Context, id uuid.UUID) (*Note, error)
    Update(ctx context.Context, note *Note) error
    Delete(ctx context.Context, id uuid.UUID) error
}

// Struct naming: PascalCase
type NoteService struct {
    repo   NoteRepository
    logger *slog.Logger
}

// Method naming: PascalCase with clear intent
func (s *NoteService) CreateNote(ctx context.Context, req CreateNoteRequest) (*Note, error) {
    // Validate input
    if err := req.Validate(); err != nil {
        return nil, fmt.Errorf("invalid request: %w", err)
    }
    
    // Business logic
    note := &Note{
        ID:       uuid.New(),
        Title:    req.Title,
        Content:  req.Content,
        UserID:   req.UserID,
        Category: req.Category,
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }
    
    // Persist to database
    if err := s.repo.Create(ctx, note); err != nil {
        s.logger.Error("failed to create note", "error", err, "user_id", req.UserID)
        return nil, fmt.Errorf("failed to create note: %w", err)
    }
    
    return note, nil
}

// Error handling: wrap errors with context
func (r *noteRepository) Create(ctx context.Context, note *Note) error {
    query := `INSERT INTO notes (id, title, content, user_id, category, created_at, updated_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)`
    
    _, err := r.db.ExecContext(ctx, query, 
        note.ID, note.Title, note.Content, note.UserID, 
        note.Category, note.CreatedAt, note.UpdatedAt)
    if err != nil {
        return fmt.Errorf("failed to insert note: %w", err)
    }
    
    return nil
}
```

### TypeScript Code Standards

```typescript
// Interface naming: PascalCase with descriptive names
interface NoteService {
  createNote(request: CreateNoteRequest): Promise<Note>;
  getNoteById(id: string): Promise<Note | null>;
  updateNote(id: string, updates: UpdateNoteRequest): Promise<Note>;
  deleteNote(id: string): Promise<void>;
}

// Type definitions: clear and specific
type NoteCategory = 'Note' | 'Meeting' | 'Project' | 'Personal';

interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// React component: functional with hooks
interface NoteEditorProps {
  note?: Note;
  onSave: (note: Note) => void;
  onCancel: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ 
  note, 
  onSave, 
  onCancel 
}) => {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [category, setCategory] = useState<NoteCategory>(note?.category ?? 'Note');
  
  const handleSave = useCallback(async () => {
    try {
      const savedNote = await noteService.createNote({
        title,
        content,
        category,
      });
      onSave(savedNote);
    } catch (error) {
      console.error('Failed to save note:', error);
      // Handle error appropriately
    }
  }, [title, content, category, onSave]);
  
  return (
    <div className="note-editor">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
      />
      <RichTextEditor
        content={content}
        onChange={setContent}
      />
      <div className="note-editor-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};
```

### Database Schema Standards

```sql
-- Table naming: lowercase, plural nouns
CREATE TABLE notes (
    -- Primary keys: always 'id', use UUIDs for distributed systems
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys: table_name_id format
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Columns: lowercase with underscores
    title TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    category TEXT NOT NULL DEFAULT 'Note',
    tags TEXT[] DEFAULT '{}',
    
    -- Metadata: consistent naming and types
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints: descriptive names
    CONSTRAINT notes_title_not_empty CHECK (length(trim(title)) > 0),
    CONSTRAINT notes_category_valid CHECK (category IN ('Note', 'Meeting', 'Project', 'Personal'))
);

-- Indexes: descriptive names with purpose
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_category ON notes(category);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_full_text ON notes USING gin(to_tsvector('english', title || ' ' || content));

-- Triggers: consistent naming
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Testing Standards

### Go Testing

```go
// Test file naming: *_test.go
package notes_test

import (
    "context"
    "testing"
    "time"
    
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/stretchr/testify/mock"
    
    "github.com/notesage/server/internal/models"
    "github.com/notesage/server/internal/services/notes"
)

// Test naming: TestFunctionName_Scenario_ExpectedBehavior
func TestNoteService_CreateNote_ValidInput_ReturnsNote(t *testing.T) {
    // Arrange
    mockRepo := &MockNoteRepository{}
    service := notes.NewService(mockRepo, logger)
    
    req := notes.CreateNoteRequest{
        Title:    "Test Note",
        Content:  "Test content",
        UserID:   uuid.New(),
        Category: "Note",
    }
    
    mockRepo.On("Create", mock.Anything, mock.AnythingOfType("*models.Note")).
        Return(nil)
    
    // Act
    result, err := service.CreateNote(context.Background(), req)
    
    // Assert
    require.NoError(t, err)
    assert.NotNil(t, result)
    assert.Equal(t, req.Title, result.Title)
    assert.Equal(t, req.Content, result.Content)
    assert.NotEqual(t, uuid.Nil, result.ID)
    
    mockRepo.AssertExpectations(t)
}

func TestNoteService_CreateNote_InvalidInput_ReturnsError(t *testing.T) {
    // Arrange
    mockRepo := &MockNoteRepository{}
    service := notes.NewService(mockRepo, logger)
    
    req := notes.CreateNoteRequest{
        Title:   "", // Invalid: empty title
        Content: "Test content",
        UserID:  uuid.New(),
    }
    
    // Act
    result, err := service.CreateNote(context.Background(), req)
    
    // Assert
    require.Error(t, err)
    assert.Nil(t, result)
    assert.Contains(t, err.Error(), "invalid request")
}

// Table-driven tests for multiple scenarios
func TestNoteService_ValidateCategory(t *testing.T) {
    tests := []struct {
        name     string
        category string
        wantErr  bool
    }{
        {"Valid Note category", "Note", false},
        {"Valid Meeting category", "Meeting", false},
        {"Invalid category", "InvalidCategory", true},
        {"Empty category", "", true},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := notes.ValidateCategory(tt.category)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

### TypeScript Testing

```typescript
// Test file naming: *.test.ts or *.spec.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { NoteEditor } from './NoteEditor';
import { noteService } from '../services/noteService';

// Mock external dependencies
jest.mock('../services/noteService');
const mockNoteService = noteService as jest.Mocked<typeof noteService>;

describe('NoteEditor', () => {
  // Test naming: describe what the test does
  it('should render with empty form when no note provided', () => {
    // Arrange
    const mockOnSave = jest.fn();
    const mockOnCancel = jest.fn();
    
    // Act
    render(
      <NoteEditor 
        onSave={mockOnSave} 
        onCancel={mockOnCancel} 
      />
    );
    
    // Assert
    expect(screen.getByPlaceholderText('Note title...')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
  
  it('should populate form when note is provided', () => {
    // Arrange
    const note = {
      id: '123',
      title: 'Test Note',
      content: 'Test content',
      category: 'Note' as const,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user123',
    };
    
    // Act
    render(
      <NoteEditor 
        note={note}
        onSave={jest.fn()} 
        onCancel={jest.fn()} 
      />
    );
    
    // Assert
    expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
  });
  
  it('should call onSave with note data when save button clicked', async () => {
    // Arrange
    const mockOnSave = jest.fn();
    const mockNote = { id: '123', title: 'New Note', content: 'Content' };
    
    mockNoteService.createNote.mockResolvedValue(mockNote);
    
    render(<NoteEditor onSave={mockOnSave} onCancel={jest.fn()} />);
    
    // Act
    fireEvent.change(screen.getByPlaceholderText('Note title...'), {
      target: { value: 'New Note' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    
    // Assert
    await waitFor(() => {
      expect(mockNoteService.createNote).toHaveBeenCalledWith({
        title: 'New Note',
        content: '',
        category: 'Note',
      });
      expect(mockOnSave).toHaveBeenCalledWith(mockNote);
    });
  });
});

// Integration tests
describe('NoteEditor Integration', () => {
  it('should save note and update UI', async () => {
    // Test full user workflow
    const { user } = renderWithProviders(<NoteEditor />);
    
    await user.type(screen.getByPlaceholderText('Note title...'), 'Integration Test');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    
    await waitFor(() => {
      expect(screen.getByText('Note saved successfully')).toBeInTheDocument();
    });
  });
});
```

## API Design Standards

### REST API Conventions

```go
// URL structure: /api/v1/resource[/id][/sub-resource]
// GET    /api/v1/notes           - List notes
// POST   /api/v1/notes           - Create note
// GET    /api/v1/notes/{id}      - Get specific note
// PUT    /api/v1/notes/{id}      - Update note (full)
// PATCH  /api/v1/notes/{id}      - Update note (partial)
// DELETE /api/v1/notes/{id}      - Delete note

// Request/Response structures
type CreateNoteRequest struct {
    Title    string   `json:"title" validate:"required,min=1,max=255"`
    Content  string   `json:"content" validate:"required"`
    Category string   `json:"category" validate:"required,oneof=Note Meeting Project Personal"`
    Tags     []string `json:"tags" validate:"dive,min=1,max=50"`
}

type NoteResponse struct {
    ID        string    `json:"id"`
    Title     string    `json:"title"`
    Content   string    `json:"content"`
    Category  string    `json:"category"`
    Tags      []string  `json:"tags"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
    UserID    string    `json:"user_id"`
}

type ListNotesResponse struct {
    Notes      []NoteResponse `json:"notes"`
    TotalCount int           `json:"total_count"`
    Page       int           `json:"page"`
    PageSize   int           `json:"page_size"`
    HasMore    bool          `json:"has_more"`
}

// Error response structure
type ErrorResponse struct {
    Error   string            `json:"error"`
    Message string            `json:"message"`
    Code    string            `json:"code,omitempty"`
    Details map[string]string `json:"details,omitempty"`
}

// HTTP status codes
// 200 OK - Successful GET, PUT, PATCH
// 201 Created - Successful POST
// 204 No Content - Successful DELETE
// 400 Bad Request - Invalid request data
// 401 Unauthorized - Authentication required
// 403 Forbidden - Insufficient permissions
// 404 Not Found - Resource not found
// 409 Conflict - Resource conflict
// 422 Unprocessable Entity - Validation errors
// 500 Internal Server Error - Server errors
```

### WebSocket API Standards

```go
// Message structure
type WebSocketMessage struct {
    Type      string      `json:"type"`
    ID        string      `json:"id,omitempty"`
    Timestamp time.Time   `json:"timestamp"`
    Data      interface{} `json:"data,omitempty"`
    Error     string      `json:"error,omitempty"`
}

// Message types
const (
    MessageTypeNoteUpdate    = "note_update"
    MessageTypeNoteCreate    = "note_create"
    MessageTypeNoteDelete    = "note_delete"
    MessageTypeTodoUpdate    = "todo_update"
    MessageTypeUserPresence  = "user_presence"
    MessageTypeCollabCursor  = "collab_cursor"
    MessageTypeError         = "error"
    MessageTypePing          = "ping"
    MessageTypePong          = "pong"
)

// Example messages
{
    "type": "note_update",
    "id": "note_123",
    "timestamp": "2024-01-15T10:30:00Z",
    "data": {
        "note_id": "note_123",
        "title": "Updated Title",
        "content": "Updated content",
        "user_id": "user_456"
    }
}

{
    "type": "collab_cursor",
    "timestamp": "2024-01-15T10:30:00Z",
    "data": {
        "note_id": "note_123",
        "user_id": "user_456",
        "position": 150,
        "selection": {
            "start": 150,
            "end": 165
        }
    }
}
```

## Database Migration Standards

```sql
-- Migration file naming: YYYYMMDD_HHMMSS_description.sql
-- Example: 20240115_143000_add_note_categories.sql

-- Always start with transaction
BEGIN;

-- Add descriptive comments
-- Migration: Add category support to notes table
-- Author: developer@notesage.com
-- Date: 2024-01-15
-- Description: Adds category column to notes table with default value and constraint

-- Forward migration
ALTER TABLE notes 
ADD COLUMN category TEXT NOT NULL DEFAULT 'Note';

-- Add constraint for valid categories
ALTER TABLE notes 
ADD CONSTRAINT notes_category_valid 
CHECK (category IN ('Note', 'Meeting', 'Project', 'Personal'));

-- Create index for category filtering
CREATE INDEX idx_notes_category ON notes(category);

-- Update existing data if needed
UPDATE notes SET category = 'Meeting' 
WHERE title ILIKE '%meeting%' OR title ILIKE '%standup%';

-- Record migration
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('20240115_143000', NOW());

COMMIT;

-- Rollback migration (in separate file: 20240115_143000_add_note_categories_down.sql)
BEGIN;

-- Remove constraint and index
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_category_valid;
DROP INDEX IF EXISTS idx_notes_category;

-- Remove column
ALTER TABLE notes DROP COLUMN IF EXISTS category;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '20240115_143000';

COMMIT;
```

## Build and Deployment

### Server Build Process

```bash
# Build script: scripts/build-server.sh
#!/bin/bash
set -euo pipefail

VERSION=${1:-"dev"}
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD)

# Build flags
LDFLAGS="-X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.GitCommit=${GIT_COMMIT}"

# Build for multiple platforms
GOOS=linux GOARCH=amd64 go build -ldflags="${LDFLAGS}" -o dist/notesage-server-linux-amd64 ./cmd/server
GOOS=darwin GOARCH=amd64 go build -ldflags="${LDFLAGS}" -o dist/notesage-server-darwin-amd64 ./cmd/server
GOOS=windows GOARCH=amd64 go build -ldflags="${LDFLAGS}" -o dist/notesage-server-windows-amd64.exe ./cmd/server

# Create checksums
cd dist
sha256sum * > checksums.txt
```

### Desktop Client Build Process

```json
// package.json build scripts
{
  "scripts": {
    "build": "webpack --mode production",
    "build:dev": "webpack --mode development",
    "package": "electron-builder",
    "package:linux": "electron-builder --linux",
    "package:mac": "electron-builder --mac",
    "package:win": "electron-builder --win",
    "release": "npm run build && npm run package"
  }
}
```

```javascript
// electron-builder configuration
module.exports = {
  appId: "com.notesage.desktop",
  productName: "NoteSage",
  directories: {
    output: "dist"
  },
  files: [
    "build/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  mac: {
    category: "public.app-category.productivity",
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"]
      }
    ]
  },
  linux: {
    target: [
      {
        target: "deb",
        arch: ["x64"]
      },
      {
        target: "AppImage",
        arch: ["x64"]
      }
    ]
  },
  publish: {
    provider: "github",
    owner: "notesage",
    repo: "notesage"
  }
};
```

## Contribution Guidelines

### Git Workflow

```bash
# Branch naming conventions
feature/add-note-categories
bugfix/fix-search-indexing
hotfix/security-patch-auth
release/v1.2.0

# Commit message format (Conventional Commits)
type(scope): description

# Examples:
feat(notes): add category support to notes
fix(auth): resolve JWT token expiration issue
docs(api): update authentication documentation
test(notes): add unit tests for note service
refactor(database): optimize note queries
chore(deps): update dependencies

# Pull request process
1. Create feature branch from main
2. Implement changes with tests
3. Update documentation
4. Create pull request with description
5. Code review and approval
6. Merge to main
```

### Code Review Checklist

**Functionality:**
- [ ] Code works as intended
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Performance is acceptable

**Code Quality:**
- [ ] Code follows style guidelines
- [ ] Functions are well-named and focused
- [ ] Comments explain complex logic
- [ ] No code duplication

**Testing:**
- [ ] Unit tests cover new functionality
- [ ] Integration tests pass
- [ ] Test cases cover edge cases
- [ ] Test names are descriptive

**Security:**
- [ ] Input validation is present
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Authentication/authorization checks

**Documentation:**
- [ ] API documentation updated
- [ ] README updated if needed
- [ ] Code comments are clear
- [ ] Migration documentation

### Release Process

```bash
# Version bumping (semantic versioning)
# MAJOR.MINOR.PATCH
# 1.0.0 -> 1.0.1 (patch: bug fixes)
# 1.0.1 -> 1.1.0 (minor: new features)
# 1.1.0 -> 2.0.0 (major: breaking changes)

# Release checklist
1. Update version numbers
2. Update CHANGELOG.md
3. Run full test suite
4. Build and test packages
5. Create release tag
6. Deploy to staging
7. Run smoke tests
8. Deploy to production
9. Monitor for issues
10. Update documentation
```

## Debugging and Troubleshooting

### Server Debugging

```go
// Debug logging
import "log/slog"

logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelDebug,
}))

logger.Debug("processing note", 
    "note_id", noteID, 
    "user_id", userID,
    "operation", "create")

// Profiling
import _ "net/http/pprof"

go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()

// Race condition detection
go run -race main.go
go test -race ./...

// Memory leak detection
go tool pprof http://localhost:6060/debug/pprof/heap
```

### Desktop Client Debugging

```typescript
// Development tools
if (process.env.NODE_ENV === 'development') {
  // Enable React DevTools
  const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
  
  app.whenReady().then(() => {
    installExtension(REACT_DEVELOPER_TOOLS)
      .then((name) => console.log(`Added Extension: ${name}`))
      .catch((err) => console.log('An error occurred: ', err));
  });
}

// Logging
import { ipcRenderer } from 'electron';

const logger = {
  debug: (message: string, ...args: any[]) => {
    console.debug(message, ...args);
    ipcRenderer.send('log', 'debug', message, args);
  },
  error: (message: string, error?: Error) => {
    console.error(message, error);
    ipcRenderer.send('log', 'error', message, error?.stack);
  }
};

// Performance monitoring
const performanceObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.duration > 100) { // Log slow operations
      logger.debug('Slow operation detected', {
        name: entry.name,
        duration: entry.duration
      });
    }
  });
});

performanceObserver.observe({ entryTypes: ['measure'] });
```

## Performance Optimization

### Server Performance

```go
// Connection pooling
db, err := sql.Open("postgres", dsn)
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)

// Caching
type CacheService struct {
    cache map[string]interface{}
    mutex sync.RWMutex
    ttl   time.Duration
}

func (c *CacheService) Get(key string) (interface{}, bool) {
    c.mutex.RLock()
    defer c.mutex.RUnlock()
    
    value, exists := c.cache[key]
    return value, exists
}

// Batch operations
func (r *noteRepository) CreateBatch(ctx context.Context, notes []*Note) error {
    tx, err := r.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    stmt, err := tx.PrepareContext(ctx, insertNoteQuery)
    if err != nil {
        return err
    }
    defer stmt.Close()
    
    for _, note := range notes {
        _, err := stmt.ExecContext(ctx, note.ID, note.Title, note.Content)
        if err != nil {
            return err
        }
    }
    
    return tx.Commit()
}
```

### Client Performance

```typescript
// React optimization
import { memo, useMemo, useCallback } from 'react';

const NoteList = memo(({ notes, onNoteClick }) => {
  const sortedNotes = useMemo(() => {
    return notes.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [notes]);
  
  const handleNoteClick = useCallback((noteId: string) => {
    onNoteClick(noteId);
  }, [onNoteClick]);
  
  return (
    <div>
      {sortedNotes.map(note => (
        <NoteItem 
          key={note.id} 
          note={note} 
          onClick={handleNoteClick}
        />
      ))}
    </div>
  );
});

// Virtual scrolling for large lists
import { FixedSizeList as List } from 'react-window';

const VirtualizedNoteList = ({ notes }) => (
  <List
    height={600}
    itemCount={notes.length}
    itemSize={80}
    itemData={notes}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <NoteItem note={data[index]} />
      </div>
    )}
  </List>
);

// Debounced search
import { useDebouncedCallback } from 'use-debounce';

const SearchInput = ({ onSearch }) => {
  const debouncedSearch = useDebouncedCallback(
    (value: string) => onSearch(value),
    300
  );
  
  return (
    <input
      type="text"
      onChange={(e) => debouncedSearch(e.target.value)}
      placeholder="Search notes..."
    />
  );
};
```

## Security Best Practices

### Server Security

```go
// Input validation
import "github.com/go-playground/validator/v10"

type CreateNoteRequest struct {
    Title    string `json:"title" validate:"required,min=1,max=255"`
    Content  string `json:"content" validate:"required,max=1000000"`
    Category string `json:"category" validate:"required,oneof=Note Meeting Project Personal"`
}

func validateRequest(req interface{}) error {
    validate := validator.New()
    return validate.Struct(req)
}

// SQL injection prevention (using GORM)
func (r *noteRepository) GetByUserID(ctx context.Context, userID uuid.UUID) ([]*Note, error) {
    var notes []*Note
    err := r.db.WithContext(ctx).Where("user_id = ?", userID).Find(&notes).Error
    return notes, err
}

// Rate limiting
import "golang.org/x/time/rate"

type RateLimiter struct {
    limiters map[string]*rate.Limiter
    mutex    sync.RWMutex
}

func (rl *RateLimiter) Allow(key string) bool {
    rl.mutex.RLock()
    limiter, exists := rl.limiters[key]
    rl.mutex.RUnlock()
    
    if !exists {
        rl.mutex.Lock()
        limiter = rate.NewLimiter(rate.Every(time.Minute), 60)
        rl.limiters[key] = limiter
        rl.mutex.Unlock()
    }
    
    return limiter.Allow()
}

// JWT token validation
func validateJWT(tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return jwtSecret, nil
    })
    
    if err != nil {
        return nil, err
    }
    
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims, nil
    }
    
    return nil, fmt.Errorf("invalid token")
}
```

### Client Security

```typescript
// XSS prevention
import DOMPurify from 'dompurify';

const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['class', 'id']
  });
};

// Secure storage
import { safeStorage } from 'electron';

const secureStore = {
  set: (key: string, value: string): void => {
    const encrypted = safeStorage.encryptString(value);
    localStorage.setItem(key, encrypted.toString('base64'));
  },
  
  get: (key: string): string | null => {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    
    try {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('Failed to decrypt stored value:', error);
      return null;
    }
  }
};

// Content Security Policy
const csp = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "https:"],
  'connect-src': ["'self'", "wss:", "https:"]
};
```

## Monitoring and Observability

### Application Metrics

```go
// Prometheus metrics
import "github.com/prometheus/client_golang/prometheus"

var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )
    
    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "HTTP request duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "endpoint"},
    )
    
    notesCreatedTotal = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "notes_created_total",
            Help: "Total number of notes created",
        },
    )
)

func init() {
    prometheus.MustRegister(httpRequestsTotal)
    prometheus.MustRegister(httpRequestDuration)
    prometheus.MustRegister(notesCreatedTotal)
}

// Middleware for metrics collection
func metricsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        
        // Wrap response writer to capture status code
        wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}
        
        next.ServeHTTP(wrapped, r)
        
        duration := time.Since(start).Seconds()
        
        httpRequestsTotal.WithLabelValues(
            r.Method,
            r.URL.Path,
            fmt.Sprintf("%d", wrapped.statusCode),
        ).Inc()
        
        httpRequestDuration.WithLabelValues(
            r.Method,
            r.URL.Path,
        ).Observe(duration)
    })
}
```

### Logging and Tracing

```go
// Structured logging with context
import (
    "context"
    "log/slog"
    "github.com/google/uuid"
)

type contextKey string

const requestIDKey contextKey = "request_id"

func withRequestID(ctx context.Context) context.Context {
    requestID := uuid.New().String()
    return context.WithValue(ctx, requestIDKey, requestID)
}

func loggerFromContext(ctx context.Context) *slog.Logger {
    requestID, _ := ctx.Value(requestIDKey).(string)
    return slog.With("request_id", requestID)
}

// Usage in handlers
func (h *noteHandler) CreateNote(w http.ResponseWriter, r *http.Request) {
    ctx := withRequestID(r.Context())
    logger := loggerFromContext(ctx)
    
    logger.Info("creating note", "user_id", userID)
    
    note, err := h.service.CreateNote(ctx, req)
    if err != nil {
        logger.Error("failed to create note", "error", err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
    }
    
    logger.Info("note created successfully", "note_id", note.ID)
}
```

This developer guide provides a comprehensive foundation for contributing to NoteSage. For specific implementation details, refer to the code comments and inline documentation within the codebase.

---

*For questions about development, create an issue on GitHub or contact the development team.*
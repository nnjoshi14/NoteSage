# replit.md

## Overview

This is a full-stack knowledge management application built with React/TypeScript on the frontend and Express.js/Node.js on the backend. The application provides comprehensive note-taking capabilities with a people database, knowledge graph visualization, AI-powered insights, and todo management. It uses PostgreSQL as the database with Drizzle ORM for type-safe database operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Rich Text Editor**: TipTap with mention support
- **Drawing**: Custom HTML5 Canvas implementation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: express-session with PostgreSQL store
- **AI Integration**: OpenAI GPT-4o for insights and todo extraction

### Database Schema
The application uses a comprehensive schema with the following main entities:
- **Users**: Authentication and profile information
- **Notes**: Rich text content with metadata
- **People**: Contact database with relationships
- **Tags**: Categorization system
- **Todos**: Task management
- **Insights**: AI-generated suggestions
- **Connections**: Relationships between notes and people

## Key Components

### Authentication System
- Uses Replit's OpenID Connect authentication
- Session-based authentication with PostgreSQL storage
- User profile management with automatic user creation
- Protected routes with middleware-based authorization

### Note Management
- Rich text editing with TipTap editor
- @mention functionality for people references
- Drawing canvas integration for sketches
- Automatic saving and real-time updates
- Full-text search capabilities

### People Database
- Comprehensive contact management
- LinkedIn integration support
- Bidirectional linking between people and notes
- Search and filtering capabilities

### Knowledge Graph
- D3.js-based visualization of relationships
- Interactive node exploration
- Filtering by content type (notes, people)
- Real-time updates as connections are made

### AI Features
- **Multiple AI Provider Support**: Users can configure and switch between OpenAI, Google Gemini, and xAI Grok
- **User-Provided API Keys**: Each user manages their own API keys for maximum security and control
- **Graceful Degradation**: Core features work without AI; AI features are disabled when no provider is configured
- **Real-time Provider Switching**: Users can change AI providers on-the-fly without application restart
- **API Key Validation**: Keys are tested before saving to ensure functionality
- **Automatic Todo Extraction**: Intelligent extraction of action items from note content
- **Pattern Recognition**: AI-powered insight generation from knowledge patterns
- **Relationship Analysis**: Smart suggestions for connections between people and content
- **Content Summarization**: Quick summaries of notes using the selected AI provider

## Data Flow

1. **Authentication Flow**: User authenticates via Replit OAuth → Session created → User profile fetched/created
2. **Note Creation**: User creates note → Rich text processed → Mentions extracted → Database updated → Real-time sync
3. **People Connections**: Person mentioned in note → Connection created → Graph updated → Suggestions generated
4. **AI Processing**: Note content analyzed → Todos extracted → Insights generated → User notified

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection with serverless support
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@tiptap/react**: Rich text editing
- **openai**: AI integration for insights

### UI Dependencies
- **@radix-ui/***: Headless UI components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Authentication
- **openid-client**: OpenID Connect implementation
- **passport**: Authentication middleware
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

### Development
- Vite dev server with HMR for frontend
- tsx for running TypeScript server directly
- Database migrations with Drizzle Kit
- Environment variables for configuration

### Production Build
- Vite builds frontend to `dist/public`
- esbuild bundles server code to `dist/index.js`
- Single Node.js process serves both static files and API
- PostgreSQL database connection via environment variable

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `OPENAI_API_KEY`: AI service authentication
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OpenID Connect provider URL

The application follows a monorepo structure with shared TypeScript types between frontend and backend, ensuring type safety across the entire stack. The architecture supports real-time collaboration, offline capabilities through query caching, and scalable deployment on Replit's infrastructure.
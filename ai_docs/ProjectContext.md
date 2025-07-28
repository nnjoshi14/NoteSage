# Project: NoteSage

## Project Overview
NoteSage is a comprehensive knowledge management application that combines note-taking, contact management, and AI-powered insights. The application provides a unified platform for organizing personal knowledge with features including:

- **Rich Text Note Management**: Advanced note-taking with TipTap editor, @mentions, and drawing capabilities
- **People Database**: Contact management with LinkedIn integration and relationship tracking
- **Knowledge Graph Visualization**: Interactive D3.js-based graph showing connections between notes and people
- **AI-Powered Insights**: Multi-provider AI integration (OpenAI, Google Gemini, xAI Grok) for todo extraction, pattern recognition, and relationship analysis
- **Todo Management**: Intelligent task extraction and organization
- **Real-time Collaboration**: Live updates and synchronization across the application

The app follows a modern full-stack architecture with React/TypeScript frontend and Express.js backend, designed for personal knowledge workers and researchers.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Rich Text Editor**: TipTap with mention support and custom extensions
- **Visualization**: D3.js for knowledge graph rendering
- **Icons**: Lucide React for consistent iconography

### Backend
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: express-session with PostgreSQL store
- **AI Integration**: Multi-provider support (OpenAI GPT-4o, Google Gemini, xAI Grok)

### Development Tools
- **TypeScript**: Strict type checking across frontend and backend
- **ESBuild**: Production bundling for server code
- **Drizzle Kit**: Database migrations and schema management
- **PostCSS**: CSS processing with Tailwind
- **Vite Plugins**: Replit-specific development tooling

## Coding Standards

### TypeScript & Type Safety
- Strict TypeScript configuration with shared types between frontend and backend
- Drizzle ORM for type-safe database operations
- Zod schemas for runtime validation
- Comprehensive type definitions in `shared/schema.ts`

### Component Architecture
- Functional components with hooks for state management
- Custom hooks for reusable logic (`useAuth`, `useToast`, etc.)
- shadcn/ui component library for consistent UI patterns
- Tailwind CSS for styling with custom design tokens

### File Organization
- **Client**: React components, pages, hooks, and utilities
- **Server**: Express routes, services, and database operations
- **Shared**: TypeScript types and schemas used across frontend/backend
- **Components**: Organized by feature (layout, editor, people, graph, settings)

### Naming Conventions
- PascalCase for React components and TypeScript interfaces
- camelCase for functions, variables, and database columns
- kebab-case for file names and CSS classes
- Descriptive naming with clear intent

### Code Quality
- ESLint and TypeScript strict mode
- Consistent error handling with custom error classes
- Comprehensive logging for API requests
- Graceful degradation when AI services are unavailable

## AI Instructions

### Do's
- **Respect Type Safety**: Always maintain TypeScript strict typing
- **Follow Component Patterns**: Use shadcn/ui components and existing patterns
- **Handle AI Gracefully**: Implement fallbacks when AI services are unavailable
- **Use Shared Types**: Leverage types from `shared/schema.ts` for consistency
- **Maintain Responsive Design**: Ensure mobile-friendly layouts with Tailwind
- **Follow Error Handling**: Use consistent error patterns and user feedback

### Don'ts
- **Avoid Breaking Changes**: Don't modify database schema without migrations
- **No Hardcoded Values**: Use environment variables for configuration
- **Don't Skip Validation**: Always validate user inputs with Zod schemas
- **Avoid Direct DOM Manipulation**: Use React patterns instead
- **No Inline Styles**: Use Tailwind classes for styling
- **Don't Ignore TypeScript Errors**: Fix all type issues before committing

### AI Integration Guidelines
- **Multi-Provider Support**: Always support multiple AI providers (OpenAI, Gemini, Grok)
- **User-Controlled Keys**: Users manage their own API keys for security
- **Graceful Degradation**: Core features work without AI; AI is enhancement
- **Real-time Switching**: Support changing AI providers without restart
- **API Key Validation**: Test keys before saving to ensure functionality

## Memory/Rules

### User Preferences
- **Simple Language**: Prefer clear, everyday language over technical jargon
- **Modern UI**: Clean, accessible interfaces with dark mode support
- **Performance First**: Optimize for speed and responsiveness
- **Mobile Responsive**: Ensure all features work on mobile devices
- **Real-time Updates**: Live synchronization across all components

### Technical Preferences
- **TypeScript Strict**: Maintain strict type checking throughout
- **Tailwind CSS**: Primary styling framework with custom design system
- **shadcn/ui**: Component library for consistent UI patterns
- **Drizzle ORM**: Type-safe database operations over raw SQL
- **TanStack Query**: Server state management with caching
- **Wouter**: Lightweight routing over heavy frameworks
- **Vite**: Fast development and optimized builds

### Architecture Decisions
- **Monorepo Structure**: Shared types between frontend and backend
- **REST API**: RESTful endpoints over GraphQL for simplicity
- **Session-Based Auth**: Replit Auth integration for seamless login
- **PostgreSQL**: Reliable relational database with JSON support
- **Single Port Deployment**: Unified server for API and static files

## File Structure

```
NoteSage/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── layout/     # Layout components (Sidebar, MainEditor)
│   │   │   ├── editor/     # Rich text editor components
│   │   │   ├── people/     # Contact management components
│   │   │   ├── graph/      # Knowledge graph visualization
│   │   │   ├── settings/   # Settings and configuration
│   │   │   └── ui/         # shadcn/ui base components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and configurations
│   │   ├── pages/          # Main application pages
│   │   └── App.tsx         # Main application component
│   └── index.html          # HTML entry point
├── server/                 # Express.js backend
│   ├── services/           # Business logic services
│   │   └── aiService.ts    # Multi-provider AI integration
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Database operations
│   ├── db.ts              # Database connection
│   ├── replitAuth.ts      # Authentication setup
│   ├── vite.ts            # Development server setup
│   └── index.ts           # Server entry point
├── shared/                 # Shared TypeScript types
│   └── schema.ts          # Database schema and types
├── dist/                   # Production build output
├── package.json            # Dependencies and scripts
├── vite.config.ts         # Vite build configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── drizzle.config.ts      # Database migration config
└── tsconfig.json          # TypeScript configuration
```

### Key Responsibilities
- **Client**: User interface, state management, and user interactions
- **Server**: API endpoints, database operations, and AI service integration
- **Shared**: Type definitions and schemas used across the stack
- **Configuration**: Build tools, styling, and development setup

---

**Summary**: NoteSage is a sophisticated knowledge management platform built with modern web technologies, featuring AI-powered insights, comprehensive note-taking, and relationship visualization. The codebase emphasizes type safety, component reusability, and graceful degradation while supporting multiple AI providers for enhanced functionality. 
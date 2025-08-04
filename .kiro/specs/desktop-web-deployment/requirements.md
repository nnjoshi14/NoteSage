# Requirements Document

## Introduction

This feature enables NoteSage to run as a native desktop application, providing users with a standalone knowledge management solution. The desktop application will package the existing React/Express stack into a native desktop experience using Electron, with all current features including rich text editing, people management, AI-powered insights, knowledge graph visualization, and todo management.

## Requirements

### Requirement 1

**User Story:** As a user, I want to create and edit rich text notes in the desktop application, so that I can capture my thoughts and knowledge with formatting backlinks and @mentions.

#### Acceptance Criteria

1. WHEN the user creates a new note THEN the system SHALL provide a rich text editor with formatting options (bold, italic, headings, lists, quotes, code)
2. WHEN the user types @ in a note THEN the system SHALL show a dropdown of people to mention. If user types after @ the system should show users starting name or surname with given text.
3. WHEN the user types # in a note THEN the system SHALL show a dropdown of note titles to mention where last edited note should appear first. If user is typing after # it should list notes starting with given string.
4. WHEN the user types "/" in a note THEN the system SHALL show slash commands for quick insertion of content types (tables, code blocks, callouts, etc.)
5. WHEN the user creates tables THEN the system SHALL provide table editing capabilities with add/remove rows and columns
6. WHEN the user adds images or files THEN the system SHALL support embedding and displaying media content within notes
7. WHEN the user creates mermaid diagrams THEN the system SHALL support rendering of flowcharts, sequence diagrams, and other mermaid diagram types
8. WHEN the user creates callouts THEN the system SHALL provide info boxes, warnings, tips, and other styled content blocks
9. WHEN the user adds code blocks THEN the system SHALL provide syntax highlighting for different programming languages
10. WHEN the user performs global search THEN the system SHALL search across all note content with filtering options
11. WHEN the user opens quick switcher THEN the system SHALL provide fast note navigation with fuzzy search
12. WHEN the user accesses recent notes THEN the system SHALL show recently viewed/edited notes for quick access
13. WHEN the user creates templates THEN the system SHALL allow saving and reusing note templates
14. WHEN the user archives notes THEN the system SHALL move notes to archive without deleting them
15. WHEN the user pins notes THEN the system SHALL mark important notes for quick access
16. WHEN the user switches to markdown mode THEN the system SHALL provide raw markdown editing capabilities
17. WHEN the user performs block operations THEN the system SHALL allow moving, duplicating, and deleting content blocks
18. WHEN the user types THEN the system SHALL provide auto-completion and smart suggestions
19. WHEN the user adds tags THEN the system SHALL support flexible tagging system with nested hierarchical tags
20. WHEN the user bookmarks notes THEN the system SHALL allow marking frequently accessed notes as favorites
21. WHEN the user sorts notes THEN the system SHALL provide custom sorting by various criteria (date, title, category, etc.)
22. WHEN the user exports notes THEN the system SHALL support export to PDF, Markdown, and HTML formats
23. WHEN the user tracks changes THEN the system SHALL maintain version history for notes
24. Note should have categories field, with support to add custom categories. Default categories should be Note & Meeting.
25. System should allow to store notes in hierarchical / directory structure.
26. WHEN the user saves a note THEN the system SHALL automatically save changes to the locally hosted storage.
27. WHEN the user views a note THEN the system SHALL open note to edit. View to edit should be the setting and readonly notes are not needed.
28. IF the user mentions a person or note THEN the system SHALL create a connection between the note and that person
29. On given note User should be able to see list of other notes and their edit times from which this note is referred.
30. WHEN the user deletes a note THEN the system SHALL move the note to trash and allow permanent deletion or restoration
31. WHEN the user filters notes THEN the system SHALL provide filtering by categories, tags, date ranges, and other criteria
32. WHEN the user searches notes THEN the system SHALL provide advanced search with filters, operators, and content-specific search options 

### Requirement 2

**User Story:** As a user, I want to manage my contacts and people in the desktop application, so that I can track relationships and connections in my knowledge base.

#### Acceptance Criteria

1. WHEN the user adds a new person THEN the system SHALL allow entering name, email, phone, company, title, LinkedIn URL, and notes
2. WHEN the user views a person THEN the system SHALL show all connected notes and relationship count
3. WHEN the user edits a person THEN the system SHALL update the information and maintain existing connections
4. WHEN the user deletes a person THEN the system SHALL remove the person but preserve note content
5. IF a person has an avatar URL THEN the system SHALL display their profile image

### Requirement 3

**User Story:** As a user, I want to visualize my knowledge graph in the desktop application, so that I can see connections between my notes and people.

#### Acceptance Criteria

1. WHEN the user opens the knowledge graph THEN the system SHALL display an interactive D3.js visualization
2. WHEN the user clicks on a node THEN the system SHALL show details about that note or person
3. WHEN the user drags a node THEN the system SHALL allow repositioning and update the graph layout
4. WHEN the user searches in the graph THEN the system SHALL filter nodes based on the search query
5. IF there are no connections THEN the system SHALL show an empty state with helpful instructions

### Requirement 4

**User Story:** As a user, I want AI-powered features in the desktop application, so that I can get insights, extract todos, and analyze relationships automatically.

#### Acceptance Criteria

1. WHEN the user configures an AI provider (OpenAI, Gemini, or Grok) THEN the system SHALL store the API key securely locally
2. WHEN the user saves a note with AI enabled THEN the system SHALL automatically extract todos and analyze mentioned people
3. WHEN the user requests insights THEN the system SHALL generate patterns, suggestions, and connections from their knowledge base
4. WHEN AI services are unavailable THEN the system SHALL gracefully degrade without breaking core functionality
5. IF no AI provider is configured THEN the system SHALL still provide all manual features

### Requirement 5

**User Story:** As a user, I want to manage todos and tasks in the desktop application, so that I can track action items extracted from my notes.

#### Acceptance Criteria

1. WHEN AI extracts todos from notes THEN the system SHALL display them in a dedicated todos view
2. WHEN the user marks a todo as complete THEN the system SHALL update the status and timestamp
3. WHEN the user views a todo THEN the system SHALL show which note it came from
4. WHEN the user manually adds a todo THEN the system SHALL allow creating todos not linked to notes
5. IF a note is deleted THEN the system SHALL preserve associated todos with a note reference

### Requirement 6

**User Story:** As a user, I want to configure where my data is stored, so that I can control the location of my database files and easily manage backups.

#### Acceptance Criteria

1. WHEN the user first launches the application THEN the system SHALL allow the user to choose a data directory location
2. WHEN the user selects a data directory THEN the system SHALL store the SQLite database file in that location
3. WHEN the user wants to change the data directory THEN the system SHALL provide a settings option to relocate the database
4. WHEN relocating the database THEN the system SHALL safely move the existing database file to the new location
5. IF the selected directory is not writable THEN the system SHALL display an error and prompt for a different location

### Requirement 7

**User Story:** As a user, I want easy installation and setup processes, so that I can quickly get started with NoteSage without technical complexity.

#### Acceptance Criteria

1. WHEN installing the desktop application THEN the system SHALL provide platform-specific installers (Windows, macOS, Linux)
2. WHEN first launching the application THEN the system SHALL automatically handle database initialization
3. WHEN the application starts THEN the system SHALL automatically run necessary database migrations
4. WHEN environment setup is needed THEN the system SHALL provide clear documentation and automated setup
5. IF setup fails THEN the system SHALL provide helpful error messages and troubleshooting guidance

### Requirement 8

**User Story:** As a developer, I want to run NoteSage locally for development, so that I can test changes before building the desktop application.

#### Acceptance Criteria

1. WHEN the developer runs a local setup command THEN the system SHALL install all dependencies for both client and server
2. WHEN the developer runs a start command THEN the system SHALL concurrently start both the frontend and backend services
3. WHEN the local development server starts THEN the system SHALL be accessible via a web browser at localhost
4. WHEN the developer makes code changes THEN the system SHALL support hot reloading for both frontend and backend
5. IF dependencies are missing THEN the system SHALL provide clear error messages and installation instructions
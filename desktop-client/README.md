# NoteSage Desktop Client

The NoteSage desktop client is an Electron-based application that provides a native desktop experience for the NoteSage knowledge management system.

## Features

- **Native Desktop Experience**: Built with Electron for Ubuntu Linux and macOS
- **Offline-First**: Works offline with automatic synchronization when connected
- **Rich Text Editing**: Advanced note editor with formatting, @mentions, and #references
- **Server Connection**: Connect to local or remote NoteSage servers
- **Real-time Sync**: Automatic synchronization with conflict resolution
- **Cross-Platform**: Supports Ubuntu Linux and macOS

## Architecture

```
desktop-client/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Application entry point
│   │   ├── server-connection.ts
│   │   ├── offline-cache.ts
│   │   └── sync-manager.ts
│   ├── renderer/          # Electron renderer process
│   │   ├── components/    # React components
│   │   ├── stores/        # Redux state management
│   │   ├── services/      # API services
│   │   └── styles/        # CSS styles
│   └── shared/           # Shared types and utilities
├── package.json          # Dependencies and scripts
├── webpack.config.js     # Build configuration
└── tsconfig.json        # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn package manager
- A running NoteSage server (see server README)

### Installation

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
   # Start the renderer development server
   npm run dev:renderer

   # In another terminal, start the main process
   npm run dev:main

   # In a third terminal, start Electron
   npm run start:dev
   ```

### Building for Production

```bash
# Build the application
npm run build

# Create distributables
npm run dist

# Platform-specific builds
npm run dist:linux    # Ubuntu .deb package
npm run dist:mac      # macOS .dmg installer
```

## Development

### Project Structure

#### Main Process (`src/main/`)

The main process handles:
- Application lifecycle
- Server connections
- Offline caching (SQLite)
- Data synchronization
- Native OS integration

Key files:
- `main.ts` - Application entry point and window management
- `server-connection.ts` - Manages connections to NoteSage servers
- `offline-cache.ts` - Local SQLite database for offline storage
- `sync-manager.ts` - Handles data synchronization and conflict resolution

#### Renderer Process (`src/renderer/`)

The renderer process provides the UI:
- React-based user interface
- Redux for state management
- TypeScript for type safety
- Webpack for bundling

Key directories:
- `components/` - React UI components
- `stores/` - Redux slices and store configuration
- `services/` - API client services
- `styles/` - Global CSS styles

### State Management

The application uses Redux Toolkit for state management with the following slices:

- `connectionSlice` - Server connection status and configuration
- `notesSlice` - Notes data and operations
- `peopleSlice` - People/contacts management
- `todosSlice` - Todo items and task management

### Development Scripts

```bash
# Development
npm run dev              # Start both main and renderer in watch mode
npm run dev:main         # Watch main process TypeScript
npm run dev:renderer     # Start renderer dev server
npm run start:dev        # Start Electron in development mode

# Building
npm run build            # Build both main and renderer
npm run build:main       # Build main process
npm run build:renderer   # Build renderer process

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format code with Prettier

# Distribution
npm run pack             # Package without creating installer
npm run dist             # Create platform-specific installer
npm run dist:linux       # Create .deb package for Ubuntu
npm run dist:mac         # Create .dmg for macOS
```

### Testing

The project uses Jest for testing with the following setup:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test component interactions
- **Store Tests**: Test Redux slices and async actions

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Quality

The project enforces code quality through:

- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **TypeScript**: Static type checking

```bash
# Check code quality
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Configuration

### Server Connection

The desktop client connects to NoteSage servers through the connection setup screen. Configuration includes:

- Server URL and port
- Username and password
- Connection preferences

### Offline Storage

The client uses SQLite for offline storage:

- Notes, people, and todos cached locally
- Sync metadata for conflict resolution
- Offline queue for changes made while disconnected

### Auto-Updates

The application supports automatic updates using `electron-updater`:

- Checks for updates on startup
- Downloads updates in background
- Prompts user to restart for installation

## Building and Distribution

### Development Build

```bash
npm run build
npm run start
```

### Production Distribution

#### Ubuntu Linux (.deb)

```bash
npm run dist:linux
```

Creates a `.deb` package in the `release/` directory that can be installed with:

```bash
sudo dpkg -i notesage-desktop_1.0.0_amd64.deb
```

#### macOS (.dmg)

```bash
npm run dist:mac
```

Creates a `.dmg` installer in the `release/` directory.

### Continuous Integration

The project includes GitHub Actions workflows for:

- Running tests on pull requests
- Building distributables for releases
- Code quality checks
- Security scanning

## Troubleshooting

### Common Issues

1. **Server Connection Failed**
   - Verify server is running and accessible
   - Check firewall settings
   - Confirm server URL and port

2. **Sync Issues**
   - Check network connectivity
   - Verify server authentication
   - Review sync logs in developer tools

3. **Build Failures**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility
   - Verify all dependencies are installed

### Development Tools

- **Electron DevTools**: Available in development mode (F12)
- **Redux DevTools**: Install browser extension for state debugging
- **React DevTools**: Available through Electron DevTools

### Logging

The application logs to:
- Console (development mode)
- Application logs directory (production)
- Electron's built-in logging system

Access logs through:
```bash
# macOS
~/Library/Logs/NoteSage/

# Linux
~/.config/NoteSage/logs/
```

## Performance Optimization

### Bundle Size

- Use code splitting for large components
- Lazy load non-critical features
- Optimize images and assets

### Memory Usage

- Implement proper cleanup in React components
- Use React.memo for expensive components
- Monitor memory usage in development

### Startup Time

- Minimize main process initialization
- Use preload scripts efficiently
- Optimize renderer bundle size

## Security Considerations

- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Preload Scripts**: Used for secure IPC
- **Content Security Policy**: Configured for production

## Contributing

1. Follow TypeScript and React best practices
2. Add tests for new features
3. Update documentation
4. Ensure all linting passes
5. Test on both Ubuntu and macOS if possible

## License

MIT License - see LICENSE file for details.
# NoteSage Desktop - Electron Architecture

This document describes the Electron application architecture for NoteSage Desktop, including security configuration, IPC communication, window management, and build processes.

## Architecture Overview

The NoteSage Desktop application follows Electron's recommended security practices with a clear separation between the main process and renderer process:

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Process (Node.js)                   │
├─────────────────────────────────────────────────────────────┤
│  • Application lifecycle management                         │
│  • Window creation and management                           │
│  • Native menu and system integration                       │
│  • IPC handlers for secure communication                    │
│  • Server connection management                             │
│  • Offline cache and sync operations                        │
│  • Security policy enforcement                              │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Preload Script  │
                    │  (Context Bridge) │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Renderer Process (Chromium)                 │
├─────────────────────────────────────────────────────────────┤
│  • React application with TypeScript                        │
│  • Redux Toolkit for state management                       │
│  • React Router for navigation                              │
│  • Secure IPC communication via electronAPI                 │
│  • UI components and user interactions                      │
└─────────────────────────────────────────────────────────────┘
```

## Security Configuration

### Main Process Security

The main process implements several security measures:

1. **Content Security Policy**: Disables dangerous features
2. **Window Security**: Proper webPreferences configuration
3. **External Link Handling**: Prevents navigation to external URLs
4. **Permission Management**: Restricts API access to essential permissions only

```typescript
// Security policies in main.ts
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,           // Disable Node.js in renderer
    contextIsolation: true,           // Enable context isolation
    enableRemoteModule: false,        // Disable remote module
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: false,                   // Disabled for IPC requirements
    webSecurity: true,                // Enable web security
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

### Preload Script Security

The preload script uses `contextBridge` to expose a limited, secure API:

```typescript
// Only validated channels are allowed
const validChannels = [
  'menu-new-note', 'menu-save', 'menu-preferences',
  // ... other validated channels
];

contextBridge.exposeInMainWorld('electronAPI', {
  // Secure API methods with type safety
  connectToServer: (config: ServerConfig) => ipcRenderer.invoke('connect-to-server', config),
  // ... other secure methods
});
```

## IPC Communication

### Available IPC Handlers

The main process registers the following IPC handlers:

#### Server Connection
- `connect-to-server`: Connect to NoteSage server
- `disconnect-from-server`: Disconnect from server
- `get-connection-status`: Get current connection status

#### Data Synchronization
- `sync-data`: Trigger manual data synchronization
- `get-cached-notes`: Retrieve cached notes for offline access
- `cache-note`: Cache a note locally

#### Window Management
- `window-minimize`: Minimize the application window
- `window-maximize`: Maximize/restore the application window
- `window-close`: Close the application window

#### Theme Management
- `get-theme`: Get current system theme
- `set-theme`: Set application theme (light/dark/system)

#### File Operations
- `show-save-dialog`: Show native save file dialog
- `show-open-dialog`: Show native open file dialog

#### Application Info
- `get-app-version`: Get application version
- `get-app-info`: Get comprehensive app information

### Menu Integration

The application menu sends events to the renderer process:

```typescript
// Menu events sent to renderer
this.mainWindow?.webContents.send('menu-new-note');
this.mainWindow?.webContents.send('menu-save');
this.mainWindow?.webContents.send('menu-preferences');
// ... other menu events
```

## Window Management

### Window State Persistence

The application saves and restores window state:

```typescript
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}
```

### Window Configuration

- **Minimum Size**: 800x600 pixels
- **Default Size**: 1200x800 pixels
- **Title Bar**: Platform-specific styling
- **Security**: Proper webPreferences for security

## State Management (Redux Toolkit)

### Store Configuration

```typescript
export const store = configureStore({
  reducer: {
    connection: connectionReducer,
    notes: notesReducer,
    people: peopleReducer,
    todos: todosReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['connection.config', 'notes.items.*.lastModified'],
      },
      immutableCheck: { warnAfter: 128 },
    }),
  devTools: process.env.NODE_ENV === 'development',
});
```

### Type Safety

Full TypeScript support with proper type definitions:

```typescript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## Build Processes

### Development Build

```bash
npm run dev
```

- Concurrent main and renderer process compilation
- Hot module replacement for renderer
- TypeScript compilation with watch mode
- Webpack dev server on port 3000

### Production Build

```bash
npm run build
```

- Optimized webpack bundle with code splitting
- TypeScript compilation for both processes
- Asset optimization and minification
- Content hashing for cache busting

### Electron Packaging

```bash
npm run dist
```

- Cross-platform builds (macOS .dmg, Linux .deb)
- Code signing and notarization (macOS)
- Auto-updater integration
- Native installer creation

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start Electron app |
| `npm run start:dev` | Start Electron in development mode |
| `npm run test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run clean` | Clean build artifacts |
| `npm run pack` | Package without creating installer |
| `npm run dist` | Create distribution packages |

## File Structure

```
desktop-client/
├── src/
│   ├── main/                 # Main process
│   │   ├── main.ts          # Application entry point
│   │   ├── preload.ts       # Preload script
│   │   ├── server-connection.ts
│   │   ├── offline-cache.ts
│   │   └── sync-manager.ts
│   ├── renderer/            # Renderer process
│   │   ├── App.tsx          # Main React component
│   │   ├── index.tsx        # Renderer entry point
│   │   ├── index.html       # HTML template
│   │   └── styles/          # Global styles
│   ├── components/          # React components
│   ├── stores/              # Redux store and slices
│   ├── services/            # API services
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── dist/                    # Build output
├── release/                 # Distribution packages
├── package.json             # Dependencies and scripts
├── webpack.config.js        # Webpack configuration
├── tsconfig.json           # TypeScript config (renderer)
├── tsconfig.main.json      # TypeScript config (main)
└── electron-builder.json   # Electron Builder config
```

## Testing

The architecture includes comprehensive tests:

- **Unit Tests**: Component and function testing
- **Integration Tests**: IPC communication testing
- **Security Tests**: Validation of security policies
- **Build Tests**: Webpack and TypeScript configuration validation

Run tests with:
```bash
npm test
```

## Requirements Compliance

This architecture fulfills the following requirements:

- **7.1**: Platform-specific installers for Ubuntu Linux and macOS
- **8.1**: Server connection and authentication system
- **Security**: Proper Electron security configuration
- **IPC**: Secure communication between processes
- **State Management**: Redux Toolkit integration
- **Build Process**: Development and production configurations
- **Window Management**: Native window controls and state persistence
- **Menu System**: Comprehensive application menu with keyboard shortcuts

## Next Steps

With the Electron architecture in place, the next tasks involve:

1. **Server Connection Implementation** (Task 12)
2. **Offline Cache System** (Task 13)
3. **Rich Text Editor** (Task 14)
4. **UI Components** (Tasks 15-17)
5. **Advanced Features** (Tasks 18-20)

The architecture provides a solid foundation for all subsequent development tasks.
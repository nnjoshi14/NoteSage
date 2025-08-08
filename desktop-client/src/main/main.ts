import { app, BrowserWindow, Menu, ipcMain, shell, dialog, nativeTheme } from 'electron';
import * as path from 'path';
import { ServerConnectionManager } from './server-connection';
import { OfflineCache } from './offline-cache';
import { SyncManager } from './sync-manager';

// Security: Disable node integration and enable context isolation by default
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

class NoteSageApp {
  private mainWindow: BrowserWindow | null = null;
  private serverConnection: ServerConnectionManager;
  private offlineCache: OfflineCache;
  private syncManager: SyncManager;
  private windowState: WindowState = {
    width: 1200,
    height: 800,
    isMaximized: false
  };

  constructor() {
    this.serverConnection = new ServerConnectionManager();
    this.offlineCache = new OfflineCache();
    this.syncManager = new SyncManager(this.serverConnection, this.offlineCache);
    
    this.setupSecurityPolicies();
    this.setupEventHandlers();
  }

  private setupSecurityPolicies(): void {
    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });

      // Security: Prevent navigation to external URLs
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        if (parsedUrl.origin !== 'http://localhost:3000' && parsedUrl.origin !== 'file://') {
          event.preventDefault();
        }
      });
    });

    // Security: Prevent permission requests
    app.on('web-contents-created', (event, contents) => {
      contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['clipboard-read', 'clipboard-write'];
        callback(allowedPermissions.includes(permission));
      });
    });
  }

  private setupEventHandlers(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.setupMenu();
      this.setupIPC();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  private createWindow(): void {
    // Restore window state
    this.loadWindowState();

    this.mainWindow = new BrowserWindow({
      width: this.windowState.width,
      height: this.windowState.height,
      x: this.windowState.x,
      y: this.windowState.y,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,

        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        preload: path.join(__dirname, 'preload.js'),
        // Security: Disable node integration in worker threads
        nodeIntegrationInWorker: false,
        // Security: Disable node integration in subframes
        nodeIntegrationInSubFrames: false,
        // Security: Enable sandbox mode
        sandbox: false, // Disabled for now due to IPC requirements
        // Security: Disable web security in development only
        webSecurity: process.env.NODE_ENV !== 'development',
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false,
      icon: process.platform === 'linux' ? path.join(__dirname, '../assets/icon.png') : undefined,
    });

    // Restore maximized state
    if (this.windowState.isMaximized) {
      this.mainWindow.maximize();
    }

    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      // Focus the window on creation
      if (this.mainWindow) {
        this.mainWindow.focus();
      }
    });

    // Save window state on resize and move
    this.mainWindow.on('resize', () => this.saveWindowState());
    this.mainWindow.on('move', () => this.saveWindowState());
    this.mainWindow.on('maximize', () => this.saveWindowState());
    this.mainWindow.on('unmaximize', () => this.saveWindowState());

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  private loadWindowState(): void {
    try {
      // In a real implementation, this would load from a config file or electron-store
      // For now, using defaults
      this.windowState = {
        width: 1200,
        height: 800,
        isMaximized: false
      };
    } catch (error) {
      console.error('Failed to load window state:', error);
    }
  }

  private saveWindowState(): void {
    if (!this.mainWindow) return;

    try {
      const bounds = this.mainWindow.getBounds();
      this.windowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: this.mainWindow.isMaximized()
      };
      
      // In a real implementation, this would save to a config file or electron-store
      console.log('Window state saved:', this.windowState);
    } catch (error) {
      console.error('Failed to save window state:', error);
    }
  }

  private setupMenu(): void {
    const isMac = process.platform === 'darwin';
    
    const template: Electron.MenuItemConstructorOptions[] = [
      // macOS app menu
      ...(isMac ? [{
        label: app.getName(),
        submenu: [
          { role: 'about' as const },
          { type: 'separator' as const },
          {
            label: 'Preferences...',
            accelerator: 'Cmd+,',
            click: () => {
              this.mainWindow?.webContents.send('menu-preferences');
            },
          },
          { type: 'separator' as const },
          { role: 'services' as const },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
          { role: 'quit' as const },
        ],
      }] : []),
      
      // File menu
      {
        label: 'File',
        submenu: [
          {
            label: 'New Note',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-note');
            },
          },
          {
            label: 'New Person',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-person');
            },
          },
          { type: 'separator' },
          {
            label: 'Open...',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              this.mainWindow?.webContents.send('menu-open');
            },
          },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow?.webContents.send('menu-save');
            },
          },
          {
            label: 'Save As...',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => {
              this.mainWindow?.webContents.send('menu-save-as');
            },
          },
          { type: 'separator' },
          {
            label: 'Export...',
            submenu: [
              {
                label: 'Export as PDF',
                click: () => {
                  this.mainWindow?.webContents.send('menu-export-pdf');
                },
              },
              {
                label: 'Export as Markdown',
                click: () => {
                  this.mainWindow?.webContents.send('menu-export-markdown');
                },
              },
              {
                label: 'Export as HTML',
                click: () => {
                  this.mainWindow?.webContents.send('menu-export-html');
                },
              },
            ],
          },
          { type: 'separator' },
          ...(!isMac ? [
            {
              label: 'Preferences...',
              accelerator: 'Ctrl+,',
              click: () => {
                this.mainWindow?.webContents.send('menu-preferences');
              },
            },
            { type: 'separator' as const },
            {
              label: 'Quit',
              accelerator: 'Ctrl+Q',
              click: () => {
                app.quit();
              },
            },
          ] : []),
        ],
      },
      
      // Edit menu
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Find',
            accelerator: 'CmdOrCtrl+F',
            click: () => {
              this.mainWindow?.webContents.send('menu-find');
            },
          },
          {
            label: 'Find and Replace',
            accelerator: 'CmdOrCtrl+H',
            click: () => {
              this.mainWindow?.webContents.send('menu-find-replace');
            },
          },
        ],
      },
      
      // View menu
      {
        label: 'View',
        submenu: [
          {
            label: 'Notes',
            accelerator: 'CmdOrCtrl+1',
            click: () => {
              this.mainWindow?.webContents.send('menu-view-notes');
            },
          },
          {
            label: 'People',
            accelerator: 'CmdOrCtrl+2',
            click: () => {
              this.mainWindow?.webContents.send('menu-view-people');
            },
          },
          {
            label: 'Todos',
            accelerator: 'CmdOrCtrl+3',
            click: () => {
              this.mainWindow?.webContents.send('menu-view-todos');
            },
          },
          {
            label: 'Knowledge Graph',
            accelerator: 'CmdOrCtrl+4',
            click: () => {
              this.mainWindow?.webContents.send('menu-view-graph');
            },
          },
          { type: 'separator' },
          {
            label: 'Toggle Sidebar',
            accelerator: 'CmdOrCtrl+B',
            click: () => {
              this.mainWindow?.webContents.send('menu-toggle-sidebar');
            },
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      
      // Tools menu
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Quick Switcher',
            accelerator: 'CmdOrCtrl+P',
            click: () => {
              this.mainWindow?.webContents.send('menu-quick-switcher');
            },
          },
          {
            label: 'Command Palette',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: () => {
              this.mainWindow?.webContents.send('menu-command-palette');
            },
          },
          { type: 'separator' },
          {
            label: 'Sync Now',
            accelerator: 'CmdOrCtrl+R',
            click: async () => {
              try {
                await this.syncManager.syncAll();
                this.mainWindow?.webContents.send('menu-sync-complete');
              } catch (error) {
                this.mainWindow?.webContents.send('menu-sync-error', error instanceof Error ? error.message : 'Unknown error');
              }
            },
          },
          {
            label: 'Connection Status',
            click: () => {
              this.mainWindow?.webContents.send('menu-connection-status');
            },
          },
        ],
      },
      
      // Window menu
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
          ...(isMac ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const },
          ] : []),
        ],
      },
      
      // Help menu
      {
        role: 'help',
        submenu: [
          {
            label: 'About NoteSage',
            click: () => {
              this.showAboutDialog();
            },
          },
          {
            label: 'Learn More',
            click: () => {
              shell.openExternal('https://notesage.com');
            },
          },
          {
            label: 'Report Issue',
            click: () => {
              shell.openExternal('https://github.com/notesage/desktop/issues');
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private showAboutDialog(): void {
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'About NoteSage',
      message: 'NoteSage Desktop',
      detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
      buttons: ['OK'],
    });
  }

  private setupIPC(): void {
    // Server connection
    ipcMain.handle('connect-to-server', async (event, serverConfig) => {
      try {
        await this.serverConnection.connect(serverConfig);
        return { success: true };
      } catch (error) {
        console.error('Server connection failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('connect-with-profile', async (event, profileId, password) => {
      try {
        await this.serverConnection.connectWithProfile(profileId, password);
        return { success: true };
      } catch (error) {
        console.error('Profile connection failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('switch-profile', async (event, profileId, password) => {
      try {
        await this.serverConnection.switchProfile(profileId, password);
        return { success: true };
      } catch (error) {
        console.error('Profile switch failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('disconnect-from-server', async () => {
      try {
        await this.serverConnection.disconnect();
        return { success: true };
      } catch (error) {
        console.error('Server disconnection failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('get-connection-status', async () => {
      try {
        return this.serverConnection.getStatus();
      } catch (error) {
        console.error('Failed to get connection status:', error);
        return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('test-connection', async () => {
      try {
        return await this.serverConnection.testConnection();
      } catch (error) {
        console.error('Connection test failed:', error);
        return false;
      }
    });

    // Server profile management
    ipcMain.handle('save-server-profile', async (event, profile) => {
      try {
        await this.serverConnection.saveProfile(profile);
        return { success: true };
      } catch (error) {
        console.error('Failed to save profile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('load-server-profiles', async () => {
      try {
        return await this.serverConnection.loadProfiles();
      } catch (error) {
        console.error('Failed to load profiles:', error);
        return [];
      }
    });

    ipcMain.handle('delete-server-profile', async (event, profileId) => {
      try {
        await this.serverConnection.deleteProfile(profileId);
        return { success: true };
      } catch (error) {
        console.error('Failed to delete profile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('get-default-profile', async () => {
      try {
        return await this.serverConnection.getDefaultProfile();
      } catch (error) {
        console.error('Failed to get default profile:', error);
        return null;
      }
    });

    ipcMain.handle('get-current-profile', async () => {
      try {
        return this.serverConnection.getCurrentProfile();
      } catch (error) {
        console.error('Failed to get current profile:', error);
        return null;
      }
    });

    // Sync operations
    ipcMain.handle('sync-data', async () => {
      try {
        const result = await this.syncManager.syncAll();
        return { success: true, result };
      } catch (error) {
        console.error('Sync failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('trigger-sync', async () => {
      try {
        const result = await this.syncManager.syncAll();
        return { 
          success: true, 
          synced: result.synced || 0,
          failed: result.failed || 0,
          conflicts: result.conflicts || 0
        };
      } catch (error) {
        console.error('Manual sync failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('get-sync-status', async () => {
      try {
        return this.syncManager.getSyncStatus();
      } catch (error) {
        console.error('Failed to get sync status:', error);
        return { isRunning: false, conflicts: [] };
      }
    });

    ipcMain.handle('resolve-conflict', async (event, conflictId, resolution) => {
      try {
        await this.syncManager.resolveConflict(conflictId, resolution);
        return { success: true };
      } catch (error) {
        console.error('Failed to resolve conflict:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('set-sync-settings', async (event, settings) => {
      try {
        if (settings.autoSyncEnabled !== undefined) {
          this.syncManager.setAutoSyncEnabled(settings.autoSyncEnabled);
        }
        if (settings.autoSyncInterval !== undefined) {
          this.syncManager.setAutoSyncInterval(settings.autoSyncInterval);
        }
        return { success: true };
      } catch (error) {
        console.error('Failed to set sync settings:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('get-sync-settings', async () => {
      try {
        // Return current sync settings - in a real implementation, these would be stored
        return {
          autoSyncEnabled: true,
          autoSyncInterval: 5 * 60 * 1000, // 5 minutes
        };
      } catch (error) {
        console.error('Failed to get sync settings:', error);
        return { autoSyncEnabled: true, autoSyncInterval: 5 * 60 * 1000 };
      }
    });

    // Offline cache operations
    ipcMain.handle('get-cached-notes', async () => {
      try {
        return await this.offlineCache.getNotes();
      } catch (error) {
        console.error('Failed to get cached notes:', error);
        return [];
      }
    });

    ipcMain.handle('get-cached-people', async () => {
      try {
        return await this.offlineCache.getPeople();
      } catch (error) {
        console.error('Failed to get cached people:', error);
        return [];
      }
    });

    ipcMain.handle('get-cached-todos', async () => {
      try {
        return await this.offlineCache.getTodos();
      } catch (error) {
        console.error('Failed to get cached todos:', error);
        return [];
      }
    });

    ipcMain.handle('cache-note', async (event, note) => {
      try {
        await this.offlineCache.saveNote(note);
        return { success: true };
      } catch (error) {
        console.error('Failed to cache note:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('cache-person', async (event, person) => {
      try {
        await this.offlineCache.savePerson(person);
        return { success: true };
      } catch (error) {
        console.error('Failed to cache person:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('cache-todo', async (event, todo) => {
      try {
        await this.offlineCache.saveTodo(todo);
        return { success: true };
      } catch (error) {
        console.error('Failed to cache todo:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('get-cache-stats', async () => {
      try {
        return await this.offlineCache.getCacheStats();
      } catch (error) {
        console.error('Failed to get cache stats:', error);
        return {
          totalSize: 0,
          noteCount: 0,
          peopleCount: 0,
          todoCount: 0,
          pendingChanges: 0,
          lastCleanup: new Date().toISOString(),
          cacheVersion: '1.0.0',
        };
      }
    });

    ipcMain.handle('clear-cache', async () => {
      try {
        await this.offlineCache.clearCache();
        return { success: true };
      } catch (error) {
        console.error('Failed to clear cache:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('cleanup-cache', async () => {
      try {
        await this.offlineCache.cleanupCache();
        return { success: true };
      } catch (error) {
        console.error('Failed to cleanup cache:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Note management operations
    ipcMain.handle('delete-note', async (event, noteId) => {
      try {
        await this.offlineCache.deleteNote(noteId);
        return { success: true };
      } catch (error) {
        console.error('Failed to delete note:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('archive-note', async (event, noteId, isArchived) => {
      try {
        const note = await this.offlineCache.getNote(noteId);
        if (note) {
          const updatedNote = {
            ...note,
            is_archived: isArchived,
            updated_at: new Date().toISOString(),
          };
          await this.offlineCache.saveNote(updatedNote);
          return { success: true, note: updatedNote };
        }
        return { success: false, error: 'Note not found' };
      } catch (error) {
        console.error('Failed to archive note:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('favorite-note', async (event, noteId, isFavorite) => {
      try {
        const note = await this.offlineCache.getNote(noteId);
        if (note) {
          const updatedNote = {
            ...note,
            is_favorite: isFavorite,
            updated_at: new Date().toISOString(),
          };
          await this.offlineCache.saveNote(updatedNote);
          return { success: true, note: updatedNote };
        }
        return { success: false, error: 'Note not found' };
      } catch (error) {
        console.error('Failed to favorite note:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Export operations
    ipcMain.handle('export-note', async (event, noteId, format, filePath) => {
      try {
        const note = await this.offlineCache.getNote(noteId);
        if (!note) {
          return { success: false, error: 'Note not found' };
        }

        let content = '';
        switch (format) {
          case 'markdown':
            content = `# ${note.title}\n\n${note.content}`;
            break;
          case 'html':
            content = `<!DOCTYPE html>
<html>
<head>
    <title>${note.title}</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
        h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
        pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
        code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>${note.title}</h1>
    <div>${note.content.replace(/\n/g, '<br>')}</div>
    <hr>
    <p><small>Created: ${new Date(note.created_at).toLocaleString()}</small></p>
    <p><small>Modified: ${new Date(note.updated_at).toLocaleString()}</small></p>
</body>
</html>`;
            break;
          case 'pdf':
            // For PDF export, we'll use the HTML content and let the renderer handle PDF generation
            content = note.content;
            break;
          default:
            return { success: false, error: 'Unsupported format' };
        }

        const fs = require('fs').promises;
        await fs.writeFile(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        console.error('Failed to export note:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Window management
    ipcMain.handle('window-minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.handle('window-maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.handle('window-close', () => {
      this.mainWindow?.close();
    });

    // Theme management
    ipcMain.handle('get-theme', () => {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    });

    ipcMain.handle('set-theme', (event, theme: 'light' | 'dark' | 'system') => {
      nativeTheme.themeSource = theme;
    });

    // File operations
    ipcMain.handle('show-save-dialog', async (event, options) => {
      if (!this.mainWindow) return { canceled: true };
      
      try {
        return await dialog.showSaveDialog(this.mainWindow, options);
      } catch (error) {
        console.error('Save dialog failed:', error);
        return { canceled: true };
      }
    });

    ipcMain.handle('show-open-dialog', async (event, options) => {
      if (!this.mainWindow) return { canceled: true };
      
      try {
        return await dialog.showOpenDialog(this.mainWindow, options);
      } catch (error) {
        console.error('Open dialog failed:', error);
        return { canceled: true };
      }
    });

    // App info
    ipcMain.handle('get-app-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('get-app-info', () => {
      return {
        version: app.getVersion(),
        name: app.getName(),
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        node: process.versions.node,
      };
    });

    // Error handling
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.mainWindow?.webContents.send('main-process-error', {
        type: 'uncaughtException',
        message: error.message,
        stack: error.stack,
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.mainWindow?.webContents.send('main-process-error', {
        type: 'unhandledRejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });
  }
}

// Initialize the application
new NoteSageApp();
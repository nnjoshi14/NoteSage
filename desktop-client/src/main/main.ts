import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';
import { ServerConnectionManager } from './server-connection';
import { OfflineCache } from './offline-cache';
import { SyncManager } from './sync-manager';

class NoteSageApp {
  private mainWindow: BrowserWindow | null = null;
  private serverConnection: ServerConnectionManager;
  private offlineCache: OfflineCache;
  private syncManager: SyncManager;

  constructor() {
    this.serverConnection = new ServerConnectionManager();
    this.offlineCache = new OfflineCache();
    this.syncManager = new SyncManager(this.serverConnection, this.offlineCache);
    
    this.setupEventHandlers();
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
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: 'hiddenInset',
      show: false,
    });

    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
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
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow?.webContents.send('menu-save');
            },
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
        ],
      },
      {
        label: 'View',
        submenu: [
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
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIPC(): void {
    // Server connection
    ipcMain.handle('connect-to-server', async (event, serverConfig) => {
      try {
        await this.serverConnection.connect(serverConfig);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('disconnect-from-server', async () => {
      await this.serverConnection.disconnect();
      return { success: true };
    });

    ipcMain.handle('get-connection-status', () => {
      return this.serverConnection.getStatus();
    });

    // Sync operations
    ipcMain.handle('sync-data', async () => {
      try {
        const result = await this.syncManager.syncAll();
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Offline cache operations
    ipcMain.handle('get-cached-notes', async () => {
      return await this.offlineCache.getNotes();
    });

    ipcMain.handle('cache-note', async (event, note) => {
      await this.offlineCache.saveNote(note);
      return { success: true };
    });
  }
}

// Initialize the application
new NoteSageApp();
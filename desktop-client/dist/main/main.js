"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const server_connection_1 = require("./server-connection");
const offline_cache_1 = require("./offline-cache");
const sync_manager_1 = require("./sync-manager");
// Security: Disable node integration and enable context isolation by default
electron_1.app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
class NoteSageApp {
    constructor() {
        this.mainWindow = null;
        this.windowState = {
            width: 1200,
            height: 800,
            isMaximized: false
        };
        this.serverConnection = new server_connection_1.ServerConnectionManager();
        this.offlineCache = new offline_cache_1.OfflineCache();
        this.syncManager = new sync_manager_1.SyncManager(this.serverConnection, this.offlineCache);
        this.setupSecurityPolicies();
        this.setupEventHandlers();
    }
    setupSecurityPolicies() {
        // Security: Prevent new window creation
        electron_1.app.on('web-contents-created', (event, contents) => {
            contents.setWindowOpenHandler(({ url }) => {
                electron_1.shell.openExternal(url);
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
        electron_1.app.on('web-contents-created', (event, contents) => {
            contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
                const allowedPermissions = ['clipboard-read', 'clipboard-write'];
                callback(allowedPermissions.includes(permission));
            });
        });
    }
    setupEventHandlers() {
        electron_1.app.whenReady().then(() => {
            this.createWindow();
            this.setupMenu();
            this.setupIPC();
            electron_1.app.on('activate', () => {
                if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow();
                }
            });
        });
        electron_1.app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                electron_1.app.quit();
            }
        });
    }
    createWindow() {
        // Restore window state
        this.loadWindowState();
        this.mainWindow = new electron_1.BrowserWindow({
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
        }
        else {
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
            electron_1.shell.openExternal(url);
            return { action: 'deny' };
        });
    }
    loadWindowState() {
        try {
            // In a real implementation, this would load from a config file or electron-store
            // For now, using defaults
            this.windowState = {
                width: 1200,
                height: 800,
                isMaximized: false
            };
        }
        catch (error) {
            console.error('Failed to load window state:', error);
        }
    }
    saveWindowState() {
        if (!this.mainWindow)
            return;
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
        }
        catch (error) {
            console.error('Failed to save window state:', error);
        }
    }
    setupMenu() {
        const isMac = process.platform === 'darwin';
        const template = [
            // macOS app menu
            ...(isMac ? [{
                    label: electron_1.app.getName(),
                    submenu: [
                        { role: 'about' },
                        { type: 'separator' },
                        {
                            label: 'Preferences...',
                            accelerator: 'Cmd+,',
                            click: () => {
                                this.mainWindow?.webContents.send('menu-preferences');
                            },
                        },
                        { type: 'separator' },
                        { role: 'services' },
                        { type: 'separator' },
                        { role: 'hide' },
                        { role: 'hideOthers' },
                        { role: 'unhide' },
                        { type: 'separator' },
                        { role: 'quit' },
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
                        { type: 'separator' },
                        {
                            label: 'Quit',
                            accelerator: 'Ctrl+Q',
                            click: () => {
                                electron_1.app.quit();
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
                            }
                            catch (error) {
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
                        { type: 'separator' },
                        { role: 'front' },
                        { type: 'separator' },
                        { role: 'window' },
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
                            electron_1.shell.openExternal('https://notesage.com');
                        },
                    },
                    {
                        label: 'Report Issue',
                        click: () => {
                            electron_1.shell.openExternal('https://github.com/notesage/desktop/issues');
                        },
                    },
                ],
            },
        ];
        const menu = electron_1.Menu.buildFromTemplate(template);
        electron_1.Menu.setApplicationMenu(menu);
    }
    showAboutDialog() {
        electron_1.dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'About NoteSage',
            message: 'NoteSage Desktop',
            detail: `Version: ${electron_1.app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
            buttons: ['OK'],
        });
    }
    setupIPC() {
        // Server connection
        electron_1.ipcMain.handle('connect-to-server', async (event, serverConfig) => {
            try {
                await this.serverConnection.connect(serverConfig);
                return { success: true };
            }
            catch (error) {
                console.error('Server connection failed:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('connect-with-profile', async (event, profileId, password) => {
            try {
                await this.serverConnection.connectWithProfile(profileId, password);
                return { success: true };
            }
            catch (error) {
                console.error('Profile connection failed:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('switch-profile', async (event, profileId, password) => {
            try {
                await this.serverConnection.switchProfile(profileId, password);
                return { success: true };
            }
            catch (error) {
                console.error('Profile switch failed:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('disconnect-from-server', async () => {
            try {
                await this.serverConnection.disconnect();
                return { success: true };
            }
            catch (error) {
                console.error('Server disconnection failed:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('get-connection-status', async () => {
            try {
                return this.serverConnection.getStatus();
            }
            catch (error) {
                console.error('Failed to get connection status:', error);
                return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('test-connection', async () => {
            try {
                return await this.serverConnection.testConnection();
            }
            catch (error) {
                console.error('Connection test failed:', error);
                return false;
            }
        });
        // Server profile management
        electron_1.ipcMain.handle('save-server-profile', async (event, profile) => {
            try {
                await this.serverConnection.saveProfile(profile);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to save profile:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('load-server-profiles', async () => {
            try {
                return await this.serverConnection.loadProfiles();
            }
            catch (error) {
                console.error('Failed to load profiles:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('delete-server-profile', async (event, profileId) => {
            try {
                await this.serverConnection.deleteProfile(profileId);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to delete profile:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('get-default-profile', async () => {
            try {
                return await this.serverConnection.getDefaultProfile();
            }
            catch (error) {
                console.error('Failed to get default profile:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('get-current-profile', async () => {
            try {
                return this.serverConnection.getCurrentProfile();
            }
            catch (error) {
                console.error('Failed to get current profile:', error);
                return null;
            }
        });
        // Sync operations
        electron_1.ipcMain.handle('sync-data', async () => {
            try {
                const result = await this.syncManager.syncAll();
                return { success: true, result };
            }
            catch (error) {
                console.error('Sync failed:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('get-sync-status', async () => {
            try {
                return this.syncManager.getSyncStatus();
            }
            catch (error) {
                console.error('Failed to get sync status:', error);
                return { isRunning: false, conflicts: [] };
            }
        });
        electron_1.ipcMain.handle('resolve-conflict', async (event, conflictId, resolution) => {
            try {
                await this.syncManager.resolveConflict(conflictId, resolution);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to resolve conflict:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('set-sync-settings', async (event, settings) => {
            try {
                if (settings.autoSyncEnabled !== undefined) {
                    this.syncManager.setAutoSyncEnabled(settings.autoSyncEnabled);
                }
                if (settings.autoSyncInterval !== undefined) {
                    this.syncManager.setAutoSyncInterval(settings.autoSyncInterval);
                }
                return { success: true };
            }
            catch (error) {
                console.error('Failed to set sync settings:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('get-sync-settings', async () => {
            try {
                // Return current sync settings - in a real implementation, these would be stored
                return {
                    autoSyncEnabled: true,
                    autoSyncInterval: 5 * 60 * 1000, // 5 minutes
                };
            }
            catch (error) {
                console.error('Failed to get sync settings:', error);
                return { autoSyncEnabled: true, autoSyncInterval: 5 * 60 * 1000 };
            }
        });
        // Offline cache operations
        electron_1.ipcMain.handle('get-cached-notes', async () => {
            try {
                return await this.offlineCache.getNotes();
            }
            catch (error) {
                console.error('Failed to get cached notes:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('get-cached-people', async () => {
            try {
                return await this.offlineCache.getPeople();
            }
            catch (error) {
                console.error('Failed to get cached people:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('get-cached-todos', async () => {
            try {
                return await this.offlineCache.getTodos();
            }
            catch (error) {
                console.error('Failed to get cached todos:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('cache-note', async (event, note) => {
            try {
                await this.offlineCache.saveNote(note);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to cache note:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('cache-person', async (event, person) => {
            try {
                await this.offlineCache.savePerson(person);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to cache person:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('cache-todo', async (event, todo) => {
            try {
                await this.offlineCache.saveTodo(todo);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to cache todo:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('get-cache-stats', async () => {
            try {
                return await this.offlineCache.getCacheStats();
            }
            catch (error) {
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
        electron_1.ipcMain.handle('clear-cache', async () => {
            try {
                await this.offlineCache.clearCache();
                return { success: true };
            }
            catch (error) {
                console.error('Failed to clear cache:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('cleanup-cache', async () => {
            try {
                await this.offlineCache.cleanupCache();
                return { success: true };
            }
            catch (error) {
                console.error('Failed to cleanup cache:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        // Window management
        electron_1.ipcMain.handle('window-minimize', () => {
            this.mainWindow?.minimize();
        });
        electron_1.ipcMain.handle('window-maximize', () => {
            if (this.mainWindow?.isMaximized()) {
                this.mainWindow.unmaximize();
            }
            else {
                this.mainWindow?.maximize();
            }
        });
        electron_1.ipcMain.handle('window-close', () => {
            this.mainWindow?.close();
        });
        // Theme management
        electron_1.ipcMain.handle('get-theme', () => {
            return electron_1.nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
        });
        electron_1.ipcMain.handle('set-theme', (event, theme) => {
            electron_1.nativeTheme.themeSource = theme;
        });
        // File operations
        electron_1.ipcMain.handle('show-save-dialog', async (event, options) => {
            if (!this.mainWindow)
                return { canceled: true };
            try {
                return await electron_1.dialog.showSaveDialog(this.mainWindow, options);
            }
            catch (error) {
                console.error('Save dialog failed:', error);
                return { canceled: true };
            }
        });
        electron_1.ipcMain.handle('show-open-dialog', async (event, options) => {
            if (!this.mainWindow)
                return { canceled: true };
            try {
                return await electron_1.dialog.showOpenDialog(this.mainWindow, options);
            }
            catch (error) {
                console.error('Open dialog failed:', error);
                return { canceled: true };
            }
        });
        // App info
        electron_1.ipcMain.handle('get-app-version', () => {
            return electron_1.app.getVersion();
        });
        electron_1.ipcMain.handle('get-app-info', () => {
            return {
                version: electron_1.app.getVersion(),
                name: electron_1.app.getName(),
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

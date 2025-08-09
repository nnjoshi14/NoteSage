"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Validate IPC channels to prevent security issues
const validChannels = [
    'menu-new-note',
    'menu-new-person',
    'menu-save',
    'menu-save-as',
    'menu-open',
    'menu-export-pdf',
    'menu-export-markdown',
    'menu-export-html',
    'menu-preferences',
    'menu-find',
    'menu-find-replace',
    'menu-view-notes',
    'menu-view-people',
    'menu-view-todos',
    'menu-view-graph',
    'menu-toggle-sidebar',
    'menu-quick-switcher',
    'menu-command-palette',
    'menu-sync-complete',
    'menu-sync-error',
    'menu-connection-status',
    'main-process-error',
    'sync-progress',
    'sync-complete',
    'sync-error',
    'conflict-detected',
    'connection-status-changed',
];
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Server connection
    connectToServer: (serverConfig) => electron_1.ipcRenderer.invoke('connect-to-server', serverConfig),
    connectWithProfile: (profileId, password) => electron_1.ipcRenderer.invoke('connect-with-profile', profileId, password),
    switchProfile: (profileId, password) => electron_1.ipcRenderer.invoke('switch-profile', profileId, password),
    disconnectFromServer: () => electron_1.ipcRenderer.invoke('disconnect-from-server'),
    getConnectionStatus: () => electron_1.ipcRenderer.invoke('get-connection-status'),
    testConnection: () => electron_1.ipcRenderer.invoke('test-connection'),
    // Server profile management
    saveServerProfile: (profile) => electron_1.ipcRenderer.invoke('save-server-profile', profile),
    loadServerProfiles: () => electron_1.ipcRenderer.invoke('load-server-profiles'),
    deleteServerProfile: (profileId) => electron_1.ipcRenderer.invoke('delete-server-profile', profileId),
    getDefaultProfile: () => electron_1.ipcRenderer.invoke('get-default-profile'),
    getCurrentProfile: () => electron_1.ipcRenderer.invoke('get-current-profile'),
    // Sync operations
    syncData: () => electron_1.ipcRenderer.invoke('sync-data'),
    getSyncStatus: () => electron_1.ipcRenderer.invoke('get-sync-status'),
    resolveConflict: (conflictId, resolution) => electron_1.ipcRenderer.invoke('resolve-conflict', conflictId, resolution),
    setSyncSettings: (settings) => electron_1.ipcRenderer.invoke('set-sync-settings', settings),
    getSyncSettings: () => electron_1.ipcRenderer.invoke('get-sync-settings'),
    // Offline cache
    getCachedNotes: () => electron_1.ipcRenderer.invoke('get-cached-notes'),
    getCachedPeople: () => electron_1.ipcRenderer.invoke('get-cached-people'),
    getCachedTodos: () => electron_1.ipcRenderer.invoke('get-cached-todos'),
    cacheNote: (note) => electron_1.ipcRenderer.invoke('cache-note', note),
    cachePerson: (person) => electron_1.ipcRenderer.invoke('cache-person', person),
    cacheTodo: (todo) => electron_1.ipcRenderer.invoke('cache-todo', todo),
    getCacheStats: () => electron_1.ipcRenderer.invoke('get-cache-stats'),
    clearCache: () => electron_1.ipcRenderer.invoke('clear-cache'),
    cleanupCache: () => electron_1.ipcRenderer.invoke('cleanup-cache'),
    // Window management
    windowMinimize: () => electron_1.ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => electron_1.ipcRenderer.invoke('window-maximize'),
    windowClose: () => electron_1.ipcRenderer.invoke('window-close'),
    // Theme management
    getTheme: () => electron_1.ipcRenderer.invoke('get-theme'),
    setTheme: (theme) => electron_1.ipcRenderer.invoke('set-theme', theme),
    // File operations
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('show-open-dialog', options),
    // App info
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getAppInfo: () => electron_1.ipcRenderer.invoke('get-app-info'),
    // Menu events with validation
    onMenuEvent: (channel, callback) => {
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.on(channel, callback);
        }
        else {
            console.warn(`Invalid channel: ${channel}`);
        }
    },
    // Remove listeners with validation
    removeAllListeners: (channel) => {
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.removeAllListeners(channel);
        }
        else {
            console.warn(`Invalid channel: ${channel}`);
        }
    },
    // Remove specific listener
    removeListener: (channel, callback) => {
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.removeListener(channel, callback);
        }
        else {
            console.warn(`Invalid channel: ${channel}`);
        }
    },
    // Platform info
    platform: process.platform,
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
});

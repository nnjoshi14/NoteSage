import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for better type safety
export interface ServerProfile {
  id: string;
  name: string;
  url: string;
  port: number;
  username: string;
  isDefault?: boolean;
  lastUsed?: Date;
  apiVersion?: string;
}

export interface ServerConfig extends ServerProfile {
  password: string;
}

export interface AppInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
  electron: string;
  node: string;
}

export interface DialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface MainProcessError {
  type: 'uncaughtException' | 'unhandledRejection';
  message: string;
  stack?: string;
}

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
contextBridge.exposeInMainWorld('electronAPI', {
  // Server connection
  connectToServer: (serverConfig: ServerConfig) => 
    ipcRenderer.invoke('connect-to-server', serverConfig),
  connectWithProfile: (profileId: string, password?: string) =>
    ipcRenderer.invoke('connect-with-profile', profileId, password),
  switchProfile: (profileId: string, password?: string) =>
    ipcRenderer.invoke('switch-profile', profileId, password),
  disconnectFromServer: () => 
    ipcRenderer.invoke('disconnect-from-server'),
  getConnectionStatus: () => 
    ipcRenderer.invoke('get-connection-status'),
  testConnection: () =>
    ipcRenderer.invoke('test-connection'),

  // Server profile management
  saveServerProfile: (profile: ServerProfile) =>
    ipcRenderer.invoke('save-server-profile', profile),
  loadServerProfiles: () =>
    ipcRenderer.invoke('load-server-profiles'),
  deleteServerProfile: (profileId: string) =>
    ipcRenderer.invoke('delete-server-profile', profileId),
  getDefaultProfile: () =>
    ipcRenderer.invoke('get-default-profile'),
  getCurrentProfile: () =>
    ipcRenderer.invoke('get-current-profile'),

  // Sync operations
  syncData: () => 
    ipcRenderer.invoke('sync-data'),
  getSyncStatus: () =>
    ipcRenderer.invoke('get-sync-status'),
  resolveConflict: (conflictId: string, resolution: any) =>
    ipcRenderer.invoke('resolve-conflict', conflictId, resolution),
  setSyncSettings: (settings: any) =>
    ipcRenderer.invoke('set-sync-settings', settings),
  getSyncSettings: () =>
    ipcRenderer.invoke('get-sync-settings'),

  // Offline cache
  getCachedNotes: () => 
    ipcRenderer.invoke('get-cached-notes'),
  getCachedPeople: () =>
    ipcRenderer.invoke('get-cached-people'),
  getCachedTodos: () =>
    ipcRenderer.invoke('get-cached-todos'),
  cacheNote: (note: any) => 
    ipcRenderer.invoke('cache-note', note),
  cachePerson: (person: any) =>
    ipcRenderer.invoke('cache-person', person),
  cacheTodo: (todo: any) =>
    ipcRenderer.invoke('cache-todo', todo),
  getCacheStats: () =>
    ipcRenderer.invoke('get-cache-stats'),
  clearCache: () =>
    ipcRenderer.invoke('clear-cache'),
  cleanupCache: () =>
    ipcRenderer.invoke('cleanup-cache'),
  triggerSync: () =>
    ipcRenderer.invoke('trigger-sync'),

  // Note management
  deleteNote: (noteId: string) =>
    ipcRenderer.invoke('delete-note', noteId),
  archiveNote: (noteId: string, isArchived: boolean) =>
    ipcRenderer.invoke('archive-note', noteId, isArchived),
  favoriteNote: (noteId: string, isFavorite: boolean) =>
    ipcRenderer.invoke('favorite-note', noteId, isFavorite),
  exportNote: (noteId: string, format: string, filePath: string) =>
    ipcRenderer.invoke('export-note', noteId, format, filePath),

  // Window management
  windowMinimize: () => 
    ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => 
    ipcRenderer.invoke('window-maximize'),
  windowClose: () => 
    ipcRenderer.invoke('window-close'),

  // Theme management
  getTheme: () => 
    ipcRenderer.invoke('get-theme'),
  setTheme: (theme: 'light' | 'dark' | 'system') => 
    ipcRenderer.invoke('set-theme', theme),

  // File operations
  showSaveDialog: (options: DialogOptions) => 
    ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: DialogOptions) => 
    ipcRenderer.invoke('show-open-dialog', options),

  // App info
  getAppVersion: () => 
    ipcRenderer.invoke('get-app-version'),
  getAppInfo: () => 
    ipcRenderer.invoke('get-app-info'),

  // Menu events with validation
  onMenuEvent: (channel: string, callback: (...args: any[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    } else {
      console.warn(`Invalid channel: ${channel}`);
    }
  },

  // Remove listeners with validation
  removeAllListeners: (channel: string) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      console.warn(`Invalid channel: ${channel}`);
    }
  },

  // Remove specific listener
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    } else {
      console.warn(`Invalid channel: ${channel}`);
    }
  },

  // Platform info
  platform: process.platform,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      // Server connection
      connectToServer: (serverConfig: ServerConfig) => Promise<{ success: boolean; error?: string }>;
      connectWithProfile: (profileId: string, password?: string) => Promise<{ success: boolean; error?: string }>;
      switchProfile: (profileId: string, password?: string) => Promise<{ success: boolean; error?: string }>;
      disconnectFromServer: () => Promise<{ success: boolean; error?: string }>;
      getConnectionStatus: () => Promise<any>;
      testConnection: () => Promise<boolean>;

      // Server profile management
      saveServerProfile: (profile: ServerProfile) => Promise<{ success: boolean; error?: string }>;
      loadServerProfiles: () => Promise<ServerProfile[]>;
      deleteServerProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
      getDefaultProfile: () => Promise<ServerProfile | null>;
      getCurrentProfile: () => Promise<ServerProfile | null>;

      // Sync operations
      syncData: () => Promise<{ success: boolean; result?: any; error?: string }>;
      getSyncStatus: () => Promise<any>;
      resolveConflict: (conflictId: string, resolution: any) => Promise<{ success: boolean; error?: string }>;
      setSyncSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
      getSyncSettings: () => Promise<any>;

      // Offline cache
      getCachedNotes: () => Promise<any[]>;
      getCachedPeople: () => Promise<any[]>;
      getCachedTodos: () => Promise<any[]>;
      cacheNote: (note: any) => Promise<{ success: boolean; error?: string }>;
      cachePerson: (person: any) => Promise<{ success: boolean; error?: string }>;
      cacheTodo: (todo: any) => Promise<{ success: boolean; error?: string }>;
      getCacheStats: () => Promise<any>;
      clearCache: () => Promise<{ success: boolean; error?: string }>;
      cleanupCache: () => Promise<{ success: boolean; error?: string }>;
      triggerSync: () => Promise<{ success: boolean; synced?: number; failed?: number; conflicts?: number; error?: string }>;

      // Note management
      deleteNote: (noteId: string) => Promise<{ success: boolean; error?: string }>;
      archiveNote: (noteId: string, isArchived: boolean) => Promise<{ success: boolean; note?: any; error?: string }>;
      favoriteNote: (noteId: string, isFavorite: boolean) => Promise<{ success: boolean; note?: any; error?: string }>;
      exportNote: (noteId: string, format: string, filePath: string) => Promise<{ success: boolean; error?: string }>;

      // Window management
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;

      // Theme management
      getTheme: () => Promise<'light' | 'dark'>;
      setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;

      // File operations
      showSaveDialog: (options: DialogOptions) => Promise<{ canceled: boolean; filePath?: string }>;
      showOpenDialog: (options: DialogOptions) => Promise<{ canceled: boolean; filePaths?: string[] }>;

      // App info
      getAppVersion: () => Promise<string>;
      getAppInfo: () => Promise<AppInfo>;

      // Event handling
      onMenuEvent: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;

      // Platform info
      platform: string;
      isWindows: boolean;
      isMac: boolean;
      isLinux: boolean;
    };
  }
}
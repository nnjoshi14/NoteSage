import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Server connection
  connectToServer: (serverConfig: any) => ipcRenderer.invoke('connect-to-server', serverConfig),
  disconnectFromServer: () => ipcRenderer.invoke('disconnect-from-server'),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),

  // Sync operations
  syncData: () => ipcRenderer.invoke('sync-data'),

  // Offline cache
  getCachedNotes: () => ipcRenderer.invoke('get-cached-notes'),
  cacheNote: (note: any) => ipcRenderer.invoke('cache-note', note),

  // Menu events
  onMenuNewNote: (callback: () => void) => ipcRenderer.on('menu-new-note', callback),
  onMenuSave: (callback: () => void) => ipcRenderer.on('menu-save', callback),

  // Remove listeners
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      connectToServer: (serverConfig: any) => Promise<{ success: boolean; error?: string }>;
      disconnectFromServer: () => Promise<{ success: boolean }>;
      getConnectionStatus: () => Promise<any>;
      syncData: () => Promise<{ success: boolean; result?: any; error?: string }>;
      getCachedNotes: () => Promise<any[]>;
      cacheNote: (note: any) => Promise<{ success: boolean }>;
      onMenuNewNote: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
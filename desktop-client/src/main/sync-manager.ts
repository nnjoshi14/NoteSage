import { ServerConnectionManager } from './server-connection';
import { OfflineCache, CachedNote } from './offline-cache';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  error?: string;
}

export class SyncManager {
  constructor(
    private serverConnection: ServerConnectionManager,
    private offlineCache: OfflineCache
  ) {}

  async syncAll(): Promise<SyncResult> {
    if (!this.serverConnection.isConnected()) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        error: 'Not connected to server',
      };
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
    };

    try {
      // Sync notes
      const notesResult = await this.syncNotes();
      result.synced += notesResult.synced;
      result.failed += notesResult.failed;
      result.conflicts += notesResult.conflicts;

      // Process offline queue
      const queueResult = await this.processOfflineQueue();
      result.synced += queueResult.synced;
      result.failed += queueResult.failed;

      return result;
    } catch (error) {
      return {
        success: false,
        synced: result.synced,
        failed: result.failed,
        conflicts: result.conflicts,
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  private async syncNotes(): Promise<SyncResult> {
    const client = this.serverConnection.getClient();
    if (!client) {
      throw new Error('No server connection');
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
    };

    try {
      // Get server notes
      const response = await client.get('/api/notes');
      const serverNotes = response.data;

      // Get cached notes
      const cachedNotes = await this.offlineCache.getNotes();

      // Sync server notes to cache
      for (const serverNote of serverNotes) {
        const cachedNote = cachedNotes.find(n => n.id === serverNote.id);
        
        if (!cachedNote) {
          // New note from server
          await this.offlineCache.saveNote({
            ...serverNote,
            sync_status: 'synced',
          });
          result.synced++;
        } else if (serverNote.version > cachedNote.version) {
          // Server version is newer
          if (cachedNote.sync_status === 'pending') {
            // Conflict: both local and server have changes
            await this.handleConflict(cachedNote, serverNote);
            result.conflicts++;
          } else {
            // Update from server
            await this.offlineCache.saveNote({
              ...serverNote,
              sync_status: 'synced',
            });
            result.synced++;
          }
        }
      }

      // Upload pending local changes
      const pendingNotes = cachedNotes.filter(n => n.sync_status === 'pending');
      for (const note of pendingNotes) {
        try {
          const serverNote = serverNotes.find(n => n.id === note.id);
          
          if (serverNote) {
            // Update existing note
            const response = await client.put(`/api/notes/${note.id}`, {
              title: note.title,
              content: note.content,
              category: note.category,
              tags: note.tags,
              folder_path: note.folder_path,
              is_archived: note.is_archived,
              is_pinned: note.is_pinned,
              is_favorite: note.is_favorite,
            });
            
            await this.offlineCache.saveNote({
              ...response.data,
              sync_status: 'synced',
            });
          } else {
            // Create new note
            const response = await client.post('/api/notes', {
              title: note.title,
              content: note.content,
              category: note.category,
              tags: note.tags,
              folder_path: note.folder_path,
            });
            
            // Update local note with server ID and data
            await this.offlineCache.deleteNote(note.id);
            await this.offlineCache.saveNote({
              ...response.data,
              sync_status: 'synced',
            });
          }
          
          result.synced++;
        } catch (error) {
          console.error('Failed to sync note:', note.id, error);
          result.failed++;
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Notes sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleConflict(localNote: CachedNote, serverNote: any): Promise<void> {
    // Simple conflict resolution: keep server version and mark local as conflict
    // In a real implementation, you might want to show a UI for user to resolve
    
    // For now, we'll keep the server version and save the local version with a different ID
    const conflictNote = {
      ...localNote,
      id: `${localNote.id}-conflict-${Date.now()}`,
      title: `${localNote.title} (Local Conflict)`,
      sync_status: 'conflict' as const,
    };
    
    await this.offlineCache.saveNote(conflictNote);
    await this.offlineCache.saveNote({
      ...serverNote,
      sync_status: 'synced',
    });
  }

  private async processOfflineQueue(): Promise<SyncResult> {
    const client = this.serverConnection.getClient();
    if (!client) {
      throw new Error('No server connection');
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
    };

    const queue = await this.offlineCache.getOfflineQueue();

    for (const item of queue) {
      try {
        const data = JSON.parse(item.data);
        
        switch (item.operation) {
          case 'create':
            await client.post(`/api/${item.table_name}`, data);
            break;
          case 'update':
            await client.put(`/api/${item.table_name}/${item.record_id}`, data);
            break;
          case 'delete':
            await client.delete(`/api/${item.table_name}/${item.record_id}`);
            break;
        }
        
        await this.offlineCache.removeFromOfflineQueue(item.id);
        result.synced++;
      } catch (error) {
        console.error('Failed to process queue item:', item.id, error);
        result.failed++;
      }
    }

    return result;
  }

  async forcePushLocalChanges(): Promise<SyncResult> {
    // Force push all local changes to server, overwriting server data
    const client = this.serverConnection.getClient();
    if (!client) {
      throw new Error('No server connection');
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
    };

    const pendingChanges = await this.offlineCache.getPendingChanges();

    for (const change of pendingChanges) {
      try {
        switch (change.table) {
          case 'notes':
            await client.put(`/api/notes/${change.id}`, change);
            break;
          case 'people':
            await client.put(`/api/people/${change.id}`, change);
            break;
          case 'todos':
            await client.put(`/api/todos/${change.id}`, change);
            break;
        }
        result.synced++;
      } catch (error) {
        console.error('Failed to force push change:', change.id, error);
        result.failed++;
      }
    }

    return result;
  }

  async pullFromServer(): Promise<SyncResult> {
    // Pull all data from server, overwriting local changes
    const client = this.serverConnection.getClient();
    if (!client) {
      throw new Error('No server connection');
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
    };

    try {
      // Pull notes
      const notesResponse = await client.get('/api/notes');
      for (const note of notesResponse.data) {
        await this.offlineCache.saveNote({
          ...note,
          sync_status: 'synced',
        });
        result.synced++;
      }

      // Clear offline queue since we're overwriting everything
      await this.offlineCache.clearOfflineQueue();

      return result;
    } catch (error) {
      throw new Error(`Pull from server failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
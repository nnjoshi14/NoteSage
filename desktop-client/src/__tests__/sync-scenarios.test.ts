import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from '../main/sync-manager';
import { OfflineCache } from '../main/offline-cache';
import { ServerConnection } from '../main/server-connection';

// Mock dependencies
vi.mock('../main/offline-cache');
vi.mock('../main/server-connection');

describe('Offline/Online Synchronization Scenarios', () => {
  let syncManager: SyncManager;
  let mockOfflineCache: jest.Mocked<OfflineCache>;
  let mockServerConnection: jest.Mocked<ServerConnection>;

  beforeEach(() => {
    mockOfflineCache = new OfflineCache() as jest.Mocked<OfflineCache>;
    mockServerConnection = new ServerConnection({} as any) as jest.Mocked<ServerConnection>;
    syncManager = new SyncManager(mockOfflineCache, mockServerConnection);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Operations', () => {
    it('should queue note creation when offline', async () => {
      // Simulate offline state
      mockServerConnection.isConnected.mockReturnValue(false);
      mockOfflineCache.createNote.mockResolvedValue({
        id: 'local-1',
        title: 'Offline Note',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const note = {
        title: 'Offline Note',
        content: { type: 'doc', content: [] },
      };

      const result = await syncManager.createNote(note);

      expect(result.id).toBe('local-1');
      expect(mockOfflineCache.createNote).toHaveBeenCalledWith(note);
      expect(mockOfflineCache.queueOperation).toHaveBeenCalledWith({
        type: 'create',
        table: 'notes',
        data: expect.objectContaining(note),
      });
    });

    it('should queue note updates when offline', async () => {
      mockServerConnection.isConnected.mockReturnValue(false);
      mockOfflineCache.updateNote.mockResolvedValue({
        id: 'note-1',
        title: 'Updated Offline Note',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updates = { title: 'Updated Offline Note' };
      const result = await syncManager.updateNote('note-1', updates);

      expect(result.title).toBe('Updated Offline Note');
      expect(mockOfflineCache.updateNote).toHaveBeenCalledWith('note-1', updates);
      expect(mockOfflineCache.queueOperation).toHaveBeenCalledWith({
        type: 'update',
        table: 'notes',
        id: 'note-1',
        data: updates,
      });
    });

    it('should queue note deletion when offline', async () => {
      mockServerConnection.isConnected.mockReturnValue(false);
      mockOfflineCache.deleteNote.mockResolvedValue(true);

      await syncManager.deleteNote('note-1');

      expect(mockOfflineCache.deleteNote).toHaveBeenCalledWith('note-1');
      expect(mockOfflineCache.queueOperation).toHaveBeenCalledWith({
        type: 'delete',
        table: 'notes',
        id: 'note-1',
      });
    });
  });

  describe('Online Operations', () => {
    it('should sync to server immediately when online', async () => {
      mockServerConnection.isConnected.mockReturnValue(true);
      mockServerConnection.createNote.mockResolvedValue({
        id: 'server-1',
        title: 'Online Note',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const note = {
        title: 'Online Note',
        content: { type: 'doc', content: [] },
      };

      const result = await syncManager.createNote(note);

      expect(result.id).toBe('server-1');
      expect(mockServerConnection.createNote).toHaveBeenCalledWith(note);
      expect(mockOfflineCache.createNote).toHaveBeenCalledWith(result);
    });

    it('should fallback to offline queue if server request fails', async () => {
      mockServerConnection.isConnected.mockReturnValue(true);
      mockServerConnection.createNote.mockRejectedValue(new Error('Server error'));
      mockOfflineCache.createNote.mockResolvedValue({
        id: 'local-1',
        title: 'Fallback Note',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const note = {
        title: 'Fallback Note',
        content: { type: 'doc', content: [] },
      };

      const result = await syncManager.createNote(note);

      expect(result.id).toBe('local-1');
      expect(mockOfflineCache.createNote).toHaveBeenCalledWith(note);
      expect(mockOfflineCache.queueOperation).toHaveBeenCalled();
    });
  });

  describe('Synchronization Process', () => {
    it('should sync all queued operations when coming back online', async () => {
      const queuedOperations = [
        {
          id: 1,
          type: 'create',
          table: 'notes',
          data: { title: 'Queued Note 1', content: { type: 'doc', content: [] } },
        },
        {
          id: 2,
          type: 'update',
          table: 'notes',
          id: 'note-2',
          data: { title: 'Updated Note 2' },
        },
        {
          id: 3,
          type: 'delete',
          table: 'notes',
          id: 'note-3',
        },
      ];

      mockOfflineCache.getQueuedOperations.mockResolvedValue(queuedOperations);
      mockServerConnection.isConnected.mockReturnValue(true);
      mockServerConnection.createNote.mockResolvedValue({
        id: 'server-1',
        title: 'Queued Note 1',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockServerConnection.updateNote.mockResolvedValue({
        id: 'note-2',
        title: 'Updated Note 2',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockServerConnection.deleteNote.mockResolvedValue(true);

      const result = await syncManager.syncPendingOperations();

      expect(result.synced).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(mockServerConnection.createNote).toHaveBeenCalledTimes(1);
      expect(mockServerConnection.updateNote).toHaveBeenCalledTimes(1);
      expect(mockServerConnection.deleteNote).toHaveBeenCalledTimes(1);
    });

    it('should handle sync conflicts gracefully', async () => {
      const conflictOperation = {
        id: 1,
        type: 'update',
        table: 'notes',
        id: 'note-1',
        data: { title: 'Local Update', updatedAt: new Date('2024-01-01') },
      };

      mockOfflineCache.getQueuedOperations.mockResolvedValue([conflictOperation]);
      mockServerConnection.isConnected.mockReturnValue(true);
      
      const conflictError = new Error('Conflict');
      (conflictError as any).status = 409;
      (conflictError as any).remoteData = {
        id: 'note-1',
        title: 'Server Update',
        updatedAt: new Date('2024-01-02'),
      };
      
      mockServerConnection.updateNote.mockRejectedValue(conflictError);

      // Mock user choosing to keep server version
      vi.spyOn(syncManager, 'resolveConflict').mockResolvedValue('keep_remote');

      const result = await syncManager.syncPendingOperations();

      expect(result.conflicts).toBe(1);
      expect(mockOfflineCache.updateNote).toHaveBeenCalledWith('note-1', {
        id: 'note-1',
        title: 'Server Update',
        updatedAt: new Date('2024-01-02'),
      });
    });

    it('should handle partial sync failures', async () => {
      const operations = [
        {
          id: 1,
          type: 'create',
          table: 'notes',
          data: { title: 'Success Note', content: { type: 'doc', content: [] } },
        },
        {
          id: 2,
          type: 'create',
          table: 'notes',
          data: { title: 'Fail Note', content: { type: 'doc', content: [] } },
        },
      ];

      mockOfflineCache.getQueuedOperations.mockResolvedValue(operations);
      mockServerConnection.isConnected.mockReturnValue(true);
      
      mockServerConnection.createNote
        .mockResolvedValueOnce({
          id: 'server-1',
          title: 'Success Note',
          content: { type: 'doc', content: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockRejectedValueOnce(new Error('Server error'));

      const result = await syncManager.syncPendingOperations();

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.conflicts).toBe(0);
    });
  });

  describe('Connection State Changes', () => {
    it('should automatically sync when connection is restored', async () => {
      const syncSpy = vi.spyOn(syncManager, 'syncPendingOperations');
      
      // Simulate connection restored event
      mockServerConnection.emit('connected');

      expect(syncSpy).toHaveBeenCalled();
    });

    it('should handle rapid connection state changes', async () => {
      const syncSpy = vi.spyOn(syncManager, 'syncPendingOperations');
      
      // Simulate rapid connection changes
      mockServerConnection.emit('disconnected');
      mockServerConnection.emit('connected');
      mockServerConnection.emit('disconnected');
      mockServerConnection.emit('connected');

      // Should debounce sync calls
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency during sync', async () => {
      // Create a note offline
      mockServerConnection.isConnected.mockReturnValue(false);
      mockOfflineCache.createNote.mockResolvedValue({
        id: 'local-1',
        title: 'Consistency Test',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const note = await syncManager.createNote({
        title: 'Consistency Test',
        content: { type: 'doc', content: [] },
      });

      // Update the note offline
      mockOfflineCache.updateNote.mockResolvedValue({
        ...note,
        title: 'Updated Consistency Test',
      });

      const updatedNote = await syncManager.updateNote(note.id, {
        title: 'Updated Consistency Test',
      });

      // Come back online and sync
      mockServerConnection.isConnected.mockReturnValue(true);
      mockOfflineCache.getQueuedOperations.mockResolvedValue([
        {
          id: 1,
          type: 'create',
          table: 'notes',
          data: note,
        },
        {
          id: 2,
          type: 'update',
          table: 'notes',
          id: note.id,
          data: { title: 'Updated Consistency Test' },
        },
      ]);

      mockServerConnection.createNote.mockResolvedValue({
        id: 'server-1',
        title: 'Consistency Test',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockServerConnection.updateNote.mockResolvedValue({
        id: 'server-1',
        title: 'Updated Consistency Test',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await syncManager.syncPendingOperations();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      
      // Verify local cache is updated with server IDs
      expect(mockOfflineCache.updateNote).toHaveBeenCalledWith('local-1', {
        id: 'server-1',
        title: 'Updated Consistency Test',
        content: { type: 'doc', content: [] },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});
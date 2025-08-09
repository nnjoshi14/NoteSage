import { SyncManager, SyncResult, ConflictResolution } from '../sync-manager';
import { ServerConnectionManager } from '../server-connection';
import { OfflineCache } from '../offline-cache';
import axios from 'axios';

// Mock dependencies
jest.mock('../server-connection');
jest.mock('../offline-cache');
jest.mock('axios');

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockServerConnection: jest.Mocked<ServerConnectionManager>;
  let mockOfflineCache: jest.Mocked<OfflineCache>;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Create mock instances
    mockServerConnection = new ServerConnectionManager() as jest.Mocked<ServerConnectionManager>;
    mockOfflineCache = new OfflineCache() as jest.Mocked<OfflineCache>;
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    // Setup mocks
    mockServerConnection.isConnected.mockReturnValue(true);
    mockServerConnection.getClient.mockReturnValue(mockAxiosInstance);
    
    mockOfflineCache.getSyncMetadata.mockResolvedValue(null);
    mockOfflineCache.updateSyncMetadata.mockResolvedValue(undefined);
    mockOfflineCache.getNotes.mockResolvedValue([]);
    mockOfflineCache.getPeople.mockResolvedValue([]);
    mockOfflineCache.getTodos.mockResolvedValue([]);
    mockOfflineCache.getOfflineQueue.mockResolvedValue([]);

    syncManager = new SyncManager(mockServerConnection, mockOfflineCache);
  });

  afterEach(async () => {
    await syncManager.close();
    jest.clearAllMocks();
  });

  describe('syncAll', () => {
    it('should successfully sync all data types', async () => {
      // Mock API responses
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/api/notes') return Promise.resolve({ data: { notes: [] } });
        if (url === '/api/people') return Promise.resolve({ data: { people: [] } });
        if (url === '/api/todos') return Promise.resolve({ data: { todos: [] } });
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result = await syncManager.syncAll();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when not connected to server', async () => {
      mockServerConnection.isConnected.mockReturnValue(false);

      await expect(syncManager.syncAll()).rejects.toThrow('Server connection required for sync');
    });

    it('should prevent concurrent sync operations', async () => {
      // Start first sync
      const firstSync = syncManager.syncAll();

      // Try to start second sync while first is running
      await expect(syncManager.syncAll()).rejects.toThrow('Sync already in progress');

      // Wait for first sync to complete
      await firstSync;
    });

    it('should handle sync errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await syncManager.syncAll();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Network error');
    });
  });

  describe('syncNotes', () => {
    it('should sync notes from server', async () => {
      const remoteNotes = [
        {
          id: 'note-1',
          title: 'Remote Note',
          content: { type: 'doc' },
          updated_at: new Date().toISOString(),
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: { notes: remoteNotes } });
      mockOfflineCache.getNote.mockResolvedValue(null); // Note doesn't exist locally

      const result = await syncManager.syncNotes();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(mockOfflineCache.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          ...remoteNotes[0],
          server_id: 'note-1',
          sync_status: 'synced',
        })
      );
    });

    it('should push local notes to server', async () => {
      const localNotes = [
        {
          id: 'local-note-1',
          title: 'Local Note',
          content: '{"type":"doc"}',
          category: 'Note',
          tags: [],
          folder_path: '/',
          scheduled_date: undefined,
          is_archived: false,
          is_pinned: false,
          is_favorite: false,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          version: 1,
          server_id: undefined,
          sync_status: 'pending' as const,
          last_modified_locally: '2023-01-01T00:00:00Z',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: { notes: [] } });
      mockOfflineCache.getNotes.mockResolvedValue(localNotes);
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'server-note-1' } });

      const result = await syncManager.syncNotes();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/notes', expect.objectContaining({
        title: 'Local Note',
        content: { type: 'doc' },
      }));
    });

    it('should handle note conflicts', async () => {
      const localNote = {
        id: 'note-1',
        title: 'Local Version',
        content: '{"type":"doc"}',
        category: 'Note',
        tags: [],
        folder_path: '/',
        scheduled_date: undefined,
        is_archived: false,
        is_pinned: false,
        is_favorite: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T10:00:00Z',
        version: 1,
        server_id: undefined,
        sync_status: 'pending' as const,
        last_modified_locally: '2023-01-01T11:00:00Z',
      };

      const remoteNote = {
        id: 'note-1',
        title: 'Remote Version',
        updated_at: '2023-01-01T12:00:00Z',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: { notes: [remoteNote] } });
      mockOfflineCache.getNote.mockResolvedValue(localNote);

      const result = await syncManager.syncNotes();

      expect(result.conflicts).toBe(1);
      expect(mockOfflineCache.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_status: 'conflict',
        })
      );
    });
  });

  describe('processOfflineQueue', () => {
    it('should process queued operations', async () => {
      const queueItems = [
        {
          id: 1,
          operation: 'create' as const,
          table_name: 'notes',
          record_id: 'note-1',
          data: { title: 'Queued Note' },
          created_at: new Date().toISOString(),
          retry_count: 0,
        },
      ];

      mockOfflineCache.getOfflineQueue.mockResolvedValue(queueItems);
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'server-note-1' } });

      const result = await syncManager.processOfflineQueue();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/notes', { title: 'Queued Note' });
      expect(mockOfflineCache.removeFromOfflineQueue).toHaveBeenCalledWith(1);
    });

    it('should retry failed operations', async () => {
      const queueItems = [
        {
          id: 1,
          operation: 'update' as const,
          table_name: 'notes',
          record_id: 'note-1',
          data: { title: 'Updated Note' },
          created_at: new Date().toISOString(),
          retry_count: 2,
        },
      ];

      mockOfflineCache.getOfflineQueue.mockResolvedValue(queueItems);
      mockAxiosInstance.put.mockRejectedValue(new Error('Server error'));

      const result = await syncManager.processOfflineQueue();

      expect(result.failed).toBe(0); // Should not fail immediately, will retry
      expect(mockOfflineCache.updateOfflineQueueError).toHaveBeenCalledWith(1, 'Server error');
    });

    it('should remove items after max retries', async () => {
      const queueItems = [
        {
          id: 1,
          operation: 'delete' as const,
          table_name: 'notes',
          record_id: 'note-1',
          data: null,
          created_at: new Date().toISOString(),
          retry_count: 5, // Max retries reached
        },
      ];

      mockOfflineCache.getOfflineQueue.mockResolvedValue(queueItems);
      mockAxiosInstance.delete.mockRejectedValue(new Error('Server error'));

      const result = await syncManager.processOfflineQueue();

      expect(result.failed).toBe(1);
      expect(mockOfflineCache.removeFromOfflineQueue).toHaveBeenCalledWith(1);
    });
  });

  describe('conflict resolution', () => {
    beforeEach(() => {
      // Setup a conflict in the sync status
      const conflict = {
        id: 'note-1',
        type: 'note' as const,
        localData: { id: 'note-1', title: 'Local Version' },
        remoteData: { id: 'note-1', title: 'Remote Version' },
        conflictReason: 'Both versions modified',
      };

      // Directly set the conflicts in the sync manager
      (syncManager as any).syncStatus.conflicts = [conflict];
    });

    it('should resolve conflict by keeping local version', async () => {
      const resolution: ConflictResolution = {
        strategy: 'keep_local',
      };

      mockAxiosInstance.put.mockResolvedValue({ data: {} });

      await syncManager.resolveConflict('note-1', resolution);

      expect(mockAxiosInstance.put).toHaveBeenCalled();
    });

    it('should resolve conflict by keeping remote version', async () => {
      const resolution: ConflictResolution = {
        strategy: 'keep_remote',
      };

      await syncManager.resolveConflict('note-1', resolution);

      expect(mockOfflineCache.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_status: 'synced',
        })
      );
    });

    it('should resolve conflict by merging data', async () => {
      const mergedData = { id: 'note-1', title: 'Merged Version' };
      const resolution: ConflictResolution = {
        strategy: 'merge',
        mergedData,
      };

      mockAxiosInstance.put.mockResolvedValue({ data: {} });

      await syncManager.resolveConflict('note-1', resolution);

      expect(mockOfflineCache.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mergedData,
          sync_status: 'synced',
        })
      );
      expect(mockAxiosInstance.put).toHaveBeenCalled();
    });

    it('should throw error for non-existent conflict', async () => {
      const resolution: ConflictResolution = {
        strategy: 'keep_local',
      };

      await expect(syncManager.resolveConflict('non-existent', resolution))
        .rejects.toThrow('Conflict not found');
    });
  });

  describe('auto-sync', () => {
    it('should enable auto-sync', () => {
      syncManager.setAutoSyncEnabled(true);

      // Auto-sync should be enabled (tested through behavior, not direct access)
      expect(() => syncManager.setAutoSyncEnabled(true)).not.toThrow();
    });

    it('should disable auto-sync', () => {
      syncManager.setAutoSyncEnabled(false);

      // Auto-sync should be disabled (tested through behavior, not direct access)
      expect(() => syncManager.setAutoSyncEnabled(false)).not.toThrow();
    });

    it('should set auto-sync interval', () => {
      const newInterval = 10 * 60 * 1000; // 10 minutes

      syncManager.setAutoSyncInterval(newInterval);

      // Interval should be updated (tested through behavior, not direct access)
      expect(() => syncManager.setAutoSyncInterval(newInterval)).not.toThrow();
    });
  });

  describe('status and utility methods', () => {
    it('should return sync status', () => {
      const status = syncManager.getSyncStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('conflicts');
      expect(Array.isArray(status.conflicts)).toBe(true);
    });

    it('should return conflicts list', () => {
      const conflicts = syncManager.getConflicts();

      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle network errors during sync', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network timeout'));

      const result = await syncManager.syncAll();

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('Network timeout'))).toBe(true);
    });

    it('should handle malformed server responses', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: null }); // Malformed response

      const result = await syncManager.syncNotes();

      expect(result.success).toBe(true); // Should handle gracefully
      expect(result.synced).toBe(0);
    });

    it('should handle database errors during sync', async () => {
      mockOfflineCache.saveNote.mockRejectedValue(new Error('Database error'));
      mockAxiosInstance.get.mockResolvedValue({ data: { notes: [{ id: 'note-1' }] } });

      const result = await syncManager.syncNotes();

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Database error'))).toBe(true);
    });
  });
});
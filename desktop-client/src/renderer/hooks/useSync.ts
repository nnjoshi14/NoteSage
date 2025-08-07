import { useState, useEffect, useCallback } from 'react';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

export interface SyncConflict {
  id: string;
  type: 'note' | 'person' | 'todo';
  localData: any;
  remoteData: any;
  conflictReason: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync?: Date;
  nextSync?: Date;
  progress?: {
    current: number;
    total: number;
    operation: string;
  };
  conflicts: SyncConflict[];
}

export interface ConflictResolution {
  strategy: 'keep_local' | 'keep_remote' | 'merge';
  mergedData?: any;
}

export const useSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isRunning: false,
    conflicts: [],
  });
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync all data
  const syncAll = useCallback(async (): Promise<SyncResult> => {
    try {
      setError(null);
      setSyncStatus(prev => ({ ...prev, isRunning: true }));
      
      const result = await window.electronAPI.syncData();
      
      if (result.success) {
        setLastSyncResult(result.result);
        setSyncStatus(prev => ({
          ...prev,
          isRunning: false,
          lastSync: new Date(),
        }));
      } else {
        throw new Error(result.error || 'Sync failed');
      }
      
      return result.result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
      setError(errorMessage);
      setSyncStatus(prev => ({ ...prev, isRunning: false }));
      throw err;
    }
  }, []);

  // Resolve a sync conflict
  const resolveConflict = useCallback(async (conflictId: string, resolution: ConflictResolution): Promise<void> => {
    try {
      setError(null);
      await window.electronAPI.resolveConflict(conflictId, resolution);
      
      // Remove resolved conflict from status
      setSyncStatus(prev => ({
        ...prev,
        conflicts: prev.conflicts.filter(c => c.id !== conflictId),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve conflict';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Get current sync status
  const refreshSyncStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await window.electronAPI.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error('Failed to get sync status:', err);
    }
  }, []);

  // Auto-refresh sync status
  useEffect(() => {
    refreshSyncStatus();
    
    const interval = setInterval(refreshSyncStatus, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [refreshSyncStatus]);

  // Listen for sync progress updates
  useEffect(() => {
    const handleSyncProgress = (progress: any) => {
      setSyncStatus(prev => ({ ...prev, progress }));
    };

    const handleSyncComplete = (result: SyncResult) => {
      setLastSyncResult(result);
      setSyncStatus(prev => ({
        ...prev,
        isRunning: false,
        lastSync: new Date(),
        progress: undefined,
      }));
    };

    const handleSyncError = (error: string) => {
      setError(error);
      setSyncStatus(prev => ({
        ...prev,
        isRunning: false,
        progress: undefined,
      }));
    };

    const handleConflictDetected = (conflict: SyncConflict) => {
      setSyncStatus(prev => ({
        ...prev,
        conflicts: [...prev.conflicts, conflict],
      }));
    };

    // Add event listeners if available
    if (window.electronAPI.onSyncProgress) {
      window.electronAPI.onSyncProgress(handleSyncProgress);
    }
    if (window.electronAPI.onSyncComplete) {
      window.electronAPI.onSyncComplete(handleSyncComplete);
    }
    if (window.electronAPI.onSyncError) {
      window.electronAPI.onSyncError(handleSyncError);
    }
    if (window.electronAPI.onConflictDetected) {
      window.electronAPI.onConflictDetected(handleConflictDetected);
    }

    return () => {
      // Remove event listeners if available
      if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('sync-progress');
        window.electronAPI.removeAllListeners('sync-complete');
        window.electronAPI.removeAllListeners('sync-error');
        window.electronAPI.removeAllListeners('conflict-detected');
      }
    };
  }, []);

  return {
    syncStatus,
    lastSyncResult,
    error,
    syncAll,
    resolveConflict,
    refreshSyncStatus,
    isOnline: syncStatus.lastSync !== undefined,
    hasConflicts: syncStatus.conflicts.length > 0,
    isSyncing: syncStatus.isRunning,
  };
};
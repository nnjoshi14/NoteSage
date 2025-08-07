import React, { useState, useEffect } from 'react';
import './CacheSettings.css';

interface CacheStats {
  totalSize: number;
  noteCount: number;
  peopleCount: number;
  todoCount: number;
  pendingChanges: number;
  lastCleanup: string;
  cacheVersion: string;
}

interface CacheSettingsProps {
  className?: string;
}

export const CacheSettings: React.FC<CacheSettingsProps> = ({ className = '' }) => {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCacheStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const stats = await window.electronAPI.getCacheStats();
      setCacheStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cache stats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (isClearing) return;

    const confirmed = window.confirm(
      'Are you sure you want to clear the entire cache? This will remove all offline data and you will need to sync again when online.'
    );

    if (!confirmed) return;

    try {
      setIsClearing(true);
      setError(null);
      
      const result = await window.electronAPI.clearCache();
      
      if (result.success) {
        await loadCacheStats();
      } else {
        throw new Error(result.error || 'Failed to clear cache');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    } finally {
      setIsClearing(false);
    }
  };

  const handleCleanupCache = async () => {
    if (isCleaning) return;

    try {
      setIsCleaning(true);
      setError(null);
      
      const result = await window.electronAPI.cleanupCache();
      
      if (result.success) {
        await loadCacheStats();
      } else {
        throw new Error(result.error || 'Failed to cleanup cache');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup cache');
    } finally {
      setIsCleaning(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  useEffect(() => {
    loadCacheStats();
  }, []);

  if (isLoading) {
    return (
      <div className={`cache-settings loading ${className}`}>
        <div className="loading-spinner">Loading cache information...</div>
      </div>
    );
  }

  if (!cacheStats) {
    return (
      <div className={`cache-settings error ${className}`}>
        <div className="error-message">
          Failed to load cache information
          <button onClick={loadCacheStats} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cache-settings ${className}`}>
      <div className="cache-settings-header">
        <h3>Offline Cache</h3>
        <button 
          onClick={loadCacheStats} 
          className="refresh-button"
          disabled={isLoading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span className="error-text">{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="dismiss-error"
          >
            ×
          </button>
        </div>
      )}

      <div className="cache-stats">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Total Size</div>
            <div className="stat-value">{formatBytes(cacheStats.totalSize)}</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">Notes</div>
            <div className="stat-value">{cacheStats.noteCount.toLocaleString()}</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">People</div>
            <div className="stat-value">{cacheStats.peopleCount.toLocaleString()}</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">Todos</div>
            <div className="stat-value">{cacheStats.todoCount.toLocaleString()}</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">Pending Changes</div>
            <div className="stat-value pending">
              {cacheStats.pendingChanges.toLocaleString()}
            </div>
          </div>
          
          <div className="stat-item">
            <div className="stat-label">Last Cleanup</div>
            <div className="stat-value">{formatDate(cacheStats.lastCleanup)}</div>
          </div>
        </div>
      </div>

      <div className="cache-actions">
        <div className="action-section">
          <h4>Maintenance</h4>
          <div className="action-buttons">
            <button 
              onClick={handleCleanupCache}
              disabled={isCleaning}
              className="cleanup-button"
            >
              {isCleaning ? 'Cleaning...' : 'Cleanup Cache'}
            </button>
            <div className="action-description">
              Remove old synced data and optimize storage space
            </div>
          </div>
        </div>

        <div className="action-section danger">
          <h4>Reset</h4>
          <div className="action-buttons">
            <button 
              onClick={handleClearCache}
              disabled={isClearing}
              className="clear-button"
            >
              {isClearing ? 'Clearing...' : 'Clear All Cache'}
            </button>
            <div className="action-description">
              Remove all cached data. You will need to sync again when online.
            </div>
          </div>
        </div>
      </div>

      <div className="cache-info">
        <div className="info-item">
          <strong>Cache Version:</strong> {cacheStats.cacheVersion}
        </div>
        <div className="info-item">
          <strong>How it works:</strong> The offline cache stores your data locally so you can 
          work without an internet connection. Changes are automatically synced when you reconnect.
        </div>
        {cacheStats.pendingChanges > 0 && (
          <div className="info-item warning">
            <strong>Note:</strong> You have {cacheStats.pendingChanges} pending changes that 
            haven't been synced to the server yet. Make sure to sync before clearing the cache.
          </div>
        )}
      </div>
    </div>
  );
};
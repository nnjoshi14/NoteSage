import React from 'react';
import { useSync } from '../hooks/useSync';
import './SyncStatus.css';

interface SyncStatusProps {
  showDetails?: boolean;
  className?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const { 
    syncStatus, 
    lastSyncResult, 
    error, 
    syncAll, 
    isOnline, 
    hasConflicts, 
    isSyncing 
  } = useSync();

  const handleSyncClick = async () => {
    if (isSyncing) return;
    
    try {
      await syncAll();
    } catch (err) {
      console.error('Manual sync failed:', err);
    }
  };

  const getSyncStatusText = () => {
    if (isSyncing) {
      if (syncStatus.progress) {
        return `${syncStatus.progress.operation} (${syncStatus.progress.current}/${syncStatus.progress.total})`;
      }
      return 'Syncing...';
    }
    
    if (error) {
      return 'Sync failed';
    }
    
    if (hasConflicts) {
      return `${syncStatus.conflicts.length} conflict${syncStatus.conflicts.length > 1 ? 's' : ''}`;
    }
    
    if (!isOnline) {
      return 'Offline';
    }
    
    if (syncStatus.lastSync) {
      const timeSince = Date.now() - syncStatus.lastSync.getTime();
      const minutes = Math.floor(timeSince / 60000);
      
      if (minutes < 1) {
        return 'Just synced';
      } else if (minutes < 60) {
        return `Synced ${minutes}m ago`;
      } else {
        const hours = Math.floor(minutes / 60);
        return `Synced ${hours}h ago`;
      }
    }
    
    return 'Not synced';
  };

  const getSyncStatusClass = () => {
    if (isSyncing) return 'syncing';
    if (error) return 'error';
    if (hasConflicts) return 'conflicts';
    if (!isOnline) return 'offline';
    return 'online';
  };

  const getSyncIcon = () => {
    if (isSyncing) return '⟳';
    if (error) return '⚠';
    if (hasConflicts) return '⚡';
    if (!isOnline) return '⚫';
    return '●';
  };

  return (
    <div className={`sync-status ${getSyncStatusClass()} ${className}`}>
      <div className="sync-status-indicator" onClick={handleSyncClick}>
        <span className="sync-icon">{getSyncIcon()}</span>
        <span className="sync-text">{getSyncStatusText()}</span>
      </div>
      
      {showDetails && (
        <div className="sync-details">
          {syncStatus.progress && (
            <div className="sync-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(syncStatus.progress.current / syncStatus.progress.total) * 100}%` 
                  }}
                />
              </div>
              <div className="progress-text">
                {syncStatus.progress.current} / {syncStatus.progress.total}
              </div>
            </div>
          )}
          
          {lastSyncResult && (
            <div className="sync-result">
              <div className="sync-stats">
                <span className="stat">
                  <span className="stat-value">{lastSyncResult.synced}</span>
                  <span className="stat-label">synced</span>
                </span>
                {lastSyncResult.failed > 0 && (
                  <span className="stat error">
                    <span className="stat-value">{lastSyncResult.failed}</span>
                    <span className="stat-label">failed</span>
                  </span>
                )}
                {lastSyncResult.conflicts > 0 && (
                  <span className="stat warning">
                    <span className="stat-value">{lastSyncResult.conflicts}</span>
                    <span className="stat-label">conflicts</span>
                  </span>
                )}
              </div>
            </div>
          )}
          
          {error && (
            <div className="sync-error">
              <span className="error-icon">⚠</span>
              <span className="error-message">{error}</span>
            </div>
          )}
          
          {hasConflicts && (
            <div className="sync-conflicts">
              <div className="conflicts-header">
                <span className="conflicts-icon">⚡</span>
                <span className="conflicts-text">
                  {syncStatus.conflicts.length} sync conflict{syncStatus.conflicts.length > 1 ? 's' : ''} need resolution
                </span>
              </div>
            </div>
          )}
          
          {syncStatus.nextSync && (
            <div className="next-sync">
              Next sync: {syncStatus.nextSync.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
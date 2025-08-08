import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../stores/store';
import './SyncTrigger.css';

interface SyncTriggerProps {
  onSyncComplete?: (result: any) => void;
}

const SyncTrigger: React.FC<SyncTriggerProps> = ({ onSyncComplete }) => {
  const { todos } = useSelector((state: RootState) => state.todos);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingTodos = todos.filter(todo => todo.sync_status === 'pending');
  const conflictTodos = todos.filter(todo => todo.sync_status === 'conflict');

  const handleManualSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      // Trigger manual sync through electron API
      const result = await window.electronAPI.triggerSync();
      
      if (result.success) {
        setSyncResult(result);
        onSyncComplete?.(result);
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatSyncTime = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="sync-trigger">
      <div className="sync-status">
        <div className="sync-stats">
          <div className="sync-stat">
            <span className="sync-stat-label">Pending:</span>
            <span className={`sync-stat-value ${pendingTodos.length > 0 ? 'has-pending' : ''}`}>
              {pendingTodos.length}
            </span>
          </div>
          
          <div className="sync-stat">
            <span className="sync-stat-label">Conflicts:</span>
            <span className={`sync-stat-value ${conflictTodos.length > 0 ? 'has-conflicts' : ''}`}>
              {conflictTodos.length}
            </span>
          </div>
          
          <div className="sync-stat">
            <span className="sync-stat-label">Total:</span>
            <span className="sync-stat-value">
              {todos.length}
            </span>
          </div>
        </div>

        <button
          className={`btn ${pendingTodos.length > 0 || conflictTodos.length > 0 ? 'btn-warning' : 'btn-outline-secondary'} btn-sm`}
          onClick={handleManualSync}
          disabled={isSyncing}
          title="Manually sync todos with server"
        >
          {isSyncing ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              Syncing...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-repeat"></i>
              Sync Todos
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-sm mt-2" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {syncResult && (
        <div className="alert alert-success alert-sm mt-2" role="alert">
          <i className="bi bi-check-circle me-2"></i>
          Sync completed: {syncResult.synced || 0} synced, {syncResult.failed || 0} failed
          {syncResult.conflicts > 0 && (
            <span className="text-warning">
              , {syncResult.conflicts} conflicts
            </span>
          )}
        </div>
      )}

      {(pendingTodos.length > 0 || conflictTodos.length > 0) && (
        <div className="sync-details mt-2">
          {pendingTodos.length > 0 && (
            <div className="sync-detail-section">
              <h6 className="sync-detail-title">
                <i className="bi bi-clock text-warning"></i>
                Pending Sync ({pendingTodos.length})
              </h6>
              <div className="sync-detail-items">
                {pendingTodos.slice(0, 3).map(todo => (
                  <div key={todo.id} className="sync-detail-item">
                    <span className="badge bg-secondary">{todo.todo_id}</span>
                    <span className="sync-detail-text">
                      {todo.text.length > 30 ? `${todo.text.substring(0, 30)} ...` : todo.text}
                    </span>
                  </div>
                ))}
                {pendingTodos.length > 3 && (
                  <div className="sync-detail-more">
                    +{pendingTodos.length - 3} more pending
                  </div>
                )}
              </div>
            </div>
          )}

          {conflictTodos.length > 0 && (
            <div className="sync-detail-section">
              <h6 className="sync-detail-title">
                <i className="bi bi-exclamation-triangle text-danger"></i>
                Conflicts ({conflictTodos.length})
              </h6>
              <div className="sync-detail-items">
                {conflictTodos.slice(0, 3).map(todo => (
                  <div key={todo.id} className="sync-detail-item conflict">
                    <span className="badge bg-danger">{todo.todo_id}</span>
                    <span className="sync-detail-text">
                      {todo.text.length > 30 ? `${todo.text.substring(0, 30)} ...` : todo.text}
                    </span>
                  </div>
                ))}
                {conflictTodos.length > 3 && (
                  <div className="sync-detail-more">
                    +{conflictTodos.length - 3} more conflicts
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SyncTrigger;
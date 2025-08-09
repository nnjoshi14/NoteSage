import React, { useState, useEffect } from 'react';
import { useSync } from '../hooks/useSync';
import { SyncStatus } from './SyncStatus';
import { ConflictList } from './ConflictResolution';
import { CacheSettings } from './CacheSettings';

/**
 * Example component demonstrating how to use the offline cache and sync system
 * This shows the complete integration of sync status, conflict resolution, and cache management
 */
export const SyncExample: React.FC = () => {
  const { 
    syncStatus, 
    lastSyncResult, 
    error, 
    syncAll, 
    resolveConflict,
    isOnline, 
    hasConflicts, 
    isSyncing 
  } = useSync();

  const [notes, setNotes] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);

  // Load cached data on component mount
  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
    try {
      const [cachedNotes, cachedPeople, cachedTodos] = await Promise.all([
        window.electronAPI.getCachedNotes(),
        window.electronAPI.getCachedPeople(),
        window.electronAPI.getCachedTodos(),
      ]);

      setNotes(cachedNotes);
      setPeople(cachedPeople);
      setTodos(cachedTodos);
    } catch (error) {
      console.error('Failed to load cached data:', error);
    }
  };

  const handleCreateNote = async () => {
    const newNote = {
      title: `New Note ${Date.now()}`,
      content: { type: 'doc', content: [] },
      category: 'Note',
      tags: ['example'],
    };

    try {
      const result = await window.electronAPI.cacheNote(newNote);
      if (result.success) {
        await loadCachedData();
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleCreatePerson = async () => {
    const newPerson = {
      name: `Person ${Date.now()}`,
      email: `person${Date.now()}@example.com`,
      company: 'Example Corp',
    };

    try {
      const result = await window.electronAPI.cachePerson(newPerson);
      if (result.success) {
        await loadCachedData();
      }
    } catch (error) {
      console.error('Failed to create person:', error);
    }
  };

  const handleCreateTodo = async () => {
    if (notes.length === 0) {
      alert('Create a note first to add todos');
      return;
    }

    const newTodo = {
      note_id: notes[0].id,
      todo_id: `t${Date.now()}`,
      text: `Todo item ${Date.now()}`,
      is_completed: false,
    };

    try {
      const result = await window.electronAPI.cacheTodo(newTodo);
      if (result.success) {
        await loadCachedData();
      }
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  const handleManualSync = async () => {
    try {
      await syncAll();
      await loadCachedData(); // Refresh data after sync
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  return (
    <div className="sync-example">
      <div className="sync-example-header">
        <h2>Offline Cache & Sync Demo</h2>
        <SyncStatus showDetails={true} />
      </div>

      <div className="sync-example-content">
        {/* Connection Status */}
        <div className="status-section">
          <h3>Connection Status</h3>
          <div className="status-indicators">
            <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
              <span className="status-dot"></span>
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div className={`status-indicator ${isSyncing ? 'syncing' : 'idle'}`}>
              <span className="status-dot"></span>
              <span>{isSyncing ? 'Syncing...' : 'Idle'}</span>
            </div>
            <div className={`status-indicator ${hasConflicts ? 'conflicts' : 'no-conflicts'}`}>
              <span className="status-dot"></span>
              <span>{hasConflicts ? `${syncStatus.conflicts.length} Conflicts` : 'No Conflicts'}</span>
            </div>
          </div>
        </div>

        {/* Data Creation */}
        <div className="data-section">
          <h3>Create Test Data</h3>
          <div className="action-buttons">
            <button onClick={handleCreateNote} className="create-button">
              Create Note
            </button>
            <button onClick={handleCreatePerson} className="create-button">
              Create Person
            </button>
            <button onClick={handleCreateTodo} className="create-button">
              Create Todo
            </button>
            <button 
              onClick={handleManualSync} 
              disabled={isSyncing}
              className="sync-button"
            >
              {isSyncing ? 'Syncing...' : 'Manual Sync'}
            </button>
          </div>
        </div>

        {/* Cached Data Display */}
        <div className="cached-data-section">
          <div className="data-grid">
            <div className="data-column">
              <h4>Notes ({notes.length})</h4>
              <div className="data-list">
                {notes.slice(0, 5).map((note) => (
                  <div key={note.id} className="data-item">
                    <div className="item-title">{note.title}</div>
                    <div className="item-meta">
                      <span className={`sync-status ${note.sync_status}`}>
                        {note.sync_status}
                      </span>
                      <span className="item-date">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
                {notes.length > 5 && (
                  <div className="data-item more">
                    +{notes.length - 5} more...
                  </div>
                )}
              </div>
            </div>

            <div className="data-column">
              <h4>People ({people.length})</h4>
              <div className="data-list">
                {people.slice(0, 5).map((person) => (
                  <div key={person.id} className="data-item">
                    <div className="item-title">{person.name}</div>
                    <div className="item-meta">
                      <span className={`sync-status ${person.sync_status}`}>
                        {person.sync_status}
                      </span>
                      {person.email && (
                        <span className="item-email">{person.email}</span>
                      )}
                    </div>
                  </div>
                ))}
                {people.length > 5 && (
                  <div className="data-item more">
                    +{people.length - 5} more...
                  </div>
                )}
              </div>
            </div>

            <div className="data-column">
              <h4>Todos ({todos.length})</h4>
              <div className="data-list">
                {todos.slice(0, 5).map((todo) => (
                  <div key={todo.id} className="data-item">
                    <div className="item-title">
                      <span className={`todo-checkbox ${todo.is_completed ? 'completed' : ''}`}>
                        {todo.is_completed ? '☑' : '☐'}
                      </span>
                      {todo.text}
                    </div>
                    <div className="item-meta">
                      <span className={`sync-status ${todo.sync_status}`}>
                        {todo.sync_status}
                      </span>
                      <span className="todo-id">{todo.todo_id}</span>
                    </div>
                  </div>
                ))}
                {todos.length > 5 && (
                  <div className="data-item more">
                    +{todos.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sync Results */}
        {lastSyncResult && (
          <div className="sync-results-section">
            <h3>Last Sync Result</h3>
            <div className="sync-results">
              <div className="result-stats">
                <div className="stat">
                  <span className="stat-value">{lastSyncResult.synced}</span>
                  <span className="stat-label">Synced</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{lastSyncResult.failed}</span>
                  <span className="stat-label">Failed</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{lastSyncResult.conflicts}</span>
                  <span className="stat-label">Conflicts</span>
                </div>
              </div>
              {lastSyncResult.errors.length > 0 && (
                <div className="sync-errors">
                  <h4>Errors:</h4>
                  <ul>
                    {lastSyncResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-section">
            <h3>Sync Error</h3>
            <div className="error-message">{error}</div>
          </div>
        )}

        {/* Conflicts */}
        {hasConflicts && (
          <div className="conflicts-section">
            <ConflictList />
          </div>
        )}

        {/* Cache Settings */}
        <div className="cache-section">
          <CacheSettings />
        </div>
      </div>

      <style>{`
        .sync-example {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .sync-example-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sync-example-header h2 {
          margin: 0;
          color: #111827;
        }

        .sync-example-content {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .status-section,
        .data-section,
        .cached-data-section,
        .sync-results-section,
        .error-section,
        .conflicts-section,
        .cache-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
        }

        .status-section h3,
        .data-section h3,
        .cached-data-section h3,
        .sync-results-section h3,
        .error-section h3 {
          margin: 0 0 16px 0;
          color: #111827;
          font-size: 16px;
          font-weight: 600;
        }

        .status-indicators {
          display: flex;
          gap: 20px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-indicator.online .status-dot {
          background-color: #22c55e;
        }

        .status-indicator.offline .status-dot {
          background-color: #6b7280;
        }

        .status-indicator.syncing .status-dot {
          background-color: #3b82f6;
          animation: pulse 1s infinite;
        }

        .status-indicator.idle .status-dot {
          background-color: #6b7280;
        }

        .status-indicator.conflicts .status-dot {
          background-color: #f59e0b;
        }

        .status-indicator.no-conflicts .status-dot {
          background-color: #22c55e;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .create-button,
        .sync-button {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          border: 1px solid;
        }

        .create-button {
          background-color: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .create-button:hover {
          background-color: #2563eb;
        }

        .sync-button {
          background-color: #059669;
          border-color: #059669;
          color: white;
        }

        .sync-button:hover:not(:disabled) {
          background-color: #047857;
        }

        .sync-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .data-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .data-column h4 {
          margin: 0 0 12px 0;
          color: #111827;
          font-size: 14px;
          font-weight: 600;
        }

        .data-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .data-item {
          padding: 12px;
          background-color: #f9fafb;
          border-radius: 6px;
          border: 1px solid #f3f4f6;
        }

        .data-item.more {
          text-align: center;
          color: #6b7280;
          font-style: italic;
        }

        .item-title {
          font-weight: 500;
          color: #111827;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .todo-checkbox {
          font-size: 16px;
        }

        .todo-checkbox.completed {
          color: #22c55e;
        }

        .item-meta {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
        }

        .sync-status {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 10px;
        }

        .sync-status.pending {
          background-color: #fef3c7;
          color: #92400e;
        }

        .sync-status.synced {
          background-color: #d1fae5;
          color: #065f46;
        }

        .sync-status.conflict {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .result-stats {
          display: flex;
          gap: 20px;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 600;
          color: #111827;
        }

        .stat-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
        }

        .sync-errors {
          margin-top: 16px;
        }

        .sync-errors h4 {
          margin: 0 0 8px 0;
          color: #dc2626;
        }

        .sync-errors ul {
          margin: 0;
          padding-left: 20px;
          color: #dc2626;
        }

        .error-message {
          color: #dc2626;
          background-color: #fef2f2;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #fecaca;
        }
      `}</style>
    </div>
  );
};
import React, { useState } from 'react';
import { useSync, SyncConflict, ConflictResolution } from '../hooks/useSync';
import './ConflictResolution.css';

interface ConflictResolutionProps {
  conflict: SyncConflict;
  onResolve?: (conflictId: string, resolution: ConflictResolution) => void;
  onCancel?: () => void;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionProps> = ({
  conflict,
  onResolve,
  onCancel,
}) => {
  const { resolveConflict } = useSync();
  const [selectedStrategy, setSelectedStrategy] = useState<'keep_local' | 'keep_remote' | 'merge'>('keep_local');
  const [mergedData, setMergedData] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = async () => {
    if (isResolving) return;

    try {
      setIsResolving(true);
      
      const resolution: ConflictResolution = {
        strategy: selectedStrategy,
        mergedData: selectedStrategy === 'merge' ? mergedData : undefined,
      };

      await resolveConflict(conflict.id, resolution);
      onResolve?.(conflict.id, resolution);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const renderDataComparison = () => {
    const localData = conflict.localData;
    const remoteData = conflict.remoteData;

    switch (conflict.type) {
      case 'note':
        return (
          <div className="data-comparison">
            <div className="data-version local">
              <h4>Local Version</h4>
              <div className="note-preview">
                <div className="note-title">{localData.title}</div>
                <div className="note-meta">
                  <span>Category: {localData.category}</span>
                  <span>Modified: {new Date(localData.updated_at).toLocaleString()}</span>
                </div>
                <div className="note-content">
                  {typeof localData.content === 'string' 
                    ? localData.content.substring(0, 200) + '...'
                    : JSON.stringify(localData.content).substring(0, 200) + '...'
                  }
                </div>
              </div>
            </div>
            
            <div className="data-version remote">
              <h4>Remote Version</h4>
              <div className="note-preview">
                <div className="note-title">{remoteData.title}</div>
                <div className="note-meta">
                  <span>Category: {remoteData.category}</span>
                  <span>Modified: {new Date(remoteData.updated_at).toLocaleString()}</span>
                </div>
                <div className="note-content">
                  {typeof remoteData.content === 'string' 
                    ? remoteData.content.substring(0, 200) + '...'
                    : JSON.stringify(remoteData.content).substring(0, 200) + '...'
                  }
                </div>
              </div>
            </div>
          </div>
        );

      case 'person':
        return (
          <div className="data-comparison">
            <div className="data-version local">
              <h4>Local Version</h4>
              <div className="person-preview">
                <div className="person-name">{localData.name}</div>
                <div className="person-details">
                  {localData.email && <div>Email: {localData.email}</div>}
                  {localData.company && <div>Company: {localData.company}</div>}
                  {localData.title && <div>Title: {localData.title}</div>}
                </div>
                <div className="person-meta">
                  Modified: {new Date(localData.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="data-version remote">
              <h4>Remote Version</h4>
              <div className="person-preview">
                <div className="person-name">{remoteData.name}</div>
                <div className="person-details">
                  {remoteData.email && <div>Email: {remoteData.email}</div>}
                  {remoteData.company && <div>Company: {remoteData.company}</div>}
                  {remoteData.title && <div>Title: {remoteData.title}</div>}
                </div>
                <div className="person-meta">
                  Modified: {new Date(remoteData.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );

      case 'todo':
        return (
          <div className="data-comparison">
            <div className="data-version local">
              <h4>Local Version</h4>
              <div className="todo-preview">
                <div className="todo-text">{localData.text}</div>
                <div className="todo-details">
                  <span>Status: {localData.is_completed ? 'Completed' : 'Pending'}</span>
                  {localData.due_date && <span>Due: {localData.due_date}</span>}
                  {localData.assigned_person_id && <span>Assigned: {localData.assigned_person_id}</span>}
                </div>
                <div className="todo-meta">
                  Modified: {new Date(localData.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="data-version remote">
              <h4>Remote Version</h4>
              <div className="todo-preview">
                <div className="todo-text">{remoteData.text}</div>
                <div className="todo-details">
                  <span>Status: {remoteData.is_completed ? 'Completed' : 'Pending'}</span>
                  {remoteData.due_date && <span>Due: {remoteData.due_date}</span>}
                  {remoteData.assigned_person_id && <span>Assigned: {remoteData.assigned_person_id}</span>}
                </div>
                <div className="todo-meta">
                  Modified: {new Date(remoteData.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderMergeEditor = () => {
    if (selectedStrategy !== 'merge') return null;

    // Simple merge editor - in a real implementation, this would be more sophisticated
    return (
      <div className="merge-editor">
        <h4>Merged Version</h4>
        <textarea
          value={JSON.stringify(mergedData || conflict.localData, null, 2)}
          onChange={(e) => {
            try {
              setMergedData(JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, keep current merged data
            }
          }}
          className="merge-textarea"
          rows={10}
        />
        <div className="merge-help">
          Edit the JSON above to create a merged version. This is a simplified editor - 
          in practice, you would have a more user-friendly merge interface.
        </div>
      </div>
    );
  };

  return (
    <div className="conflict-resolution-overlay">
      <div className="conflict-resolution-dialog">
        <div className="dialog-header">
          <h3>Resolve Sync Conflict</h3>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <div className="dialog-content">
          <div className="conflict-info">
            <div className="conflict-type">
              <span className="type-badge">{conflict.type}</span>
              <span className="conflict-id">ID: {conflict.id}</span>
            </div>
            <div className="conflict-reason">{conflict.conflictReason}</div>
          </div>

          {renderDataComparison()}

          <div className="resolution-options">
            <h4>Choose Resolution Strategy</h4>
            
            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="keep_local"
                checked={selectedStrategy === 'keep_local'}
                onChange={(e) => setSelectedStrategy(e.target.value as any)}
              />
              <div className="option-content">
                <div className="option-title">Keep Local Version</div>
                <div className="option-description">
                  Use your local changes and overwrite the remote version
                </div>
              </div>
            </label>

            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="keep_remote"
                checked={selectedStrategy === 'keep_remote'}
                onChange={(e) => setSelectedStrategy(e.target.value as any)}
              />
              <div className="option-content">
                <div className="option-title">Keep Remote Version</div>
                <div className="option-description">
                  Use the remote changes and discard your local changes
                </div>
              </div>
            </label>

            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="merge"
                checked={selectedStrategy === 'merge'}
                onChange={(e) => setSelectedStrategy(e.target.value as any)}
              />
              <div className="option-content">
                <div className="option-title">Merge Manually</div>
                <div className="option-description">
                  Combine both versions manually (advanced)
                </div>
              </div>
            </label>
          </div>

          {renderMergeEditor()}
        </div>

        <div className="dialog-actions">
          <button 
            className="cancel-button" 
            onClick={onCancel}
            disabled={isResolving}
          >
            Cancel
          </button>
          <button 
            className="resolve-button" 
            onClick={handleResolve}
            disabled={isResolving || (selectedStrategy === 'merge' && !mergedData)}
          >
            {isResolving ? 'Resolving...' : 'Resolve Conflict'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConflictListProps {
  className?: string;
}

export const ConflictList: React.FC<ConflictListProps> = ({ className = '' }) => {
  const { syncStatus } = useSync();
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);

  if (syncStatus.conflicts.length === 0) {
    return null;
  }

  const handleResolveConflict = (conflictId: string, resolution: ConflictResolution) => {
    setSelectedConflict(null);
  };

  return (
    <div className={`conflict-list ${className}`}>
      <div className="conflict-list-header">
        <h3>Sync Conflicts ({syncStatus.conflicts.length})</h3>
        <div className="conflict-list-description">
          These items have conflicting changes that need to be resolved manually.
        </div>
      </div>

      <div className="conflicts">
        {syncStatus.conflicts.map((conflict) => (
          <div key={conflict.id} className="conflict-item">
            <div className="conflict-summary">
              <span className="conflict-type-badge">{conflict.type}</span>
              <div className="conflict-details">
                <div className="conflict-title">
                  {conflict.type === 'note' && conflict.localData.title}
                  {conflict.type === 'person' && conflict.localData.name}
                  {conflict.type === 'todo' && conflict.localData.text}
                </div>
                <div className="conflict-reason">{conflict.conflictReason}</div>
              </div>
            </div>
            
            <button 
              className="resolve-conflict-button"
              onClick={() => setSelectedConflict(conflict)}
            >
              Resolve
            </button>
          </div>
        ))}
      </div>

      {selectedConflict && (
        <ConflictResolutionDialog
          conflict={selectedConflict}
          onResolve={handleResolveConflict}
          onCancel={() => setSelectedConflict(null)}
        />
      )}
    </div>
  );
};
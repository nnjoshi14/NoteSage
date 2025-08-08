import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { 
  resolveConflict, 
  setActiveConflict,
  removeConflict 
} from '../../stores/slices/collaborationSlice';
import { ConflictResolution as ConflictType, VersionDiff } from '../../types/collaboration';
import { versionHistoryService } from '../../services/versionHistoryService';
import './ConflictResolution.css';

interface ConflictResolutionProps {
  onResolved: (resolvedContent: string) => void;
  onCancel: () => void;
}

const ConflictResolution: React.FC<ConflictResolutionProps> = ({
  onResolved,
  onCancel
}) => {
  const dispatch = useAppDispatch();
  const { activeConflict, conflicts } = useAppSelector(state => state.collaboration);
  
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merged'>('local');
  const [mergedContent, setMergedContent] = useState('');
  const [diffs, setDiffs] = useState<VersionDiff[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [showDiff, setShowDiff] = useState(true);

  useEffect(() => {
    if (activeConflict) {
      // Generate diff between local and remote versions
      const generatedDiffs = versionHistoryService.generateDiff(
        activeConflict.localVersion.content,
        activeConflict.remoteVersion.content
      );
      setDiffs(generatedDiffs);
      
      // Initialize merged content with local version
      setMergedContent(activeConflict.localVersion.content);
    }
  }, [activeConflict]);

  const handleResolutionChange = (resolution: 'local' | 'remote' | 'merged') => {
    setSelectedResolution(resolution);
    
    if (activeConflict) {
      switch (resolution) {
        case 'local':
          setMergedContent(activeConflict.localVersion.content);
          break;
        case 'remote':
          setMergedContent(activeConflict.remoteVersion.content);
          break;
        case 'merged':
          // Keep current merged content
          break;
      }
    }
  };

  const handleResolve = async () => {
    if (!activeConflict) return;

    setIsResolving(true);
    try {
      const content = selectedResolution === 'merged' ? mergedContent : undefined;
      
      await dispatch(resolveConflict({
        conflictId: activeConflict.conflictId,
        resolution: selectedResolution,
        content
      })).unwrap();

      // Get the resolved content based on resolution type
      let resolvedContent = '';
      switch (selectedResolution) {
        case 'local':
          resolvedContent = activeConflict.localVersion.content;
          break;
        case 'remote':
          resolvedContent = activeConflict.remoteVersion.content;
          break;
        case 'merged':
          resolvedContent = mergedContent;
          break;
      }

      onResolved(resolvedContent);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleSwitchConflict = (conflict: ConflictType) => {
    dispatch(setActiveConflict(conflict));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!activeConflict) {
    return (
      <div className="conflict-resolution">
        <div className="conflict-header">
          <h3>No Active Conflicts</h3>
          <button className="btn btn-secondary" onClick={onCancel}>
            Close
          </button>
        </div>
        <div className="no-conflicts">
          <p>All conflicts have been resolved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-resolution">
      <div className="conflict-header">
        <div className="conflict-title">
          <h3>Resolve Conflict</h3>
          {conflicts.length > 1 && (
            <div className="conflict-navigation">
              <select
                value={activeConflict.conflictId}
                onChange={(e) => {
                  const conflict = conflicts.find(c => c.conflictId === e.target.value);
                  if (conflict) handleSwitchConflict(conflict);
                }}
              >
                {conflicts.map((conflict, index) => (
                  <option key={conflict.conflictId} value={conflict.conflictId}>
                    Conflict {index + 1} of {conflicts.length}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="conflict-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>

      <div className="conflict-content">
        <div className="conflict-info">
          <div className="conflict-description">
            <p>
              A conflict occurred while syncing your changes. Choose how to resolve it:
            </p>
          </div>
          
          <div className="version-info">
            <div className="version-card local">
              <h4>Your Version (Local)</h4>
              <div className="version-details">
                <span>Modified: {formatDate(activeConflict.localVersion.createdAt)}</span>
                <span>Author: {activeConflict.localVersion.authorName}</span>
              </div>
            </div>
            
            <div className="version-card remote">
              <h4>Server Version (Remote)</h4>
              <div className="version-details">
                <span>Modified: {formatDate(activeConflict.remoteVersion.createdAt)}</span>
                <span>Author: {activeConflict.remoteVersion.authorName}</span>
              </div>
            </div>
          </div>
        </div>

        {showDiff && (
          <div className="conflict-diff">
            <div className="diff-header">
              <h4>Changes</h4>
              <div className="diff-stats">
                {diffs.filter(d => d.type === 'added').length > 0 && (
                  <span className="diff-stat added">
                    +{diffs.filter(d => d.type === 'added').length}
                  </span>
                )}
                {diffs.filter(d => d.type === 'removed').length > 0 && (
                  <span className="diff-stat removed">
                    -{diffs.filter(d => d.type === 'removed').length}
                  </span>
                )}
              </div>
            </div>
            
            <div className="diff-content">
              {diffs.length === 0 ? (
                <p>No differences detected</p>
              ) : (
                <div className="diff-lines">
                  {diffs.map((diff, index) => (
                    <div
                      key={index}
                      className={`diff-line diff-${diff.type}`}
                    >
                      <span className="diff-line-number">
                        {diff.lineNumber}
                      </span>
                      <span className="diff-indicator">
                        {diff.type === 'added' ? '+' : '-'}
                      </span>
                      <span className="diff-text">
                        {diff.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="resolution-options">
          <h4>Resolution Options</h4>
          
          <div className="resolution-choice">
            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="local"
                checked={selectedResolution === 'local'}
                onChange={(e) => handleResolutionChange(e.target.value as 'local')}
              />
              <div className="option-content">
                <div className="option-title">Keep Your Version</div>
                <div className="option-description">
                  Use your local changes and discard the server version
                </div>
              </div>
            </label>
            
            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="remote"
                checked={selectedResolution === 'remote'}
                onChange={(e) => handleResolutionChange(e.target.value as 'remote')}
              />
              <div className="option-content">
                <div className="option-title">Use Server Version</div>
                <div className="option-description">
                  Accept the server changes and discard your local changes
                </div>
              </div>
            </label>
            
            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="merged"
                checked={selectedResolution === 'merged'}
                onChange={(e) => handleResolutionChange(e.target.value as 'merged')}
              />
              <div className="option-content">
                <div className="option-title">Merge Manually</div>
                <div className="option-description">
                  Manually combine both versions
                </div>
              </div>
            </label>
          </div>

          {selectedResolution === 'merged' && (
            <div className="merge-editor">
              <h5>Merged Content</h5>
              <textarea
                className="merge-textarea"
                value={mergedContent}
                onChange={(e) => setMergedContent(e.target.value)}
                placeholder="Edit the merged content here..."
                rows={15}
              />
            </div>
          )}
        </div>

        <div className="resolution-actions">
          <button
            className="btn btn-primary"
            onClick={handleResolve}
            disabled={isResolving || (selectedResolution === 'merged' && !mergedContent.trim())}
          >
            {isResolving ? 'Resolving...' : 'Resolve Conflict'}
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={isResolving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolution;
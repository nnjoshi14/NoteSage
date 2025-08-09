import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { 
  loadVersionHistory, 
  loadVersion, 
  restoreVersion,
  setCurrentVersion,
  clearVersionHistory 
} from '../../stores/slices/collaborationSlice';
import { NoteVersion, VersionDiff } from '../../types/collaboration';
import { versionHistoryService } from '../../services/versionHistoryService';
import './VersionHistory.css';

interface VersionHistoryProps {
  noteId: string;
  currentContent: string;
  onVersionRestore: (version: NoteVersion) => void;
  onClose: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  noteId,
  currentContent,
  onVersionRestore,
  onClose
}) => {
  const dispatch = useAppDispatch();
  const { versions, currentVersion, isLoadingVersions, versionError } = useAppSelector(
    state => state.collaboration
  );
  
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffs, setDiffs] = useState<VersionDiff[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (noteId) {
      dispatch(loadVersionHistory(noteId));
    }
    
    return () => {
      dispatch(clearVersionHistory());
    };
  }, [dispatch, noteId]);

  const handleVersionSelect = async (version: NoteVersion) => {
    setSelectedVersion(version);
    await dispatch(loadVersion({ noteId, version: version.version }));
  };

  const handleShowDiff = (version: NoteVersion) => {
    const compareContent = selectedVersion?.content || currentContent;
    const generatedDiffs = versionHistoryService.generateDiff(version.content, compareContent);
    setDiffs(generatedDiffs);
    setShowDiff(true);
  };

  const handleRestoreVersion = async (version: NoteVersion) => {
    if (window.confirm(`Are you sure you want to restore to version ${version.version}? This will create a new version with the restored content.`)) {
      setIsRestoring(true);
      try {
        await dispatch(restoreVersion({ noteId, version: version.version })).unwrap();
        onVersionRestore(version);
        onClose();
      } catch (error) {
        console.error('Failed to restore version:', error);
      } finally {
        setIsRestoring(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeDiff = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateString);
  };

  if (isLoadingVersions) {
    return (
      <div className="version-history">
        <div className="version-history-header">
          <h3>Version History</h3>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="version-history-loading">
          <div className="loading-spinner" data-testid="loading-spinner"></div>
          <p>Loading version history...</p>
        </div>
      </div>
    );
  }

  if (versionError) {
    return (
      <div className="version-history">
        <div className="version-history-header">
          <h3>Version History</h3>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="version-history-error">
          <p>Error loading version history: {versionError}</p>
          <button 
            className="btn btn-primary" 
            onClick={() => dispatch(loadVersionHistory(noteId))}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="version-history">
      <div className="version-history-header">
        <h3>Version History</h3>
        <div className="version-history-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowDiff(!showDiff)}
            disabled={!selectedVersion}
          >
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="version-history-content">
        <div className="version-list">
          <div className="version-list-header">
            <h4>Versions ({versions.length})</h4>
          </div>
          
          {versions.length === 0 ? (
            <div className="version-list-empty">
              <p>No version history available</p>
            </div>
          ) : (
            <div className="version-items">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`version-item ${selectedVersion?.id === version.id ? 'selected' : ''}`}
                  onClick={() => handleVersionSelect(version)}
                >
                  <div className="version-info">
                    <div className="version-header">
                      <span className="version-number">v{version.version}</span>
                      <span className="version-time">{formatTimeDiff(version.createdAt)}</span>
                    </div>
                    <div className="version-author">
                      by {version.authorName}
                    </div>
                    {version.changeDescription && (
                      <div className="version-description">
                        {version.changeDescription}
                      </div>
                    )}
                  </div>
                  
                  <div className="version-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowDiff(version);
                      }}
                    >
                      Diff
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreVersion(version);
                      }}
                      disabled={isRestoring}
                    >
                      {isRestoring ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showDiff && selectedVersion && (
          <div className="version-diff">
            <div className="version-diff-header">
              <h4>Changes in v{selectedVersion.version}</h4>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => setShowDiff(false)}
              >
                Close Diff
              </button>
            </div>
            
            <div className="diff-content">
              {diffs.length === 0 ? (
                <p>No changes detected</p>
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
                        {diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~'}
                      </span>
                      <span className="diff-content">
                        {diff.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedVersion && !showDiff && (
          <div className="version-preview">
            <div className="version-preview-header">
              <h4>Version {selectedVersion.version} Preview</h4>
              <div className="version-preview-info">
                <span>Created: {formatDate(selectedVersion.createdAt)}</span>
                <span>Author: {selectedVersion.authorName}</span>
              </div>
            </div>
            
            <div className="version-preview-content">
              <div className="version-title">
                <strong>{selectedVersion.title}</strong>
              </div>
              <div className="version-content">
                <pre>{selectedVersion.content}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionHistory;
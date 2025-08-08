import React, { useState, useEffect } from 'react';
import './UpdateNotification.css';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  releaseName?: string;
}

interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

interface UpdateNotificationProps {
  onClose?: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for auto-updater events
    const handleUpdateChecking = () => {
      setIsChecking(true);
      setError(null);
    };

    const handleUpdateAvailable = (info: UpdateInfo) => {
      setUpdateInfo(info);
      setIsChecking(false);
      setIsVisible(true);
    };

    const handleUpdateNotAvailable = () => {
      setIsChecking(false);
      setIsVisible(false);
    };

    const handleUpdateError = (errorMessage: string) => {
      setError(errorMessage);
      setIsChecking(false);
      setIsDownloading(false);
      setIsVisible(true);
    };

    const handleDownloadStarted = () => {
      setIsDownloading(true);
      setError(null);
    };

    const handleDownloadProgress = (progress: UpdateProgress) => {
      setUpdateProgress(progress);
    };

    const handleUpdateDownloaded = (info: UpdateInfo) => {
      setIsDownloading(false);
      setIsDownloaded(true);
      setUpdateProgress(null);
      setUpdateInfo(info);
    };

    // Add event listeners
    window.electronAPI?.on('auto-updater-checking', handleUpdateChecking);
    window.electronAPI?.on('auto-updater-update-available', handleUpdateAvailable);
    window.electronAPI?.on('auto-updater-update-not-available', handleUpdateNotAvailable);
    window.electronAPI?.on('auto-updater-error', handleUpdateError);
    window.electronAPI?.on('auto-updater-update-download-started', handleDownloadStarted);
    window.electronAPI?.on('auto-updater-update-download-progress', handleDownloadProgress);
    window.electronAPI?.on('auto-updater-update-downloaded', handleUpdateDownloaded);

    return () => {
      // Remove event listeners
      window.electronAPI?.removeAllListeners('auto-updater-checking');
      window.electronAPI?.removeAllListeners('auto-updater-update-available');
      window.electronAPI?.removeAllListeners('auto-updater-update-not-available');
      window.electronAPI?.removeAllListeners('auto-updater-error');
      window.electronAPI?.removeAllListeners('auto-updater-update-download-started');
      window.electronAPI?.removeAllListeners('auto-updater-update-download-progress');
      window.electronAPI?.removeAllListeners('auto-updater-update-downloaded');
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const result = await window.electronAPI?.invoke('check-for-updates');
      if (!result?.success) {
        setError(result?.error || 'Failed to check for updates');
        setIsChecking(false);
      }
    } catch (err) {
      setError('Failed to check for updates');
      setIsChecking(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updateInfo) return;
    
    try {
      const result = await window.electronAPI?.invoke('download-update');
      if (!result?.success) {
        setError(result?.error || 'Failed to download update');
      }
    } catch (err) {
      setError('Failed to download update');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.electronAPI?.invoke('install-update');
    } catch (err) {
      setError('Failed to install update');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onClose?.();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  if (!isVisible && !isChecking) {
    return (
      <div className="update-check-button">
        <button onClick={handleCheckForUpdates} disabled={isChecking}>
          {isChecking ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>
    );
  }

  if (!isVisible) return null;

  return (
    <div className="update-notification-overlay">
      <div className="update-notification">
        <div className="update-notification-header">
          <h3>
            {error ? 'Update Error' : 
             isDownloaded ? 'Update Ready' :
             isDownloading ? 'Downloading Update' :
             updateInfo ? 'Update Available' : 'Checking for Updates'}
          </h3>
          <button className="close-button" onClick={handleDismiss}>×</button>
        </div>

        <div className="update-notification-content">
          {error && (
            <div className="update-error">
              <p>An error occurred while updating:</p>
              <p className="error-message">{error}</p>
              <div className="update-actions">
                <button onClick={handleCheckForUpdates}>Try Again</button>
                <button onClick={handleDismiss}>Dismiss</button>
              </div>
            </div>
          )}

          {isChecking && (
            <div className="update-checking">
              <div className="spinner"></div>
              <p>Checking for updates...</p>
            </div>
          )}

          {updateInfo && !error && !isDownloaded && !isDownloading && (
            <div className="update-available">
              <p>
                <strong>NoteSage {updateInfo.version}</strong> is available
                {updateInfo.releaseName && <span> - {updateInfo.releaseName}</span>}
              </p>
              <p className="release-date">
                Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </p>
              {updateInfo.releaseNotes && (
                <div className="release-notes">
                  <h4>Release Notes:</h4>
                  <div className="release-notes-content">
                    {updateInfo.releaseNotes}
                  </div>
                </div>
              )}
              <div className="update-actions">
                <button className="primary" onClick={handleDownloadUpdate}>
                  Download Update
                </button>
                <button onClick={handleDismiss}>Later</button>
              </div>
            </div>
          )}

          {isDownloading && updateProgress && (
            <div className="update-downloading">
              <p>Downloading NoteSage {updateInfo?.version}...</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${updateProgress.percent}%` }}
                ></div>
              </div>
              <div className="progress-info">
                <span>{Math.round(updateProgress.percent)}%</span>
                <span>
                  {formatBytes(updateProgress.transferred)} / {formatBytes(updateProgress.total)}
                </span>
                <span>{formatSpeed(updateProgress.bytesPerSecond)}</span>
              </div>
            </div>
          )}

          {isDownloaded && updateInfo && (
            <div className="update-downloaded">
              <p>
                <strong>NoteSage {updateInfo.version}</strong> has been downloaded and is ready to install.
              </p>
              <p>The application will restart to complete the installation.</p>
              <div className="update-actions">
                <button className="primary" onClick={handleInstallUpdate}>
                  Restart & Install
                </button>
                <button onClick={handleDismiss}>Install Later</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
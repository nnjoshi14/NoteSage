import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { disconnectFromServer, syncData } from '@/stores/slices/connectionSlice';
import { initializeAI } from '@/stores/slices/aiSlice';
import AIConfiguration from '@/components/AI/AIConfiguration';

const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { connected, serverUrl, lastSync } = useAppSelector(state => state.connection);

  useEffect(() => {
    // Initialize AI on settings page load
    dispatch(initializeAI());
  }, [dispatch]);

  const handleDisconnect = () => {
    dispatch(disconnectFromServer());
  };

  const handleSync = () => {
    dispatch(syncData());
  };

  return (
    <div className="p-3">
      <h1 className="mb-4">Settings</h1>

      <div className="card mb-3">
        <div className="card-header">
          <h5 className="mb-0">Server Connection</h5>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <strong>Status:</strong>{' '}
            <span className={`badge ${connected ? 'bg-success' : 'bg-danger'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {serverUrl && (
            <div className="mb-3">
              <strong>Server:</strong> {serverUrl}
            </div>
          )}
          
          {lastSync && (
            <div className="mb-3">
              <strong>Last Sync:</strong> {new Date(lastSync).toLocaleString()}
            </div>
          )}

          <div className="d-flex gap-2">
            <button 
              className="btn btn-primary" 
              onClick={handleSync}
              disabled={!connected}
            >
              Sync Now
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleDisconnect}
              disabled={!connected}
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <h5 className="mb-0">AI Features</h5>
        </div>
        <div className="card-body">
          <AIConfiguration />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Application Info</h5>
        </div>
        <div className="card-body">
          <div className="mb-2">
            <strong>Version:</strong> 1.0.0
          </div>
          <div className="mb-2">
            <strong>Platform:</strong> Desktop (Electron)
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
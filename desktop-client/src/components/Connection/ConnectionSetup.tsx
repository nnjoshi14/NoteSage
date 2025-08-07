import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { 
  connectToServer, 
  connectWithProfile,
  loadServerProfiles,
  clearError,
  ServerProfile,
  ServerConfig 
} from '@/stores/slices/connectionSlice';
import ServerProfileManager from './ServerProfileManager';
import './ConnectionSetup.css';

const ConnectionSetup: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isConnecting, error, profiles } = useAppSelector(state => state.connection);
  
  const [showQuickConnect, setShowQuickConnect] = useState(false);
  const [config, setConfig] = useState({
    id: `quick_${Date.now()}`,
    name: 'Quick Connect',
    url: 'localhost',
    port: 8080,
    username: '',
    password: '',
    isDefault: false,
  });

  useEffect(() => {
    dispatch(loadServerProfiles());
  }, [dispatch]);

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    
    const serverConfig: ServerConfig = {
      ...config,
      id: `quick_${Date.now()}`,
      name: 'Quick Connect',
    };
    
    dispatch(connectToServer(serverConfig));
  };

  const handleProfileSelected = async (profile: ServerProfile) => {
    // Try to connect with the selected profile
    try {
      await dispatch(connectWithProfile({ profileId: profile.id })).unwrap();
    } catch (error) {
      // If connection fails, the profile manager will handle password prompt
      console.log('Profile connection will be handled by profile manager');
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const hasProfiles = profiles.length > 0;

  return (
    <div className="connection-setup">
      <div className="connection-setup-container">
        <div className="connection-setup-header">
          <h1>Welcome to NoteSage</h1>
          <p>Connect to your NoteSage server to get started</p>
        </div>

        {hasProfiles && !showQuickConnect ? (
          <div className="connection-options">
            <div className="profiles-section">
              <ServerProfileManager 
                onProfileSelected={handleProfileSelected}
                showConnectionActions={true}
              />
            </div>
            
            <div className="quick-connect-option">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowQuickConnect(true)}
              >
                Use Quick Connect Instead
              </button>
            </div>
          </div>
        ) : (
          <div className="quick-connect-section">
            {hasProfiles && (
              <div className="back-to-profiles">
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => setShowQuickConnect(false)}
                >
                  ← Back to Saved Profiles
                </button>
              </div>
            )}

            <form onSubmit={handleQuickConnect} className="connection-form">
              <div className="form-group">
                <label htmlFor="url" className="form-label">
                  Server URL
                </label>
                <input
                  type="text"
                  id="url"
                  className="form-control"
                  value={config.url}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                  placeholder="localhost"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="port" className="form-label">
                  Port
                </label>
                <input
                  type="number"
                  id="port"
                  className="form-control"
                  value={config.port}
                  onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
                  placeholder="8080"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  className="form-control"
                  value={config.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  className="form-control"
                  value={config.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="alert alert-danger">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect to Server'}
              </button>
            </form>
          </div>
        )}

        <div className="connection-setup-footer">
          <p className="text-muted text-center">
            Need help setting up a server? Check the documentation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionSetup;
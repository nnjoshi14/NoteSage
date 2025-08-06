import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { connectToServer, clearError } from '@/stores/slices/connectionSlice';
import './ConnectionSetup.css';

const ConnectionSetup: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isConnecting, error } = useAppSelector(state => state.connection);
  
  const [config, setConfig] = useState({
    url: 'localhost',
    port: 8080,
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    dispatch(connectToServer(config));
  };

  const handleInputChange = (field: string, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="connection-setup">
      <div className="connection-setup-container">
        <div className="connection-setup-header">
          <h1>Welcome to NoteSage</h1>
          <p>Connect to your NoteSage server to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="connection-form">
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
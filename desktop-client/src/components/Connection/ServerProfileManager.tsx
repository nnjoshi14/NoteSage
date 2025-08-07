import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import {
  loadServerProfiles,
  saveServerProfile,
  deleteServerProfile,
  connectWithProfile,
  switchProfile,
  clearError,
  ServerProfile,
} from '@/stores/slices/connectionSlice';
import './ServerProfileManager.css';

interface ServerProfileManagerProps {
  onProfileSelected?: (profile: ServerProfile) => void;
  showConnectionActions?: boolean;
}

const ServerProfileManager: React.FC<ServerProfileManagerProps> = ({
  onProfileSelected,
  showConnectionActions = true,
}) => {
  const dispatch = useAppDispatch();
  const { profiles, isConnecting, error, connected, profileId } = useAppSelector(
    (state) => state.connection
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ServerProfile | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    profileId: string;
    action: 'connect' | 'switch';
  } | null>(null);
  const [password, setPassword] = useState('');

  const [formData, setFormData] = useState<Partial<ServerProfile>>({
    name: '',
    url: 'localhost',
    port: 8080,
    username: '',
    isDefault: false,
  });

  useEffect(() => {
    dispatch(loadServerProfiles());
  }, [dispatch]);

  const handleAddProfile = () => {
    setFormData({
      name: '',
      url: 'localhost',
      port: 8080,
      username: '',
      isDefault: false,
    });
    setEditingProfile(null);
    setShowAddForm(true);
  };

  const handleEditProfile = (profile: ServerProfile) => {
    setFormData(profile);
    setEditingProfile(profile);
    setShowAddForm(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());

    if (!formData.name || !formData.url || !formData.username) {
      return;
    }

    const profile: ServerProfile = {
      id: editingProfile?.id || `profile_${Date.now()}`,
      name: formData.name,
      url: formData.url,
      port: formData.port || 8080,
      username: formData.username,
      isDefault: formData.isDefault,
      lastUsed: editingProfile?.lastUsed,
      apiVersion: editingProfile?.apiVersion,
    };

    try {
      await dispatch(saveServerProfile(profile)).unwrap();
      setShowAddForm(false);
      setEditingProfile(null);
      
      if (onProfileSelected) {
        onProfileSelected(profile);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleDeleteProfile = async (profile: ServerProfile) => {
    if (window.confirm(`Are you sure you want to delete the profile "${profile.name}"?`)) {
      try {
        await dispatch(deleteServerProfile(profile.id)).unwrap();
      } catch (error) {
        console.error('Failed to delete profile:', error);
      }
    }
  };

  const handleConnectProfile = async (profile: ServerProfile) => {
    dispatch(clearError());
    
    // Check if we have stored credentials
    try {
      await dispatch(connectWithProfile({ profileId: profile.id })).unwrap();
    } catch (error) {
      // If connection fails due to missing credentials, prompt for password
      if (error instanceof Error && error.message.includes('Password required')) {
        setPasswordPrompt({ profileId: profile.id, action: 'connect' });
      }
    }
  };

  const handleSwitchProfile = async (profile: ServerProfile) => {
    dispatch(clearError());
    
    try {
      await dispatch(switchProfile({ profileId: profile.id })).unwrap();
    } catch (error) {
      // If switch fails due to missing credentials, prompt for password
      if (error instanceof Error && error.message.includes('Password required')) {
        setPasswordPrompt({ profileId: profile.id, action: 'switch' });
      }
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordPrompt || !password) return;

    try {
      if (passwordPrompt.action === 'connect') {
        await dispatch(connectWithProfile({ 
          profileId: passwordPrompt.profileId, 
          password 
        })).unwrap();
      } else {
        await dispatch(switchProfile({ 
          profileId: passwordPrompt.profileId, 
          password 
        })).unwrap();
      }
      
      setPasswordPrompt(null);
      setPassword('');
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleInputChange = (field: keyof ServerProfile, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatLastUsed = (date?: Date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="server-profile-manager">
      <div className="profile-manager-header">
        <h2>Server Profiles</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAddProfile}
          disabled={isConnecting}
        >
          Add Profile
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="empty-state">
          <p>No server profiles configured.</p>
          <p>Add a profile to get started.</p>
        </div>
      ) : (
        <div className="profiles-list">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`profile-card ${connected && profileId === profile.id ? 'active' : ''}`}
            >
              <div className="profile-info">
                <div className="profile-header">
                  <h3>{profile.name}</h3>
                  {profile.isDefault && (
                    <span className="badge badge-primary">Default</span>
                  )}
                  {connected && profileId === profile.id && (
                    <span className="badge badge-success">Connected</span>
                  )}
                </div>
                <div className="profile-details">
                  <p><strong>Server:</strong> {profile.url}:{profile.port}</p>
                  <p><strong>Username:</strong> {profile.username}</p>
                  <p><strong>Last Used:</strong> {formatLastUsed(profile.lastUsed)}</p>
                  {profile.apiVersion && (
                    <p><strong>API Version:</strong> {profile.apiVersion}</p>
                  )}
                </div>
              </div>
              
              <div className="profile-actions">
                {showConnectionActions && (
                  <>
                    {connected && profileId === profile.id ? (
                      <span className="connection-status">Active</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => handleConnectProfile(profile)}
                          disabled={isConnecting}
                        >
                          {isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                        {connected && (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => handleSwitchProfile(profile)}
                            disabled={isConnecting}
                          >
                            Switch
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
                
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleEditProfile(profile)}
                  disabled={isConnecting}
                >
                  Edit
                </button>
                
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => handleDeleteProfile(profile)}
                  disabled={isConnecting || (connected && profileId === profile.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Profile Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingProfile ? 'Edit Profile' : 'Add New Profile'}</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowAddForm(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="profile-form">
              <div className="form-group">
                <label htmlFor="profile-name" className="form-label">
                  Profile Name *
                </label>
                <input
                  type="text"
                  id="profile-name"
                  className="form-control"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="My NoteSage Server"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-url" className="form-label">
                    Server URL *
                  </label>
                  <input
                    type="text"
                    id="profile-url"
                    className="form-control"
                    value={formData.url || ''}
                    onChange={(e) => handleInputChange('url', e.target.value)}
                    placeholder="localhost"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile-port" className="form-label">
                    Port *
                  </label>
                  <input
                    type="number"
                    id="profile-port"
                    className="form-control"
                    value={formData.port || 8080}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
                    min="1"
                    max="65535"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="profile-username" className="form-label">
                  Username *
                </label>
                <input
                  type="text"
                  id="profile-username"
                  className="form-control"
                  value={formData.username || ''}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={formData.isDefault || false}
                    onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                  />
                  <span className="form-check-label">Set as default profile</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingProfile ? 'Update Profile' : 'Add Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {passwordPrompt && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Enter Password</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setPasswordPrompt(null);
                  setPassword('');
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="password-form">
              <p>
                Enter the password for profile:{' '}
                <strong>
                  {profiles.find(p => p.id === passwordPrompt.profileId)?.name}
                </strong>
              </p>
              
              <div className="form-group">
                <label htmlFor="profile-password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  id="profile-password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setPasswordPrompt(null);
                    setPassword('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerProfileManager;
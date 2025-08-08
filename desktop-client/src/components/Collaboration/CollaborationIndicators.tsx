import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { 
  startCollaboration, 
  stopCollaboration,
  userJoined,
  userLeft,
  updateUserPresence 
} from '../../stores/slices/collaborationSlice';
import { CollaborationUser, UserPresence } from '../../types/collaboration';
import { collaborationService } from '../../services/collaborationService';
import './CollaborationIndicators.css';

interface CollaborationIndicatorsProps {
  noteId: string;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const CollaborationIndicators: React.FC<CollaborationIndicatorsProps> = ({
  noteId,
  isEnabled,
  onToggle
}) => {
  const dispatch = useAppDispatch();
  const { 
    connectedUsers, 
    userPresences, 
    isCollaborating 
  } = useAppSelector(state => state.collaboration);
  
  const [showUserList, setShowUserList] = useState(false);

  useEffect(() => {
    if (isEnabled && noteId) {
      dispatch(startCollaboration(noteId));
    } else if (isCollaborating) {
      dispatch(stopCollaboration());
    }

    return () => {
      if (isCollaborating) {
        dispatch(stopCollaboration());
      }
    };
  }, [dispatch, noteId, isEnabled, isCollaborating]);

  useEffect(() => {
    // Set up event listeners for collaboration events
    const handleUserJoined = (event: CustomEvent<CollaborationUser>) => {
      dispatch(userJoined(event.detail));
    };

    const handleUserLeft = (event: CustomEvent<{ userId: string }>) => {
      dispatch(userLeft(event.detail));
    };

    const handleCursorUpdate = (event: CustomEvent<UserPresence>) => {
      dispatch(updateUserPresence(event.detail));
    };

    window.addEventListener('collaboration:user_joined', handleUserJoined as EventListener);
    window.addEventListener('collaboration:user_left', handleUserLeft as EventListener);
    window.addEventListener('collaboration:cursor_update', handleCursorUpdate as EventListener);

    return () => {
      window.removeEventListener('collaboration:user_joined', handleUserJoined as EventListener);
      window.removeEventListener('collaboration:user_left', handleUserLeft as EventListener);
      window.removeEventListener('collaboration:cursor_update', handleCursorUpdate as EventListener);
    };
  }, [dispatch]);

  const handleToggleCollaboration = () => {
    onToggle(!isEnabled);
  };

  const getActiveUsers = () => {
    return connectedUsers.filter(user => user.isOnline);
  };

  const getUserPresence = (userId: string) => {
    return userPresences.find(p => p.userId === userId);
  };

  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const date = new Date(lastSeen);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d ago`;
  };

  const activeUsers = getActiveUsers();

  return (
    <div className="collaboration-indicators">
      <div className="collaboration-toggle">
        <button
          className={`collaboration-btn ${isEnabled ? 'active' : ''}`}
          onClick={handleToggleCollaboration}
          title={isEnabled ? 'Disable collaboration' : 'Enable collaboration'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {isCollaborating && (
            <span className="collaboration-status">
              <span className="status-dot"></span>
              Live
            </span>
          )}
        </button>
      </div>

      {isCollaborating && (
        <div className="collaboration-users">
          <div 
            className="users-indicator"
            onClick={() => setShowUserList(!showUserList)}
          >
            <div className="user-avatars">
              {activeUsers.slice(0, 3).map((user, index) => (
                <div
                  key={user.id}
                  className="user-avatar"
                  style={{ zIndex: 3 - index }}
                  title={user.name}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="user-status online"></div>
                </div>
              ))}
              {activeUsers.length > 3 && (
                <div className="user-avatar more-users">
                  <div className="avatar-placeholder">
                    +{activeUsers.length - 3}
                  </div>
                </div>
              )}
            </div>
            
            {activeUsers.length > 0 && (
              <span className="users-count">
                {activeUsers.length} online
              </span>
            )}
          </div>

          {showUserList && (
            <div className="users-dropdown">
              <div className="users-dropdown-header">
                <h4>Collaborators</h4>
                <button 
                  className="close-btn"
                  onClick={() => setShowUserList(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="users-list">
                {connectedUsers.length === 0 ? (
                  <div className="no-users">
                    <p>No other users connected</p>
                  </div>
                ) : (
                  connectedUsers.map(user => {
                    const presence = getUserPresence(user.id);
                    return (
                      <div key={user.id} className="user-item">
                        <div className="user-info">
                          <div className="user-avatar-small">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt={user.name} />
                            ) : (
                              <div className="avatar-placeholder">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className={`user-status ${user.isOnline ? 'online' : 'offline'}`}></div>
                          </div>
                          
                          <div className="user-details">
                            <div className="user-name">{user.name}</div>
                            <div className="user-email">{user.email}</div>
                          </div>
                        </div>
                        
                        <div className="user-activity">
                          {user.isOnline ? (
                            presence ? (
                              <span className="activity-status typing">
                                <span className="typing-indicator">
                                  <span></span>
                                  <span></span>
                                  <span></span>
                                </span>
                                Editing
                              </span>
                            ) : (
                              <span className="activity-status online">Online</span>
                            )
                          ) : (
                            <span className="activity-status offline">
                              {formatLastSeen(user.lastSeen)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CollaborationIndicators;
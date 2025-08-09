import React, { useState, useEffect } from 'react';
import { Person } from '../../stores/slices/peopleSlice';
import { Note } from '../../stores/slices/notesSlice';
import './PersonDetail.css';

interface PersonDetailProps {
  person: Person;
  onEdit: (person: Person) => void;
  onDelete: (personId: string) => void;
  onClose: () => void;
  onNoteSelect?: (note: Note) => void;
}

interface ConnectionData {
  notes: Note[];
  totalConnections: number;
  recentConnections: Note[];
  connectionsByCategory: { [category: string]: number };
}

const PersonDetail: React.FC<PersonDetailProps> = ({
  person,
  onEdit,
  onDelete,
  onClose,
  onNoteSelect,
}) => {
  const [connections, setConnections] = useState<ConnectionData>({
    notes: [],
    totalConnections: 0,
    recentConnections: [],
    connectionsByCategory: {},
  });
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'connections' | 'activity'>('info');

  useEffect(() => {
    loadConnections();
  }, [person.id]);

  const loadConnections = async () => {
    setIsLoadingConnections(true);
    try {
      // TODO: Replace with actual API call to get notes that mention this person
      // For now, we'll simulate the data
      const mockConnections: ConnectionData = {
        notes: [],
        totalConnections: 0,
        recentConnections: [],
        connectionsByCategory: {},
      };
      
      setConnections(mockConnections);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${person.name}? This action cannot be undone.`)) {
      onDelete(person.id);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Show toast notification
  };

  return (
    <div className="person-detail-modal">
      <div className="modal-content">
        <div className="modal-header">
          <div className="person-header">
            <div className="person-avatar-large">
              {person.avatar_url ? (
                <img 
                  src={person.avatar_url} 
                  alt={person.name}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling!.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="avatar-initials-large"
                style={{ display: person.avatar_url ? 'none' : 'flex' }}
              >
                {getInitials(person.name)}
              </div>
            </div>
            
            <div className="person-header-info">
              <h2>{person.name}</h2>
              {person.title && <p className="person-title">{person.title}</p>}
              {person.company && <p className="person-company">{person.company}</p>}
            </div>
          </div>
          
          <div className="header-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => onEdit(person)}
              title="Edit person"
            >
              ✏️ Edit
            </button>
            <button 
              className="btn btn-danger"
              onClick={handleDelete}
              title="Delete person"
            >
              🗑️ Delete
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="detail-tabs">
            <button
              className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Information
            </button>
            <button
              className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
              onClick={() => setActiveTab('connections')}
            >
              Connections ({connections.totalConnections})
            </button>
            <button
              className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'info' && (
              <div className="info-tab">
                <div className="info-section">
                  <h4>Contact Information</h4>
                  <div className="info-grid">
                    {person.email && (
                      <div className="info-item">
                        <label>Email</label>
                        <div className="info-value">
                          <a href={`mailto:${person.email}`}>{person.email}</a>
                          <button 
                            className="copy-btn"
                            onClick={() => copyToClipboard(person.email!)}
                            title="Copy email"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {person.phone && (
                      <div className="info-item">
                        <label>Phone</label>
                        <div className="info-value">
                          <a href={`tel:${person.phone}`}>{person.phone}</a>
                          <button 
                            className="copy-btn"
                            onClick={() => copyToClipboard(person.phone!)}
                            title="Copy phone"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {person.linkedin_url && (
                      <div className="info-item">
                        <label>LinkedIn</label>
                        <div className="info-value">
                          <a 
                            href={person.linkedin_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            View Profile
                          </a>
                          <button 
                            className="copy-btn"
                            onClick={() => copyToClipboard(person.linkedin_url!)}
                            title="Copy LinkedIn URL"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(person.company || person.title) && (
                  <div className="info-section">
                    <h4>Professional Information</h4>
                    <div className="info-grid">
                      {person.company && (
                        <div className="info-item">
                          <label>Company</label>
                          <div className="info-value">{person.company}</div>
                        </div>
                      )}
                      
                      {person.title && (
                        <div className="info-item">
                          <label>Title</label>
                          <div className="info-value">{person.title}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {person.notes && (
                  <div className="info-section">
                    <h4>Notes</h4>
                    <div className="notes-content">
                      <p>{person.notes}</p>
                    </div>
                  </div>
                )}

                <div className="info-section">
                  <h4>Metadata</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Created</label>
                      <div className="info-value">{formatDate(person.created_at)}</div>
                    </div>
                    
                    <div className="info-item">
                      <label>Last Updated</label>
                      <div className="info-value">{formatDate(person.updated_at)}</div>
                    </div>
                    
                    {person.sync_status && (
                      <div className="info-item">
                        <label>Sync Status</label>
                        <div className="info-value">
                          <span className={`sync-status ${person.sync_status}`}>
                            {person.sync_status === 'synced' ? '✓ Synced' : 
                             person.sync_status === 'pending' ? '⏳ Pending' : '⚠️ Conflict'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'connections' && (
              <div className="connections-tab">
                {isLoadingConnections ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading connections...</p>
                  </div>
                ) : connections.totalConnections === 0 ? (
                  <div className="empty-state">
                    <p>No connections found.</p>
                    <p className="empty-state-subtitle">
                      This person hasn't been mentioned in any notes yet.
                    </p>
                  </div>
                ) : (
                  <div className="connections-content">
                    <div className="connections-summary">
                      <div className="summary-stats">
                        <div className="stat-item">
                          <span className="stat-number">{connections.totalConnections}</span>
                          <span className="stat-label">Total Connections</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-number">{connections.recentConnections.length}</span>
                          <span className="stat-label">Recent</span>
                        </div>
                      </div>
                      
                      {Object.keys(connections.connectionsByCategory).length > 0 && (
                        <div className="category-breakdown">
                          <h5>By Category</h5>
                          {Object.entries(connections.connectionsByCategory).map(([category, count]) => (
                            <div key={category} className="category-item">
                              <span className="category-name">{category}</span>
                              <span className="category-count">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="connections-list">
                      <h5>Connected Notes</h5>
                      {connections.notes.map(note => (
                        <div 
                          key={note.id} 
                          className="connection-item"
                          onClick={() => onNoteSelect?.(note)}
                        >
                          <div className="connection-header">
                            <h6>{note.title || 'Untitled'}</h6>
                            <span className="connection-date">
                              {formatDate(note.updated_at)}
                            </span>
                          </div>
                          <p className="connection-preview">
                            {note.content.substring(0, 150)}...
                          </p>
                          <div className="connection-meta">
                            <span className="connection-category">{note.category}</span>
                            {note.tags && note.tags.length > 0 && (
                              <div className="connection-tags">
                                {note.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="tag">{tag}</span>
                                ))}
                                {note.tags.length > 3 && (
                                  <span className="tag-more">+{note.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="activity-tab">
                <div className="empty-state">
                  <p>Activity tracking coming soon!</p>
                  <p className="empty-state-subtitle">
                    This will show recent mentions, note updates, and interaction history.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonDetail;
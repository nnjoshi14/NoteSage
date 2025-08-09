import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { Note, setCurrentNote, setFilters } from '../../stores/slices/notesSlice';
import './NotesList.css';

interface NotesListProps {
  onNoteSelect: (note: Note) => void;
  onNoteCreate: () => void;
  onNoteDelete: (noteId: string) => void;
  onNoteArchive: (noteId: string) => void;
  onNoteFavorite: (noteId: string) => void;
}

type SortOption = 'updated' | 'created' | 'title' | 'category';
type ViewMode = 'list' | 'grid' | 'compact';

const NotesList: React.FC<NotesListProps> = ({
  onNoteSelect,
  onNoteCreate,
  onNoteDelete,
  onNoteArchive,
  onNoteFavorite,
}) => {
  const dispatch = useAppDispatch();
  const { notes, filters, isLoading } = useAppSelector(state => state.notes);
  
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Get unique categories from notes
  const categories = useMemo(() => {
    const cats = new Set(notes.map(note => note.category));
    return Array.from(cats).sort();
  }, [notes]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!note.title.toLowerCase().includes(query) && 
            !note.content.toLowerCase().includes(query) &&
            !note.tags.some(tag => tag.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory && note.category !== selectedCategory) {
        return false;
      }

      // Archive filter
      if (note.is_archived !== showArchived) {
        return false;
      }

      // Favorites filter
      if (showFavoritesOnly && !note.is_favorite) {
        return false;
      }

      return true;
    });

    // Sort notes
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated':
        default:
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [notes, searchQuery, selectedCategory, showArchived, showFavoritesOnly, sortBy, sortOrder]);

  const handleSortChange = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getContentPreview = (content: string) => {
    // Extract plain text from rich content (simplified)
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
  };

  if (isLoading) {
    return (
      <div className="notes-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading notes...</p>
      </div>
    );
  }

  return (
    <div className="notes-list">
      {/* Header with controls */}
      <div className="notes-list-header">
        <div className="notes-list-title">
          <h2>Notes</h2>
          <span className="notes-count">({filteredNotes.length})</span>
        </div>
        
        <div className="notes-list-actions">
          <button className="btn btn-primary" onClick={onNoteCreate}>
            <span className="icon">+</span>
            New Note
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="notes-list-filters">
        <div className="search-box">
          <input
            type="text"
            className="form-control"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          <select
            className="form-control"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <div className="filter-toggles">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Archived
            </label>
            
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showFavoritesOnly}
                onChange={(e) => setShowFavoritesOnly(e.target.checked)}
              />
              Favorites Only
            </label>
          </div>
        </div>

        <div className="view-controls">
          <div className="sort-controls">
            <select
              className="form-control"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as [SortOption, 'asc' | 'desc'];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}
            >
              <option value="updated-desc">Last Updated</option>
              <option value="updated-asc">Oldest Updated</option>
              <option value="created-desc">Newest First</option>
              <option value="created-asc">Oldest First</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="category-asc">Category A-Z</option>
              <option value="category-desc">Category Z-A</option>
            </select>
          </div>

          <div className="view-mode-controls">
            <button
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              ☰
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}
              title="Compact View"
            >
              ≡
            </button>
          </div>
        </div>
      </div>

      {/* Notes list */}
      <div className={`notes-list-content ${viewMode}`}>
        {filteredNotes.length === 0 ? (
          <div className="notes-list-empty">
            {searchQuery || selectedCategory || showFavoritesOnly ? (
              <div>
                <p>No notes match your current filters.</p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('');
                    setShowFavoritesOnly(false);
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div>
                <p>No notes found. Create your first note to get started!</p>
                <button className="btn btn-primary" onClick={onNoteCreate}>
                  Create Note
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredNotes.map(note => (
            <div
              key={note.id}
              className={`note-item ${viewMode}`}
              onClick={() => onNoteSelect(note)}
            >
              <div className="note-item-header">
                <div className="note-item-title">
                  {note.is_pinned && <span className="pin-icon">📌</span>}
                  {note.is_favorite && <span className="favorite-icon">⭐</span>}
                  <h3>{note.title || 'Untitled'}</h3>
                </div>
                
                <div className="note-item-actions">
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteFavorite(note.id);
                    }}
                    title={note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {note.is_favorite ? '⭐' : '☆'}
                  </button>
                  
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteArchive(note.id);
                    }}
                    title={note.is_archived ? 'Unarchive' : 'Archive'}
                  >
                    {note.is_archived ? '📤' : '📥'}
                  </button>
                  
                  <button
                    className="action-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this note?')) {
                        onNoteDelete(note.id);
                      }
                    }}
                    title="Delete note"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {viewMode !== 'compact' && (
                <div className="note-item-content">
                  <p>{getContentPreview(note.content)}</p>
                </div>
              )}

              <div className="note-item-meta">
                <div className="note-item-tags">
                  {note.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                  {note.tags.length > 3 && (
                    <span className="tag-more">+{note.tags.length - 3}</span>
                  )}
                </div>
                
                <div className="note-item-info">
                  <span className="category">{note.category}</span>
                  <span className="date">{formatDate(note.updated_at)}</span>
                  {note.sync_status && (
                    <span className={`sync-status ${note.sync_status}`}>
                      {note.sync_status === 'synced' ? '✓' : 
                       note.sync_status === 'pending' ? '⏳' : '⚠️'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesList;
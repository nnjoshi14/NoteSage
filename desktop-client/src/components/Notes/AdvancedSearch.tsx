import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../stores/hooks';
import { Note } from '../../stores/slices/notesSlice';
import './AdvancedSearch.css';

interface SearchFilters {
  query: string;
  categories: string[];
  tags: string[];
  dateRange: {
    start: string;
    end: string;
  };
  contentType: 'all' | 'title' | 'content' | 'tags';
  sortBy: 'relevance' | 'date' | 'title' | 'category';
  sortOrder: 'asc' | 'desc';
  includeArchived: boolean;
  favoritesOnly: boolean;
}

interface AdvancedSearchProps {
  onSearchResults: (results: Note[]) => void;
  onClose: () => void;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onSearchResults, onClose }) => {
  const { notes } = useAppSelector(state => state.notes);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    categories: [],
    tags: [],
    dateRange: {
      start: '',
      end: '',
    },
    contentType: 'all',
    sortBy: 'relevance',
    sortOrder: 'desc',
    includeArchived: false,
    favoritesOnly: false,
  });

  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    // Extract available categories and tags from notes
    const categories = new Set<string>();
    const tags = new Set<string>();

    notes.forEach(note => {
      if (note.category) categories.add(note.category);
      note.tags?.forEach(tag => tags.add(tag));
    });

    setAvailableCategories(Array.from(categories).sort());
    setAvailableTags(Array.from(tags).sort());
  }, [notes]);

  useEffect(() => {
    // Perform search when filters change
    performSearch();
  }, [filters, notes]);

  const performSearch = () => {
    setIsSearching(true);
    
    try {
      let results = notes.filter(note => {
        // Archive filter
        if (!filters.includeArchived && note.is_archived) {
          return false;
        }

        // Favorites filter
        if (filters.favoritesOnly && !note.is_favorite) {
          return false;
        }

        // Category filter
        if (filters.categories.length > 0 && !filters.categories.includes(note.category)) {
          return false;
        }

        // Tags filter
        if (filters.tags.length > 0) {
          const hasMatchingTag = filters.tags.some(tag => note.tags?.includes(tag));
          if (!hasMatchingTag) {
            return false;
          }
        }

        // Date range filter
        if (filters.dateRange.start || filters.dateRange.end) {
          const noteDate = new Date(note.updated_at);
          
          if (filters.dateRange.start) {
            const startDate = new Date(filters.dateRange.start);
            if (noteDate < startDate) return false;
          }
          
          if (filters.dateRange.end) {
            const endDate = new Date(filters.dateRange.end);
            endDate.setHours(23, 59, 59, 999); // End of day
            if (noteDate > endDate) return false;
          }
        }

        // Text search
        if (filters.query.trim()) {
          const query = filters.query.toLowerCase();
          
          switch (filters.contentType) {
            case 'title':
              return note.title.toLowerCase().includes(query);
            case 'content':
              return note.content.toLowerCase().includes(query);
            case 'tags':
              return note.tags?.some(tag => tag.toLowerCase().includes(query)) || false;
            case 'all':
            default:
              return (
                note.title.toLowerCase().includes(query) ||
                note.content.toLowerCase().includes(query) ||
                note.tags?.some(tag => tag.toLowerCase().includes(query))
              );
          }
        }

        return true;
      });

      // Sort results
      results = sortResults(results);
      
      setSearchResults(results);
      onSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      onSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const sortResults = (results: Note[]): Note[] => {
    return results.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'date':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'relevance':
        default:
          // Simple relevance scoring based on query matches
          if (filters.query.trim()) {
            const scoreA = calculateRelevanceScore(a, filters.query);
            const scoreB = calculateRelevanceScore(b, filters.query);
            comparison = scoreB - scoreA; // Higher score first
          } else {
            // Default to date sorting when no query
            comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          }
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const calculateRelevanceScore = (note: Note, query: string): number => {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Title matches are worth more
    const titleMatches = (note.title.toLowerCase().match(new RegExp(lowerQuery, 'g')) || []).length;
    score += titleMatches * 10;

    // Content matches
    const contentMatches = (note.content.toLowerCase().match(new RegExp(lowerQuery, 'g')) || []).length;
    score += contentMatches * 1;

    // Tag matches
    const tagMatches = note.tags?.filter(tag => 
      tag.toLowerCase().includes(lowerQuery)
    ).length || 0;
    score += tagMatches * 5;

    // Boost for exact matches
    if (note.title.toLowerCase() === lowerQuery) score += 50;
    if (note.tags?.some(tag => tag.toLowerCase() === lowerQuery)) score += 20;

    return score;
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleTagToggle = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      categories: [],
      tags: [],
      dateRange: { start: '', end: '' },
      contentType: 'all',
      sortBy: 'relevance',
      sortOrder: 'desc',
      includeArchived: false,
      favoritesOnly: false,
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.query.trim() ||
      filters.categories.length > 0 ||
      filters.tags.length > 0 ||
      filters.dateRange.start ||
      filters.dateRange.end ||
      filters.includeArchived ||
      filters.favoritesOnly
    );
  };

  return (
    <div className="advanced-search-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Advanced Search</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="search-form">
            {/* Text search */}
            <div className="form-group">
              <label className="form-label">Search Query</label>
              <div className="search-input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter search terms..."
                  value={filters.query}
                  onChange={(e) => handleFilterChange('query', e.target.value)}
                />
                <select
                  className="form-control search-type-select"
                  value={filters.contentType}
                  onChange={(e) => handleFilterChange('contentType', e.target.value)}
                >
                  <option value="all">All Content</option>
                  <option value="title">Title Only</option>
                  <option value="content">Content Only</option>
                  <option value="tags">Tags Only</option>
                </select>
              </div>
            </div>

            {/* Categories */}
            <div className="form-group">
              <label className="form-label">Categories</label>
              <div className="filter-chips">
                {availableCategories.map(category => (
                  <button
                    key={category}
                    className={`filter-chip ${filters.categories.includes(category) ? 'active' : ''}`}
                    onClick={() => handleCategoryToggle(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="form-group">
              <label className="form-label">Tags</label>
              <div className="filter-chips">
                {availableTags.slice(0, 20).map(tag => (
                  <button
                    key={tag}
                    className={`filter-chip ${filters.tags.includes(tag) ? 'active' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
                {availableTags.length > 20 && (
                  <span className="more-tags">+{availableTags.length - 20} more</span>
                )}
              </div>
            </div>

            {/* Date range */}
            <div className="form-group">
              <label className="form-label">Date Range</label>
              <div className="date-range-inputs">
                <input
                  type="date"
                  className="form-control"
                  value={filters.dateRange.start}
                  onChange={(e) => handleFilterChange('dateRange', {
                    ...filters.dateRange,
                    start: e.target.value,
                  })}
                />
                <span>to</span>
                <input
                  type="date"
                  className="form-control"
                  value={filters.dateRange.end}
                  onChange={(e) => handleFilterChange('dateRange', {
                    ...filters.dateRange,
                    end: e.target.value,
                  })}
                />
              </div>
            </div>

            {/* Options */}
            <div className="form-group">
              <label className="form-label">Options</label>
              <div className="search-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.includeArchived}
                    onChange={(e) => handleFilterChange('includeArchived', e.target.checked)}
                  />
                  Include archived notes
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.favoritesOnly}
                    onChange={(e) => handleFilterChange('favoritesOnly', e.target.checked)}
                  />
                  Favorites only
                </label>
              </div>
            </div>

            {/* Sort options */}
            <div className="form-group">
              <label className="form-label">Sort Results</label>
              <div className="sort-controls">
                <select
                  className="form-control"
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="date">Date Modified</option>
                  <option value="title">Title</option>
                  <option value="category">Category</option>
                </select>
                <select
                  className="form-control"
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Search results */}
          <div className="search-results">
            <div className="search-results-header">
              <h4>
                Search Results 
                {isSearching ? (
                  <span className="searching-indicator">Searching...</span>
                ) : (
                  <span className="results-count">({searchResults.length})</span>
                )}
              </h4>
              
              {hasActiveFilters() && (
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>

            <div className="results-list">
              {searchResults.length === 0 ? (
                <div className="empty-results">
                  {hasActiveFilters() ? (
                    <p>No notes match your search criteria.</p>
                  ) : (
                    <p>Enter search terms or apply filters to find notes.</p>
                  )}
                </div>
              ) : (
                searchResults.map(note => (
                  <div key={note.id} className="result-item">
                    <div className="result-header">
                      <h5>{note.title || 'Untitled'}</h5>
                      <div className="result-meta">
                        <span className="result-category">{note.category}</span>
                        <span className="result-date">
                          {new Date(note.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <p className="result-content">
                      {note.content.substring(0, 200)}...
                    </p>
                    
                    {note.tags && note.tags.length > 0 && (
                      <div className="result-tags">
                        {note.tags.slice(0, 5).map(tag => (
                          <span key={tag} className="result-tag">{tag}</span>
                        ))}
                        {note.tags.length > 5 && (
                          <span className="more-tags">+{note.tags.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearch;
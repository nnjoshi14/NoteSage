import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { Person, setCurrentPerson, setFilters } from '../../stores/slices/peopleSlice';
import './PeopleList.css';

interface PeopleListProps {
  onPersonSelect: (person: Person) => void;
  onPersonCreate: () => void;
  onPersonEdit: (person: Person) => void;
  onPersonDelete: (personId: string) => void;
}

type SortOption = 'name' | 'company' | 'created' | 'updated';
type ViewMode = 'list' | 'grid' | 'compact';

const PeopleList: React.FC<PeopleListProps> = ({
  onPersonSelect,
  onPersonCreate,
  onPersonEdit,
  onPersonDelete,
}) => {
  const dispatch = useAppDispatch();
  const { people, filters, isLoading } = useAppSelector(state => state.people);
  
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  // Get unique companies from people
  const companies = useMemo(() => {
    const comps = new Set(people.map(person => person.company).filter(Boolean));
    return Array.from(comps).sort();
  }, [people]);

  // Filter and sort people
  const filteredPeople = useMemo(() => {
    let filtered = people.filter(person => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!person.name.toLowerCase().includes(query) && 
            !person.email?.toLowerCase().includes(query) &&
            !person.company?.toLowerCase().includes(query) &&
            !person.title?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Company filter
      if (selectedCompany && person.company !== selectedCompany) {
        return false;
      }

      return true;
    });

    // Sort people
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'company':
          comparison = (a.company || '').localeCompare(b.company || '');
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
  }, [people, searchQuery, selectedCompany, sortBy, sortOrder]);

  const handleSortChange = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  if (isLoading) {
    return (
      <div className="people-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading people...</p>
      </div>
    );
  }

  return (
    <div className="people-list">
      {/* Header with controls */}
      <div className="people-list-header">
        <div className="people-list-title">
          <h2>People</h2>
          <span className="people-count">({filteredPeople.length})</span>
        </div>
        
        <div className="people-list-actions">
          <button className="btn btn-primary" onClick={onPersonCreate}>
            <span className="icon">+</span>
            Add Person
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="people-list-filters">
        <div className="search-box">
          <input
            type="text"
            className="form-control"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          <select
            className="form-control"
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
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
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="company-asc">Company A-Z</option>
              <option value="company-desc">Company Z-A</option>
              <option value="updated-desc">Recently Updated</option>
              <option value="updated-asc">Oldest Updated</option>
              <option value="created-desc">Recently Added</option>
              <option value="created-asc">Oldest Added</option>
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

      {/* People list */}
      <div className={`people-list-content ${viewMode}`}>
        {filteredPeople.length === 0 ? (
          <div className="people-list-empty">
            {searchQuery || selectedCompany ? (
              <div>
                <p>No people match your current filters.</p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCompany('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div>
                <p>No people found. Add your first contact to get started!</p>
                <button className="btn btn-primary" onClick={onPersonCreate}>
                  Add Person
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredPeople.map(person => (
            <div
              key={person.id}
              className={`person-item ${viewMode}`}
              onClick={() => onPersonSelect(person)}
            >
              <div className="person-item-header">
                <div className="person-avatar">
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
                    className="avatar-initials"
                    style={{ display: person.avatar_url ? 'none' : 'flex' }}
                  >
                    {getInitials(person.name)}
                  </div>
                </div>
                
                <div className="person-item-info">
                  <div className="person-item-title">
                    <h3>{person.name}</h3>
                  </div>
                  
                  {viewMode !== 'compact' && (
                    <div className="person-item-details">
                      {person.title && <span className="person-title">{person.title}</span>}
                      {person.company && <span className="person-company">{person.company}</span>}
                      {person.email && <span className="person-email">{person.email}</span>}
                    </div>
                  )}
                </div>
                
                <div className="person-item-actions">
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPersonEdit(person);
                    }}
                    title="Edit person"
                  >
                    ✏️
                  </button>
                  
                  <button
                    className="action-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete ${person.name}?`)) {
                        onPersonDelete(person.id);
                      }
                    }}
                    title="Delete person"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="person-item-meta">
                <div className="person-item-contact">
                  {person.phone && (
                    <span className="contact-info">📞 {person.phone}</span>
                  )}
                  {person.linkedin_url && (
                    <span className="contact-info">
                      <a 
                        href={person.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        LinkedIn
                      </a>
                    </span>
                  )}
                </div>
                
                <div className="person-item-timestamps">
                  <span className="date">Updated {formatDate(person.updated_at)}</span>
                  {person.sync_status && (
                    <span className={`sync-status ${person.sync_status}`}>
                      {person.sync_status === 'synced' ? '✓' : 
                       person.sync_status === 'pending' ? '⏳' : '⚠️'}
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

export default PeopleList;
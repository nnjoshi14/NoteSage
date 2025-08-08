import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../stores/hooks';
import { Person } from '../../stores/slices/peopleSlice';
import './PeopleSearch.css';

interface SearchFilters {
  query: string;
  companies: string[];
  hasEmail: boolean | null;
  hasPhone: boolean | null;
  hasLinkedIn: boolean | null;
  dateRange: {
    start: string;
    end: string;
  };
  sortBy: 'name' | 'company' | 'created' | 'updated';
  sortOrder: 'asc' | 'desc';
}

interface PeopleSearchProps {
  onSearchResults: (results: Person[]) => void;
  onClose: () => void;
}

const PeopleSearch: React.FC<PeopleSearchProps> = ({ onSearchResults, onClose }) => {
  const { people } = useAppSelector(state => state.people);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    companies: [],
    hasEmail: null,
    hasPhone: null,
    hasLinkedIn: null,
    dateRange: {
      start: '',
      end: '',
    },
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);

  useEffect(() => {
    // Extract available companies from people
    const companies = new Set<string>();
    people.forEach(person => {
      if (person.company) companies.add(person.company);
    });
    setAvailableCompanies(Array.from(companies).sort());
  }, [people]);

  useEffect(() => {
    // Perform search when filters change
    performSearch();
  }, [filters, people]);

  const performSearch = () => {
    setIsSearching(true);
    
    try {
      let results = people.filter(person => {
        // Text search
        if (filters.query.trim()) {
          const query = filters.query.toLowerCase();
          const searchableText = [
            person.name,
            person.email || '',
            person.phone || '',
            person.company || '',
            person.title || '',
            person.notes || '',
          ].join(' ').toLowerCase();
          
          if (!searchableText.includes(query)) {
            return false;
          }
        }

        // Company filter
        if (filters.companies.length > 0) {
          if (!person.company || !filters.companies.includes(person.company)) {
            return false;
          }
        }

        // Contact info filters
        if (filters.hasEmail !== null) {
          const hasEmail = Boolean(person.email);
          if (hasEmail !== filters.hasEmail) {
            return false;
          }
        }

        if (filters.hasPhone !== null) {
          const hasPhone = Boolean(person.phone);
          if (hasPhone !== filters.hasPhone) {
            return false;
          }
        }

        if (filters.hasLinkedIn !== null) {
          const hasLinkedIn = Boolean(person.linkedin_url);
          if (hasLinkedIn !== filters.hasLinkedIn) {
            return false;
          }
        }

        // Date range filter
        if (filters.dateRange.start || filters.dateRange.end) {
          const personDate = new Date(person.created_at);
          
          if (filters.dateRange.start) {
            const startDate = new Date(filters.dateRange.start);
            if (personDate < startDate) return false;
          }
          
          if (filters.dateRange.end) {
            const endDate = new Date(filters.dateRange.end);
            endDate.setHours(23, 59, 59, 999); // End of day
            if (personDate > endDate) return false;
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

  const sortResults = (results: Person[]): Person[] => {
    return results.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
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
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCompanyToggle = (company: string) => {
    setFilters(prev => ({
      ...prev,
      companies: prev.companies.includes(company)
        ? prev.companies.filter(c => c !== company)
        : [...prev.companies, company],
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      companies: [],
      hasEmail: null,
      hasPhone: null,
      hasLinkedIn: null,
      dateRange: { start: '', end: '' },
      sortBy: 'name',
      sortOrder: 'asc',
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.query.trim() ||
      filters.companies.length > 0 ||
      filters.hasEmail !== null ||
      filters.hasPhone !== null ||
      filters.hasLinkedIn !== null ||
      filters.dateRange.start ||
      filters.dateRange.end
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="people-search-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Advanced People Search</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="search-form">
            {/* Text search */}
            <div className="form-group">
              <label className="form-label">Search Query</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, email, company, title, or notes..."
                value={filters.query}
                onChange={(e) => handleFilterChange('query', e.target.value)}
              />
            </div>

            {/* Companies */}
            <div className="form-group">
              <label className="form-label">Companies</label>
              <div className="filter-chips">
                {availableCompanies.map(company => (
                  <button
                    key={company}
                    className={`filter-chip ${filters.companies.includes(company) ? 'active' : ''}`}
                    onClick={() => handleCompanyToggle(company)}
                  >
                    {company}
                  </button>
                ))}
                {availableCompanies.length === 0 && (
                  <p className="no-options">No companies found</p>
                )}
              </div>
            </div>

            {/* Contact info filters */}
            <div className="form-group">
              <label className="form-label">Contact Information</label>
              <div className="contact-filters">
                <div className="filter-option">
                  <label className="filter-label">Has Email</label>
                  <select
                    className="form-control"
                    value={filters.hasEmail === null ? '' : filters.hasEmail.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFilterChange('hasEmail', value === '' ? null : value === 'true');
                    }}
                  >
                    <option value="">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div className="filter-option">
                  <label className="filter-label">Has Phone</label>
                  <select
                    className="form-control"
                    value={filters.hasPhone === null ? '' : filters.hasPhone.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFilterChange('hasPhone', value === '' ? null : value === 'true');
                    }}
                  >
                    <option value="">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div className="filter-option">
                  <label className="filter-label">Has LinkedIn</label>
                  <select
                    className="form-control"
                    value={filters.hasLinkedIn === null ? '' : filters.hasLinkedIn.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFilterChange('hasLinkedIn', value === '' ? null : value === 'true');
                    }}
                  >
                    <option value="">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Date range */}
            <div className="form-group">
              <label className="form-label">Date Added</label>
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

            {/* Sort options */}
            <div className="form-group">
              <label className="form-label">Sort Results</label>
              <div className="sort-controls">
                <select
                  className="form-control"
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <option value="name">Name</option>
                  <option value="company">Company</option>
                  <option value="created">Date Added</option>
                  <option value="updated">Last Updated</option>
                </select>
                <select
                  className="form-control"
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
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
                    <p>No people match your search criteria.</p>
                  ) : (
                    <p>Enter search terms or apply filters to find people.</p>
                  )}
                </div>
              ) : (
                searchResults.map(person => (
                  <div key={person.id} className="result-item">
                    <div className="result-header">
                      <div className="result-avatar">
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
                      
                      <div className="result-info">
                        <h5>{person.name}</h5>
                        {person.title && <p className="result-title">{person.title}</p>}
                        {person.company && <p className="result-company">{person.company}</p>}
                      </div>
                      
                      <div className="result-meta">
                        <span className="result-date">
                          Added {formatDate(person.created_at)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="result-contact">
                      {person.email && (
                        <span className="contact-item">📧 {person.email}</span>
                      )}
                      {person.phone && (
                        <span className="contact-item">📞 {person.phone}</span>
                      )}
                      {person.linkedin_url && (
                        <span className="contact-item">💼 LinkedIn</span>
                      )}
                    </div>
                    
                    {person.notes && (
                      <p className="result-notes">
                        {person.notes.substring(0, 100)}
                        {person.notes.length > 100 && '...'}
                      </p>
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

export default PeopleSearch;
import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { 
  Person, 
  setPeople, 
  addPerson, 
  updatePerson, 
  removePerson, 
  setCurrentPerson,
  setLoading,
  setError 
} from '../../stores/slices/peopleSlice';
import PeopleList from './PeopleList';
import PersonForm from './PersonForm';
import PersonDetail from './PersonDetail';
import PeopleSearch from './PeopleSearch';
import { Note } from '../../stores/slices/notesSlice';
import './PeoplePage.css';

type ViewMode = 'list' | 'form' | 'detail' | 'search';

const PeoplePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { people, currentPerson, isLoading, error } = useAppSelector(state => state.people);
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [searchResults, setSearchResults] = useState<Person[]>([]);

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    dispatch(setLoading(true));
    try {
      // TODO: Replace with actual API call
      // For now, we'll use mock data
      const mockPeople: Person[] = [
        {
          id: '1',
          name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '+1 (555) 123-4567',
          company: 'Tech Corp',
          title: 'Software Engineer',
          linkedin_url: 'https://linkedin.com/in/johnsmith',
          avatar_url: '',
          notes: 'Met at tech conference. Interested in React development.',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-20T14:30:00Z',
          sync_status: 'synced',
        },
        {
          id: '2',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@design.co',
          phone: '+1 (555) 987-6543',
          company: 'Design Co',
          title: 'UX Designer',
          linkedin_url: 'https://linkedin.com/in/sarahjohnson',
          avatar_url: '',
          notes: 'Great designer with experience in user research.',
          created_at: '2024-01-10T09:15:00Z',
          updated_at: '2024-01-18T16:45:00Z',
          sync_status: 'synced',
        },
      ];
      
      dispatch(setPeople(mockPeople));
    } catch (err) {
      dispatch(setError('Failed to load people'));
      console.error('Failed to load people:', err);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handlePersonSelect = (person: Person) => {
    dispatch(setCurrentPerson(person));
    setViewMode('detail');
  };

  const handlePersonCreate = () => {
    setEditingPerson(null);
    setViewMode('form');
  };

  const handlePersonEdit = (person: Person) => {
    setEditingPerson(person);
    setViewMode('form');
  };

  const handlePersonSave = async (personData: Partial<Person>) => {
    dispatch(setLoading(true));
    try {
      if (editingPerson) {
        // Update existing person
        const updatedPerson: Person = {
          ...editingPerson,
          ...personData,
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
        };
        
        // TODO: Replace with actual API call
        dispatch(updatePerson(updatedPerson));
        
        if (currentPerson?.id === editingPerson.id) {
          dispatch(setCurrentPerson(updatedPerson));
        }
      } else {
        // Create new person
        const newPerson: Person = {
          id: Date.now().toString(), // TODO: Use proper UUID
          ...personData as Omit<Person, 'id' | 'created_at' | 'updated_at' | 'sync_status'>,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
        };
        
        // TODO: Replace with actual API call
        dispatch(addPerson(newPerson));
      }
      
      setViewMode('list');
      setEditingPerson(null);
    } catch (err) {
      dispatch(setError('Failed to save person'));
      console.error('Failed to save person:', err);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handlePersonDelete = async (personId: string) => {
    dispatch(setLoading(true));
    try {
      // TODO: Replace with actual API call
      dispatch(removePerson(personId));
      
      if (currentPerson?.id === personId) {
        dispatch(setCurrentPerson(null));
      }
      
      setViewMode('list');
    } catch (err) {
      dispatch(setError('Failed to delete person'));
      console.error('Failed to delete person:', err);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleFormCancel = () => {
    setViewMode('list');
    setEditingPerson(null);
  };

  const handleDetailClose = () => {
    setViewMode('list');
    dispatch(setCurrentPerson(null));
  };

  const handleSearchOpen = () => {
    setViewMode('search');
  };

  const handleSearchClose = () => {
    setViewMode('list');
    setSearchResults([]);
  };

  const handleSearchResults = (results: Person[]) => {
    setSearchResults(results);
  };

  const handleNoteSelect = (note: Note) => {
    // TODO: Navigate to note or open note in editor
    console.log('Navigate to note:', note.id);
  };

  if (error) {
    return (
      <div className="p-3">
        <div className="alert alert-danger">
          <h4>Error</h4>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadPeople}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="people-page">
      {viewMode === 'list' && (
        <div className="people-page-content">
          <div className="people-page-header">
            <button 
              className="btn btn-secondary"
              onClick={handleSearchOpen}
            >
              🔍 Advanced Search
            </button>
          </div>
          
          <PeopleList
            onPersonSelect={handlePersonSelect}
            onPersonCreate={handlePersonCreate}
            onPersonEdit={handlePersonEdit}
            onPersonDelete={handlePersonDelete}
          />
        </div>
      )}

      {viewMode === 'form' && (
        <PersonForm
          person={editingPerson}
          onSave={handlePersonSave}
          onCancel={handleFormCancel}
          isLoading={isLoading}
        />
      )}

      {viewMode === 'detail' && currentPerson && (
        <PersonDetail
          person={currentPerson}
          onEdit={handlePersonEdit}
          onDelete={handlePersonDelete}
          onClose={handleDetailClose}
          onNoteSelect={handleNoteSelect}
        />
      )}

      {viewMode === 'search' && (
        <PeopleSearch
          onSearchResults={handleSearchResults}
          onClose={handleSearchClose}
        />
      )}
    </div>
  );
};

export default PeoplePage;
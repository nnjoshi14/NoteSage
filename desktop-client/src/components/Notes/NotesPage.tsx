import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { loadCachedNotes, saveNote, Note, updateNote, removeNote } from '../../stores/slices/notesSlice';
import NotesList from './NotesList';
import NoteEditor from './NoteEditor';
import NoteTemplates from './NoteTemplates';
import AdvancedSearch from './AdvancedSearch';
import './NotesPage.css';

const NotesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { notes, isLoading, error } = useAppSelector(state => state.notes);
  
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);

  useEffect(() => {
    dispatch(loadCachedNotes());
  }, [dispatch]);

  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note);
  };

  const handleNoteCreate = () => {
    const newNote: Partial<Note> = {
      id: `note-${Date.now()}`,
      title: '',
      content: '',
      category: 'Note',
      tags: [],
      folder_path: '/',
      is_archived: false,
      is_pinned: false,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    
    setSelectedNote(newNote as Note);
  };

  const handleNoteCreateFromTemplate = () => {
    setShowTemplates(true);
  };

  const handleTemplateSelect = (template: any, variables?: Record<string, string>) => {
    let content = template.content;
    
    // Replace variables in template
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, value);
      });
    }

    const newNote: Partial<Note> = {
      id: `note-${Date.now()}`,
      title: variables?.title || template.name,
      content,
      category: template.category === 'Custom' ? 'Note' : template.category,
      tags: [],
      folder_path: '/',
      is_archived: false,
      is_pinned: false,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    
    setSelectedNote(newNote as Note);
    setShowTemplates(false);
  };

  const handleNoteSave = async (note: Note) => {
    try {
      await dispatch(saveNote(note)).unwrap();
      setSelectedNote(note);
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    try {
      // TODO: Implement actual delete API call
      dispatch(removeNote(noteId));
      
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleNoteArchive = async (noteId: string) => {
    try {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        const updatedNote = {
          ...note,
          is_archived: !note.is_archived,
          updated_at: new Date().toISOString(),
        };
        
        await dispatch(saveNote(updatedNote)).unwrap();
        dispatch(updateNote(updatedNote));
        
        if (selectedNote?.id === noteId) {
          setSelectedNote(updatedNote);
        }
      }
    } catch (error) {
      console.error('Failed to archive note:', error);
    }
  };

  const handleNoteFavorite = async (noteId: string) => {
    try {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        const updatedNote = {
          ...note,
          is_favorite: !note.is_favorite,
          updated_at: new Date().toISOString(),
        };
        
        await dispatch(saveNote(updatedNote)).unwrap();
        dispatch(updateNote(updatedNote));
        
        if (selectedNote?.id === noteId) {
          setSelectedNote(updatedNote);
        }
      }
    } catch (error) {
      console.error('Failed to update note favorite status:', error);
    }
  };

  const handleAdvancedSearch = () => {
    setShowAdvancedSearch(true);
  };

  const handleSearchResults = (results: Note[]) => {
    setSearchResults(results);
  };

  const handleCloseSearch = () => {
    setShowAdvancedSearch(false);
    setSearchResults(null);
  };

  const handleEditorClose = () => {
    setSelectedNote(null);
  };

  if (isLoading) {
    return (
      <div className="notes-page-loading">
        <div className="loading-spinner"></div>
        <p>Loading notes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notes-page-error">
        <div className="alert alert-danger">
          Error loading notes: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="notes-page">
      {/* Main content area */}
      <div className="notes-page-content">
        {/* Notes list sidebar */}
        <div className="notes-sidebar">
          <div className="notes-sidebar-header">
            <div className="notes-actions">
              <button className="btn btn-primary" onClick={handleNoteCreate}>
                New Note
              </button>
              <button className="btn btn-secondary" onClick={handleNoteCreateFromTemplate}>
                From Template
              </button>
              <button className="btn btn-secondary" onClick={handleAdvancedSearch}>
                Advanced Search
              </button>
            </div>
          </div>
          
          <NotesList
            onNoteSelect={handleNoteSelect}
            onNoteCreate={handleNoteCreate}
            onNoteDelete={handleNoteDelete}
            onNoteArchive={handleNoteArchive}
            onNoteFavorite={handleNoteFavorite}
          />
        </div>

        {/* Note editor */}
        <div className="notes-editor-area">
          <NoteEditor
            note={selectedNote}
            onSave={handleNoteSave}
            onClose={handleEditorClose}
          />
        </div>
      </div>

      {/* Modals */}
      {showTemplates && (
        <NoteTemplates
          onTemplateSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showAdvancedSearch && (
        <AdvancedSearch
          onSearchResults={handleSearchResults}
          onClose={handleCloseSearch}
        />
      )}
    </div>
  );
};

export default NotesPage;
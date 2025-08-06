import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { loadCachedNotes } from '@/stores/slices/notesSlice';

const NotesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { notes, isLoading, error } = useAppSelector(state => state.notes);

  useEffect(() => {
    dispatch(loadCachedNotes());
  }, [dispatch]);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger m-3">
        Error loading notes: {error}
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Notes</h1>
        <button className="btn btn-primary">
          New Note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center text-muted mt-4">
          <p>No notes found. Create your first note to get started!</p>
        </div>
      ) : (
        <div className="row">
          {notes.map(note => (
            <div key={note.id} className="col-md-6 col-lg-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">{note.title}</h5>
                  <p className="card-text text-muted">
                    {note.content.substring(0, 100)}...
                  </p>
                  <small className="text-muted">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesPage;
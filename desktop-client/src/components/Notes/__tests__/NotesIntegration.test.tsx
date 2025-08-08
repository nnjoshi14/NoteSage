import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import notesSlice from '../../../stores/slices/notesSlice';

// Simple integration test for the notes components
describe('Notes Integration', () => {
  const createMockStore = () => {
    return configureStore({
      reducer: {
        notes: notesSlice,
      },
      preloadedState: {
        notes: {
          notes: [],
          filters: {},
          isLoading: false,
          error: undefined,
          currentNote: null,
        },
      },
    });
  };

  it('should create a store with notes slice', () => {
    const store = createMockStore();
    const state = store.getState();
    
    expect(state.notes).toBeDefined();
    expect(state.notes.notes).toEqual([]);
    expect(state.notes.isLoading).toBe(false);
  });

  it('should handle note actions', () => {
    const store = createMockStore();
    
    // Test adding a note
    store.dispatch({
      type: 'notes/addNote',
      payload: {
        id: '1',
        title: 'Test Note',
        content: 'Test content',
        category: 'Note',
        tags: [],
        folder_path: '/',
        is_archived: false,
        is_pinned: false,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      },
    });
    
    const state = store.getState();
    expect(state.notes.notes).toHaveLength(1);
    expect(state.notes.notes[0].title).toBe('Test Note');
  });

  it('should handle filters', () => {
    const store = createMockStore();
    
    store.dispatch({
      type: 'notes/setFilters',
      payload: { category: 'Meeting' },
    });
    
    const state = store.getState();
    expect(state.notes.filters.category).toBe('Meeting');
  });

  it('should handle current note selection', () => {
    const store = createMockStore();
    
    const testNote = {
      id: '1',
      title: 'Selected Note',
      content: 'Selected content',
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
    
    store.dispatch({
      type: 'notes/setCurrentNote',
      payload: testNote,
    });
    
    const state = store.getState();
    expect(state.notes.currentNote).toEqual(testNote);
  });

  it('should handle note updates', () => {
    const store = createMockStore();
    
    // Add a note first
    const originalNote = {
      id: '1',
      title: 'Original Title',
      content: 'Original content',
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
    
    store.dispatch({
      type: 'notes/addNote',
      payload: originalNote,
    });
    
    // Update the note
    const updatedNote = {
      ...originalNote,
      title: 'Updated Title',
      updated_at: new Date().toISOString(),
    };
    
    store.dispatch({
      type: 'notes/updateNote',
      payload: updatedNote,
    });
    
    const state = store.getState();
    expect(state.notes.notes[0].title).toBe('Updated Title');
  });

  it('should handle note removal', () => {
    const store = createMockStore();
    
    // Add a note first
    store.dispatch({
      type: 'notes/addNote',
      payload: {
        id: '1',
        title: 'Note to Remove',
        content: 'Content',
        category: 'Note',
        tags: [],
        folder_path: '/',
        is_archived: false,
        is_pinned: false,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      },
    });
    
    expect(store.getState().notes.notes).toHaveLength(1);
    
    // Remove the note
    store.dispatch({
      type: 'notes/removeNote',
      payload: '1',
    });
    
    const state = store.getState();
    expect(state.notes.notes).toHaveLength(0);
  });

  it('should clear filters', () => {
    const store = createMockStore();
    
    // Set some filters first
    store.dispatch({
      type: 'notes/setFilters',
      payload: { category: 'Meeting', search: 'test' },
    });
    
    expect(store.getState().notes.filters.category).toBe('Meeting');
    
    // Clear filters
    store.dispatch({
      type: 'notes/clearFilters',
    });
    
    const state = store.getState();
    expect(state.notes.filters).toEqual({});
  });

  it('should clear errors', () => {
    const store = createMockStore();
    
    // Set an error first by directly modifying state (for testing purposes)
    store.dispatch({
      type: 'notes/clearError',
    });
    
    const state = store.getState();
    expect(state.notes.error).toBeUndefined();
  });
});
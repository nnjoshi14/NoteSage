import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  folder_path: string;
  is_archived: boolean;
  is_pinned: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status?: 'synced' | 'pending' | 'conflict';
}

export interface NotesState {
  notes: Note[];
  currentNote: Note | null;
  isLoading: boolean;
  error?: string;
  filters: {
    category?: string;
    archived?: boolean;
    search?: string;
  };
}

const initialState: NotesState = {
  notes: [],
  currentNote: null,
  isLoading: false,
  filters: {},
};

// Async thunks
export const loadCachedNotes = createAsyncThunk(
  'notes/loadCached',
  async () => {
    return await window.electronAPI.getCachedNotes();
  }
);

export const saveNote = createAsyncThunk(
  'notes/save',
  async (note: Partial<Note>) => {
    const result = await window.electronAPI.cacheNote(note);
    if (!result.success) {
      throw new Error('Failed to save note');
    }
    return note as Note;
  }
);

const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {
    setCurrentNote: (state, action: PayloadAction<Note | null>) => {
      state.currentNote = action.payload;
    },
    updateCurrentNote: (state, action: PayloadAction<Partial<Note>>) => {
      if (state.currentNote) {
        state.currentNote = { ...state.currentNote, ...action.payload };
      }
    },
    setFilters: (state, action: PayloadAction<Partial<NotesState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearError: (state) => {
      state.error = undefined;
    },
    addNote: (state, action: PayloadAction<Note>) => {
      state.notes.unshift(action.payload);
    },
    updateNote: (state, action: PayloadAction<Note>) => {
      const index = state.notes.findIndex(note => note.id === action.payload.id);
      if (index !== -1) {
        state.notes[index] = action.payload;
      }
    },
    removeNote: (state, action: PayloadAction<string>) => {
      state.notes = state.notes.filter(note => note.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Load cached notes
      .addCase(loadCachedNotes.pending, (state) => {
        state.isLoading = true;
        state.error = undefined;
      })
      .addCase(loadCachedNotes.fulfilled, (state, action) => {
        state.notes = action.payload;
        state.isLoading = false;
      })
      .addCase(loadCachedNotes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      })
      
      // Save note
      .addCase(saveNote.fulfilled, (state, action) => {
        const existingIndex = state.notes.findIndex(note => note.id === action.payload.id);
        if (existingIndex !== -1) {
          state.notes[existingIndex] = action.payload;
        } else {
          state.notes.unshift(action.payload);
        }
        
        if (state.currentNote?.id === action.payload.id) {
          state.currentNote = action.payload;
        }
      })
      .addCase(saveNote.rejected, (state, action) => {
        state.error = action.error.message;
      });
  },
});

export const {
  setCurrentNote,
  updateCurrentNote,
  setFilters,
  clearFilters,
  clearError,
  addNote,
  updateNote,
  removeNote,
} = notesSlice.actions;

export default notesSlice.reducer;
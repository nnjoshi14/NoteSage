import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  NoteVersion, 
  CollaborationUser, 
  UserPresence, 
  ConflictResolution,
  CollaborationState 
} from '../../types/collaboration';
import { versionHistoryService } from '../../services/versionHistoryService';
import { collaborationService } from '../../services/collaborationService';

const initialState: CollaborationState = {
  versions: [],
  currentVersion: null,
  isLoadingVersions: false,
  versionError: undefined,
  
  connectedUsers: [],
  userPresences: [],
  isCollaborating: false,
  
  conflicts: [],
  activeConflict: null,
};

// Async thunks for version history
export const loadVersionHistory = createAsyncThunk(
  'collaboration/loadVersionHistory',
  async (noteId: string) => {
    return await versionHistoryService.getVersionHistory(noteId);
  }
);

export const loadVersion = createAsyncThunk(
  'collaboration/loadVersion',
  async ({ noteId, version }: { noteId: string; version: number }) => {
    return await versionHistoryService.getVersion(noteId, version);
  }
);

export const restoreVersion = createAsyncThunk(
  'collaboration/restoreVersion',
  async ({ noteId, version }: { noteId: string; version: number }) => {
    const success = await versionHistoryService.restoreVersion(noteId, version);
    if (!success) {
      throw new Error('Failed to restore version');
    }
    return { noteId, version };
  }
);

export const createVersion = createAsyncThunk(
  'collaboration/createVersion',
  async ({ noteId, content, changeDescription }: { 
    noteId: string; 
    content: string; 
    changeDescription?: string;
  }) => {
    return await versionHistoryService.createVersion(noteId, content, changeDescription);
  }
);

// Async thunks for collaboration
export const startCollaboration = createAsyncThunk(
  'collaboration/startCollaboration',
  async (noteId: string) => {
    await collaborationService.connect(noteId);
    const users = await collaborationService.getConnectedUsers(noteId);
    return { noteId, users };
  }
);

export const stopCollaboration = createAsyncThunk(
  'collaboration/stopCollaboration',
  async () => {
    collaborationService.disconnect();
  }
);

export const resolveConflict = createAsyncThunk(
  'collaboration/resolveConflict',
  async ({ 
    conflictId, 
    resolution, 
    content 
  }: { 
    conflictId: string; 
    resolution: 'local' | 'remote' | 'merged'; 
    content?: string;
  }) => {
    const success = await collaborationService.resolveConflict(conflictId, resolution, content);
    if (!success) {
      throw new Error('Failed to resolve conflict');
    }
    return { conflictId, resolution, content };
  }
);

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    // Version history actions
    setCurrentVersion: (state, action: PayloadAction<NoteVersion | null>) => {
      state.currentVersion = action.payload;
    },
    clearVersionHistory: (state) => {
      state.versions = [];
      state.currentVersion = null;
      state.versionError = undefined;
    },
    
    // Real-time collaboration actions
    userJoined: (state, action: PayloadAction<CollaborationUser>) => {
      const existingIndex = state.connectedUsers.findIndex(u => u.id === action.payload.id);
      if (existingIndex !== -1) {
        state.connectedUsers[existingIndex] = action.payload;
      } else {
        state.connectedUsers.push(action.payload);
      }
    },
    userLeft: (state, action: PayloadAction<{ userId: string }>) => {
      state.connectedUsers = state.connectedUsers.filter(u => u.id !== action.payload.userId);
      state.userPresences = state.userPresences.filter(p => p.userId !== action.payload.userId);
    },
    updateUserPresence: (state, action: PayloadAction<UserPresence>) => {
      const existingIndex = state.userPresences.findIndex(p => p.userId === action.payload.userId);
      if (existingIndex !== -1) {
        state.userPresences[existingIndex] = action.payload;
      } else {
        state.userPresences.push(action.payload);
      }
    },
    clearUserPresences: (state) => {
      state.userPresences = [];
    },
    
    // Conflict resolution actions
    addConflict: (state, action: PayloadAction<ConflictResolution>) => {
      state.conflicts.push(action.payload);
      if (!state.activeConflict) {
        state.activeConflict = action.payload;
      }
    },
    setActiveConflict: (state, action: PayloadAction<ConflictResolution | null>) => {
      state.activeConflict = action.payload;
    },
    removeConflict: (state, action: PayloadAction<string>) => {
      state.conflicts = state.conflicts.filter(c => c.conflictId !== action.payload);
      if (state.activeConflict?.conflictId === action.payload) {
        state.activeConflict = state.conflicts[0] || null;
      }
    },
    clearConflicts: (state) => {
      state.conflicts = [];
      state.activeConflict = null;
    },
    
    // Error handling
    clearVersionError: (state) => {
      state.versionError = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load version history
      .addCase(loadVersionHistory.pending, (state) => {
        state.isLoadingVersions = true;
        state.versionError = undefined;
      })
      .addCase(loadVersionHistory.fulfilled, (state, action) => {
        state.versions = action.payload;
        state.isLoadingVersions = false;
      })
      .addCase(loadVersionHistory.rejected, (state, action) => {
        state.isLoadingVersions = false;
        state.versionError = action.error.message;
      })
      
      // Load specific version
      .addCase(loadVersion.fulfilled, (state, action) => {
        if (action.payload) {
          state.currentVersion = action.payload;
        }
      })
      .addCase(loadVersion.rejected, (state, action) => {
        state.versionError = action.error.message;
      })
      
      // Restore version
      .addCase(restoreVersion.fulfilled, (state, action) => {
        // Version restored successfully - reload version history
        state.versionError = undefined;
      })
      .addCase(restoreVersion.rejected, (state, action) => {
        state.versionError = action.error.message;
      })
      
      // Create version
      .addCase(createVersion.fulfilled, (state, action) => {
        state.versions.unshift(action.payload);
        state.currentVersion = action.payload;
      })
      .addCase(createVersion.rejected, (state, action) => {
        state.versionError = action.error.message;
      })
      
      // Start collaboration
      .addCase(startCollaboration.fulfilled, (state, action) => {
        state.isCollaborating = true;
        state.connectedUsers = action.payload.users;
      })
      .addCase(startCollaboration.rejected, (state, action) => {
        state.isCollaborating = false;
        console.error('Failed to start collaboration:', action.error.message);
      })
      
      // Stop collaboration
      .addCase(stopCollaboration.fulfilled, (state) => {
        state.isCollaborating = false;
        state.connectedUsers = [];
        state.userPresences = [];
      })
      
      // Resolve conflict
      .addCase(resolveConflict.fulfilled, (state, action) => {
        const { conflictId } = action.payload;
        state.conflicts = state.conflicts.filter(c => c.conflictId !== conflictId);
        if (state.activeConflict?.conflictId === conflictId) {
          state.activeConflict = state.conflicts[0] || null;
        }
      })
      .addCase(resolveConflict.rejected, (state, action) => {
        console.error('Failed to resolve conflict:', action.error.message);
      });
  },
});

export const {
  setCurrentVersion,
  clearVersionHistory,
  userJoined,
  userLeft,
  updateUserPresence,
  clearUserPresences,
  addConflict,
  setActiveConflict,
  removeConflict,
  clearConflicts,
  clearVersionError,
} = collaborationSlice.actions;

export default collaborationSlice.reducer;
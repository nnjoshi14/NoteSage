import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface ServerProfile {
  id: string;
  name: string;
  url: string;
  port: number;
  username: string;
  isDefault?: boolean;
  lastUsed?: Date;
  apiVersion?: string;
}

export interface ServerConfig extends ServerProfile {
  password: string;
}

export interface ConnectionState {
  connected: boolean;
  isInitialized: boolean;
  isConnecting: boolean;
  serverUrl?: string;
  profileId?: string;
  profileName?: string;
  lastSync?: string;
  error?: string;
  config?: ServerConfig;
  isReconnecting?: boolean;
  apiVersion?: string;
  userInfo?: {
    id: string;
    username: string;
    email?: string;
  };
  profiles: ServerProfile[];
  currentProfile?: ServerProfile;
}

const initialState: ConnectionState = {
  connected: false,
  isInitialized: false,
  isConnecting: false,
  profiles: [],
};

// Async thunks
export const connectToServer = createAsyncThunk(
  'connection/connect',
  async (config: ServerConfig) => {
    const result = await window.electronAPI.connectToServer(config);
    if (!result.success) {
      throw new Error(result.error || 'Connection failed');
    }
    return config;
  }
);

export const connectWithProfile = createAsyncThunk(
  'connection/connectWithProfile',
  async ({ profileId, password }: { profileId: string; password?: string }) => {
    const result = await window.electronAPI.connectWithProfile(profileId, password);
    if (!result.success) {
      throw new Error(result.error || 'Connection failed');
    }
    return profileId;
  }
);

export const switchProfile = createAsyncThunk(
  'connection/switchProfile',
  async ({ profileId, password }: { profileId: string; password?: string }) => {
    const result = await window.electronAPI.switchProfile(profileId, password);
    if (!result.success) {
      throw new Error(result.error || 'Profile switch failed');
    }
    return profileId;
  }
);

export const disconnectFromServer = createAsyncThunk(
  'connection/disconnect',
  async () => {
    const result = await window.electronAPI.disconnectFromServer();
    if (!result.success) {
      throw new Error('Disconnect failed');
    }
  }
);

export const checkConnectionStatus = createAsyncThunk(
  'connection/checkStatus',
  async () => {
    return await window.electronAPI.getConnectionStatus();
  }
);

export const testConnection = createAsyncThunk(
  'connection/testConnection',
  async () => {
    return await window.electronAPI.testConnection();
  }
);

export const syncData = createAsyncThunk(
  'connection/sync',
  async () => {
    const result = await window.electronAPI.syncData();
    if (!result.success) {
      throw new Error(result.error || 'Sync failed');
    }
    return result.result;
  }
);

// Profile management thunks
export const loadServerProfiles = createAsyncThunk(
  'connection/loadProfiles',
  async () => {
    return await window.electronAPI.loadServerProfiles();
  }
);

export const saveServerProfile = createAsyncThunk(
  'connection/saveProfile',
  async (profile: ServerProfile) => {
    const result = await window.electronAPI.saveServerProfile(profile);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save profile');
    }
    return profile;
  }
);

export const deleteServerProfile = createAsyncThunk(
  'connection/deleteProfile',
  async (profileId: string) => {
    const result = await window.electronAPI.deleteServerProfile(profileId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete profile');
    }
    return profileId;
  }
);

export const getCurrentProfile = createAsyncThunk(
  'connection/getCurrentProfile',
  async () => {
    return await window.electronAPI.getCurrentProfile();
  }
);

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = undefined;
    },
    setLastSync: (state, action: PayloadAction<string>) => {
      state.lastSync = action.payload;
    },
    updateConnectionStatus: (state, action: PayloadAction<Partial<ConnectionState>>) => {
      Object.assign(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Connect to server
      .addCase(connectToServer.pending, (state) => {
        state.isConnecting = true;
        state.error = undefined;
      })
      .addCase(connectToServer.fulfilled, (state, action) => {
        state.connected = true;
        state.isConnecting = false;
        state.config = action.payload;
        state.serverUrl = `http://${action.payload.url}:${action.payload.port}`;
        state.profileId = action.payload.id;
        state.profileName = action.payload.name;
        state.error = undefined;
      })
      .addCase(connectToServer.rejected, (state, action) => {
        state.connected = false;
        state.isConnecting = false;
        state.error = action.error.message;
      })

      // Connect with profile
      .addCase(connectWithProfile.pending, (state) => {
        state.isConnecting = true;
        state.error = undefined;
      })
      .addCase(connectWithProfile.fulfilled, (state, action) => {
        state.connected = true;
        state.isConnecting = false;
        state.profileId = action.payload;
        state.error = undefined;
      })
      .addCase(connectWithProfile.rejected, (state, action) => {
        state.connected = false;
        state.isConnecting = false;
        state.error = action.error.message;
      })

      // Switch profile
      .addCase(switchProfile.pending, (state) => {
        state.isConnecting = true;
        state.error = undefined;
      })
      .addCase(switchProfile.fulfilled, (state, action) => {
        state.connected = true;
        state.isConnecting = false;
        state.profileId = action.payload;
        state.error = undefined;
      })
      .addCase(switchProfile.rejected, (state, action) => {
        state.connected = false;
        state.isConnecting = false;
        state.error = action.error.message;
      })
      
      // Disconnect from server
      .addCase(disconnectFromServer.fulfilled, (state) => {
        state.connected = false;
        state.config = undefined;
        state.serverUrl = undefined;
        state.profileId = undefined;
        state.profileName = undefined;
        state.lastSync = undefined;
        state.error = undefined;
        state.isReconnecting = false;
        state.userInfo = undefined;
        state.currentProfile = undefined;
      })
      
      // Check connection status
      .addCase(checkConnectionStatus.fulfilled, (state, action) => {
        state.connected = action.payload.connected;
        state.serverUrl = action.payload.serverUrl;
        state.profileId = action.payload.profileId;
        state.profileName = action.payload.profileName;
        state.lastSync = action.payload.lastSync;
        state.error = action.payload.error;
        state.isReconnecting = action.payload.isReconnecting;
        state.apiVersion = action.payload.apiVersion;
        state.userInfo = action.payload.userInfo;
        state.isInitialized = true;
      })

      // Test connection
      .addCase(testConnection.fulfilled, (state, action) => {
        if (action.payload && !state.connected) {
          state.connected = true;
          state.error = undefined;
        } else if (!action.payload && state.connected) {
          state.connected = false;
          state.error = 'Connection test failed';
        }
      })
      
      // Sync data
      .addCase(syncData.fulfilled, (state) => {
        state.lastSync = new Date().toISOString();
      })
      .addCase(syncData.rejected, (state, action) => {
        state.error = action.error.message;
      })

      // Profile management
      .addCase(loadServerProfiles.fulfilled, (state, action) => {
        state.profiles = action.payload;
      })
      .addCase(saveServerProfile.fulfilled, (state, action) => {
        const existingIndex = state.profiles.findIndex(p => p.id === action.payload.id);
        if (existingIndex >= 0) {
          state.profiles[existingIndex] = action.payload;
        } else {
          state.profiles.push(action.payload);
        }
      })
      .addCase(deleteServerProfile.fulfilled, (state, action) => {
        state.profiles = state.profiles.filter(p => p.id !== action.payload);
        if (state.profileId === action.payload) {
          state.connected = false;
          state.profileId = undefined;
          state.profileName = undefined;
          state.currentProfile = undefined;
        }
      })
      .addCase(getCurrentProfile.fulfilled, (state, action) => {
        state.currentProfile = action.payload || undefined;
      });
  },
});

export const { clearError, setLastSync, updateConnectionStatus } = connectionSlice.actions;
export default connectionSlice.reducer;
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface ServerConfig {
  url: string;
  port: number;
  username: string;
  password: string;
}

export interface ConnectionState {
  connected: boolean;
  isInitialized: boolean;
  isConnecting: boolean;
  serverUrl?: string;
  lastSync?: string;
  error?: string;
  config?: ServerConfig;
}

const initialState: ConnectionState = {
  connected: false,
  isInitialized: false,
  isConnecting: false,
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
        state.error = undefined;
      })
      .addCase(connectToServer.rejected, (state, action) => {
        state.connected = false;
        state.isConnecting = false;
        state.error = action.error.message;
      })
      
      // Disconnect from server
      .addCase(disconnectFromServer.fulfilled, (state) => {
        state.connected = false;
        state.config = undefined;
        state.serverUrl = undefined;
        state.lastSync = undefined;
        state.error = undefined;
      })
      
      // Check connection status
      .addCase(checkConnectionStatus.fulfilled, (state, action) => {
        state.connected = action.payload.connected;
        state.serverUrl = action.payload.serverUrl;
        state.lastSync = action.payload.lastSync;
        state.error = action.payload.error;
        state.isInitialized = true;
      })
      
      // Sync data
      .addCase(syncData.fulfilled, (state) => {
        state.lastSync = new Date().toISOString();
      })
      .addCase(syncData.rejected, (state, action) => {
        state.error = action.error.message;
      });
  },
});

export const { clearError, setLastSync } = connectionSlice.actions;
export default connectionSlice.reducer;
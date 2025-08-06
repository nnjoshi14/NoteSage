import { configureStore } from '@reduxjs/toolkit';
import connectionReducer, {
  connectToServer,
  disconnectFromServer,
  checkConnectionStatus,
  clearError,
  ConnectionState,
} from '../connectionSlice';

// Mock the electron API
const mockElectronAPI = {
  connectToServer: jest.fn(),
  disconnectFromServer: jest.fn(),
  getConnectionStatus: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('connectionSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        connection: connectionReducer,
      },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().connection;
      expect(state).toEqual({
        connected: false,
        isInitialized: false,
        isConnecting: false,
      });
    });
  });

  describe('clearError action', () => {
    it('should clear error', () => {
      // First set an error state
      const initialState: ConnectionState = {
        connected: false,
        isInitialized: true,
        isConnecting: false,
        error: 'Some error',
      };

      const action = clearError();
      const newState = connectionReducer(initialState, action);

      expect(newState.error).toBeUndefined();
    });
  });

  describe('connectToServer async thunk', () => {
    const serverConfig = {
      url: 'localhost',
      port: 8080,
      username: 'testuser',
      password: 'testpass',
    };

    it('should handle successful connection', async () => {
      mockElectronAPI.connectToServer.mockResolvedValue({ success: true });

      await store.dispatch(connectToServer(serverConfig));
      const state = store.getState().connection;

      expect(state.connected).toBe(true);
      expect(state.isConnecting).toBe(false);
      expect(state.config).toEqual(serverConfig);
      expect(state.serverUrl).toBe('http://localhost:8080');
      expect(state.error).toBeUndefined();
    });

    it('should handle connection failure', async () => {
      const errorMessage = 'Connection failed';
      mockElectronAPI.connectToServer.mockRejectedValue(new Error(errorMessage));

      await store.dispatch(connectToServer(serverConfig));
      const state = store.getState().connection;

      expect(state.connected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should set connecting state during connection attempt', () => {
      mockElectronAPI.connectToServer.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      store.dispatch(connectToServer(serverConfig));
      const state = store.getState().connection;

      expect(state.isConnecting).toBe(true);
      expect(state.error).toBeUndefined();
    });
  });

  describe('disconnectFromServer async thunk', () => {
    it('should handle successful disconnection', async () => {
      // Set initial connected state
      const initialState: ConnectionState = {
        connected: true,
        isInitialized: true,
        isConnecting: false,
        config: {
          url: 'localhost',
          port: 8080,
          username: 'testuser',
          password: 'testpass',
        },
        serverUrl: 'http://localhost:8080',
        lastSync: '2023-01-01T00:00:00Z',
      };

      mockElectronAPI.disconnectFromServer.mockResolvedValue({ success: true });

      const action = await store.dispatch(disconnectFromServer());
      const newState = connectionReducer(initialState, action);

      expect(newState.connected).toBe(false);
      expect(newState.config).toBeUndefined();
      expect(newState.serverUrl).toBeUndefined();
      expect(newState.lastSync).toBeUndefined();
      expect(newState.error).toBeUndefined();
    });
  });

  describe('checkConnectionStatus async thunk', () => {
    it('should update state with connection status', async () => {
      const statusData = {
        connected: true,
        serverUrl: 'http://localhost:8080',
        lastSync: '2023-01-01T00:00:00Z',
      };

      mockElectronAPI.getConnectionStatus.mockResolvedValue(statusData);

      await store.dispatch(checkConnectionStatus());
      const state = store.getState().connection;

      expect(state.connected).toBe(true);
      expect(state.serverUrl).toBe('http://localhost:8080');
      expect(state.lastSync).toBe('2023-01-01T00:00:00Z');
      expect(state.isInitialized).toBe(true);
    });
  });
});
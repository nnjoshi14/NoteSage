import { configureStore } from '@reduxjs/toolkit';
import connectionReducer, {
  connectToServer,
  disconnectFromServer,
  checkConnectionStatus,
  clearError,
  ConnectionState,
  ServerConfig,
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
  let store: ReturnType<typeof configureStore<{ connection: ConnectionState }>>;

  const serverConfig: ServerConfig = {
    id: 'test-server-1',
    name: 'Test Server',
    url: 'localhost',
    port: 8080,
    username: 'testuser',
    password: 'testpass',
  };

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
        profiles: [],
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
        profiles: [],
        error: 'Some error',
      };

      const action = clearError();
      const newState = connectionReducer(initialState, action);

      expect(newState.error).toBeUndefined();
    });
  });

  describe('connectToServer async thunk', () => {

    it('should handle successful connection', async () => {
      mockElectronAPI.connectToServer.mockResolvedValue({ success: true });

      await store.dispatch(connectToServer(serverConfig));
      const state = store.getState().connection;

      expect(state.connected).toBe(true);
      expect(state.isConnecting).toBe(false);
      expect(state.config).toEqual(serverConfig);
      expect(state.serverUrl).toBe('http://localhost:8080');
      expect(state.profileId).toBe('test-server-1');
      expect(state.profileName).toBe('Test Server');
      expect(state.error).toBeUndefined();
    });

    it('should handle connection failure', async () => {
      const errorMessage = 'Connection failed';
      mockElectronAPI.connectToServer.mockResolvedValue({
        success: false,
        error: errorMessage
      });

      try {
        await store.dispatch(connectToServer(serverConfig));
      } catch (error) {
        // Expected to throw
      }

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
      // First connect to set up initial state
      mockElectronAPI.connectToServer.mockResolvedValue({ success: true });
      await store.dispatch(connectToServer(serverConfig));

      // Then disconnect
      mockElectronAPI.disconnectFromServer.mockResolvedValue({ success: true });
      await store.dispatch(disconnectFromServer());

      const state = store.getState().connection;

      expect(state.connected).toBe(false);
      expect(state.config).toBeUndefined();
      expect(state.serverUrl).toBeUndefined();
      expect(state.profileId).toBeUndefined();
      expect(state.profileName).toBeUndefined();
      expect(state.lastSync).toBeUndefined();
      expect(state.error).toBeUndefined();
      expect(state.isReconnecting).toBe(false);
      expect(state.userInfo).toBeUndefined();
      expect(state.currentProfile).toBeUndefined();
    });
  });

  describe('checkConnectionStatus async thunk', () => {
    it('should update state with connection status', async () => {
      const statusData = {
        connected: true,
        serverUrl: 'http://localhost:8080',
        profileId: 'test-profile',
        profileName: 'Test Profile',
        lastSync: '2023-01-01T00:00:00Z',
        error: undefined,
        isReconnecting: false,
        apiVersion: '1.0.0',
        userInfo: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      mockElectronAPI.getConnectionStatus.mockResolvedValue(statusData);

      await store.dispatch(checkConnectionStatus());
      const state = store.getState().connection;

      expect(state.connected).toBe(true);
      expect(state.serverUrl).toBe('http://localhost:8080');
      expect(state.profileId).toBe('test-profile');
      expect(state.profileName).toBe('Test Profile');
      expect(state.lastSync).toBe('2023-01-01T00:00:00Z');
      expect(state.isInitialized).toBe(true);
      expect(state.apiVersion).toBe('1.0.0');
      expect(state.userInfo).toEqual({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
      });
    });
  });
});
import { ServerConnectionManager, ServerConfig, ServerProfile } from '../server-connection';
import axios from 'axios';
import { safeStorage } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('axios');
jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => '/mock/user/data'),
  },
}));
jest.mock('fs/promises');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedSafeStorage = safeStorage as jest.Mocked<typeof safeStorage>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('ServerConnectionManager', () => {
  let connectionManager: ServerConnectionManager;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    connectionManager = new ServerConnectionManager();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      defaults: {
        headers: {
          common: {},
        },
      },
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedSafeStorage.isEncryptionAvailable.mockReturnValue(true);
  });

  describe('Profile Management', () => {
    const mockProfile: ServerProfile = {
      id: 'test-profile',
      name: 'Test Server',
      url: 'localhost',
      port: 8080,
      username: 'testuser',
      isDefault: true,
    };

    describe('saveProfile', () => {
      it('should save a new profile', async () => {
        mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
        mockedFs.writeFile.mockResolvedValue(undefined);

        await connectionManager.saveProfile(mockProfile);

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('server-profiles.json'),
          JSON.stringify([mockProfile], null, 2)
        );
      });

      it('should update an existing profile', async () => {
        const existingProfiles = [mockProfile];
        mockedFs.readFile.mockResolvedValue(JSON.stringify(existingProfiles));
        mockedFs.writeFile.mockResolvedValue(undefined);

        const updatedProfile = { ...mockProfile, name: 'Updated Server' };
        await connectionManager.saveProfile(updatedProfile);

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('server-profiles.json'),
          JSON.stringify([updatedProfile], null, 2)
        );
      });

      it('should set only one profile as default', async () => {
        const existingProfiles = [
          { ...mockProfile, id: 'profile1', isDefault: true },
          { ...mockProfile, id: 'profile2', isDefault: false },
        ];
        mockedFs.readFile.mockResolvedValue(JSON.stringify(existingProfiles));
        mockedFs.writeFile.mockResolvedValue(undefined);

        const newDefaultProfile = { ...mockProfile, id: 'profile3', isDefault: true };
        await connectionManager.saveProfile(newDefaultProfile);

        const savedProfiles = JSON.parse(
          (mockedFs.writeFile as jest.Mock).mock.calls[0][1]
        );
        
        expect(savedProfiles.filter((p: ServerProfile) => p.isDefault)).toHaveLength(1);
        expect(savedProfiles.find((p: ServerProfile) => p.id === 'profile3').isDefault).toBe(true);
      });
    });

    describe('loadProfiles', () => {
      it('should load existing profiles', async () => {
        const profiles = [mockProfile];
        mockedFs.readFile.mockResolvedValue(JSON.stringify(profiles));

        const result = await connectionManager.loadProfiles();

        expect(result).toEqual(profiles);
      });

      it('should return empty array if no profiles file exists', async () => {
        mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });

        const result = await connectionManager.loadProfiles();

        expect(result).toEqual([]);
      });
    });

    describe('deleteProfile', () => {
      it('should delete a profile and its credentials', async () => {
        const profiles = [mockProfile, { ...mockProfile, id: 'profile2' }];
        mockedFs.readFile.mockResolvedValue(JSON.stringify(profiles));
        mockedFs.writeFile.mockResolvedValue(undefined);
        mockedFs.unlink.mockResolvedValue(undefined);

        await connectionManager.deleteProfile('test-profile');

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('server-profiles.json'),
          JSON.stringify([{ ...mockProfile, id: 'profile2' }], null, 2)
        );
        expect(mockedFs.unlink).toHaveBeenCalledWith(
          expect.stringContaining('test-profile.cred')
        );
      });
    });
  });

  describe('Credential Storage', () => {
    it('should store credentials securely', async () => {
      const encryptedData = Buffer.from('encrypted-password');
      mockedSafeStorage.encryptString.mockReturnValue(encryptedData);
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await connectionManager.storeCredentials('test-profile', 'password123');

      expect(mockedSafeStorage.encryptString).toHaveBeenCalledWith('password123');
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-profile.cred'),
        encryptedData
      );
    });

    it('should load credentials securely', async () => {
      const encryptedData = Buffer.from('encrypted-password');
      mockedFs.readFile.mockResolvedValue(encryptedData);
      mockedSafeStorage.decryptString.mockReturnValue('password123');

      const result = await connectionManager.loadCredentials('test-profile');

      expect(result).toBe('password123');
      expect(mockedSafeStorage.decryptString).toHaveBeenCalledWith(encryptedData);
    });

    it('should return null if credentials file does not exist', async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await connectionManager.loadCredentials('test-profile');

      expect(result).toBeNull();
    });

    it('should throw error if encryption is not available', async () => {
      mockedSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      await expect(
        connectionManager.storeCredentials('test-profile', 'password123')
      ).rejects.toThrow('Secure storage is not available on this system');
    });
  });

  describe('Connection Management', () => {
    const mockConfig: ServerConfig = {
      id: 'test-profile',
      name: 'Test Server',
      url: 'localhost',
      port: 8080,
      username: 'testuser',
      password: 'password123',
    };

    it('should connect successfully', async () => {
      // Mock successful health check
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { version: '1.0.0' },
      });

      // Mock successful authentication
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          token: 'jwt-token',
          refreshToken: 'refresh-token',
          user: { id: '1', username: 'testuser' },
          expiresIn: 3600,
        },
      });

      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedSafeStorage.encryptString.mockReturnValue(Buffer.from('encrypted'));
      mockedFs.mkdir.mockResolvedValue(undefined);

      await connectionManager.connect(mockConfig);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'testuser',
        password: 'password123',
      });

      const status = connectionManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.serverUrl).toBe('http://localhost:8080');
      expect(status.profileId).toBe('test-profile');
    });

    it('should handle connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));

      await expect(connectionManager.connect(mockConfig)).rejects.toThrow();

      const status = connectionManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.error).toBeDefined();
    });

    it('should handle authentication failure', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      mockAxiosInstance.post.mockRejectedValue({
        response: { status: 401 },
        isAxiosError: true,
      });

      await expect(connectionManager.connect(mockConfig)).rejects.toThrow();

      const status = connectionManager.getStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe('Profile Connection', () => {
    const mockProfile: ServerProfile = {
      id: 'test-profile',
      name: 'Test Server',
      url: 'localhost',
      port: 8080,
      username: 'testuser',
    };

    it('should connect with stored credentials', async () => {
      mockedFs.readFile.mockResolvedValueOnce(JSON.stringify([mockProfile]));
      mockedFs.readFile.mockResolvedValueOnce(Buffer.from('encrypted'));
      mockedSafeStorage.decryptString.mockReturnValue('password123');

      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          token: 'jwt-token',
          user: { id: '1', username: 'testuser' },
        },
      });

      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedSafeStorage.encryptString.mockReturnValue(Buffer.from('encrypted'));
      mockedFs.mkdir.mockResolvedValue(undefined);

      await connectionManager.connectWithProfile('test-profile');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'testuser',
        password: 'password123',
      });
    });

    it('should throw error if profile not found', async () => {
      mockedFs.readFile.mockResolvedValue(JSON.stringify([]));

      await expect(
        connectionManager.connectWithProfile('nonexistent-profile')
      ).rejects.toThrow('Server profile not found');
    });

    it('should throw error if no stored credentials', async () => {
      mockedFs.readFile.mockResolvedValueOnce(JSON.stringify([mockProfile]));
      mockedFs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });

      await expect(
        connectionManager.connectWithProfile('test-profile')
      ).rejects.toThrow('Password required for connection');
    });
  });

  describe('Connection Testing', () => {
    it('should return true for successful connection test', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      connectionManager['client'] = mockAxiosInstance;
      connectionManager['status'] = { connected: false };

      const result = await connectionManager.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });

    it('should return false for failed connection test', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));
      connectionManager['client'] = mockAxiosInstance;
      connectionManager['status'] = { connected: true };

      const result = await connectionManager.testConnection();

      expect(result).toBe(false);
    });

    it('should return false if no client available', async () => {
      const result = await connectionManager.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Token Management', () => {
    beforeEach(() => {
      connectionManager['client'] = mockAxiosInstance;
      connectionManager['refreshToken'] = 'refresh-token';
    });

    it('should refresh token successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          token: 'new-jwt-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        },
      });

      await connectionManager['refreshAuthToken']();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/auth/refresh', {
        refreshToken: 'refresh-token',
      });
      expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe(
        'Bearer new-jwt-token'
      );
    });

    it('should handle token refresh failure', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Refresh failed'));
      const handleConnectionLossSpy = jest.spyOn(
        connectionManager as any,
        'handleConnectionLoss'
      );

      await connectionManager['refreshAuthToken']();

      expect(handleConnectionLossSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', () => {
      const axiosError = {
        isAxiosError: true,
        code: 'ECONNREFUSED',
      };

      const message = connectionManager['getErrorMessage'](axiosError);
      expect(message).toBe('Connection refused - server may be offline');
    });

    it('should handle different HTTP status codes', () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 401 },
      };

      const message = connectionManager['getErrorMessage'](axiosError);
      expect(message).toBe('Authentication failed - invalid credentials');
    });

    it('should handle generic errors', () => {
      const error = new Error('Generic error');

      const message = connectionManager['getErrorMessage'](error);
      expect(message).toBe('Generic error');
    });
  });

  describe('Disconnect', () => {
    it('should disconnect cleanly', async () => {
      connectionManager['client'] = mockAxiosInstance;
      connectionManager['authToken'] = 'jwt-token';
      mockAxiosInstance.post.mockResolvedValue({});

      await connectionManager.disconnect();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/auth/logout',
        {},
        { headers: { Authorization: 'Bearer jwt-token' } }
      );
      expect(connectionManager.getClient()).toBeNull();
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should handle logout failure gracefully', async () => {
      connectionManager['client'] = mockAxiosInstance;
      connectionManager['authToken'] = 'jwt-token';
      mockAxiosInstance.post.mockRejectedValue(new Error('Logout failed'));

      await expect(connectionManager.disconnect()).resolves.not.toThrow();
      expect(connectionManager.getClient()).toBeNull();
    });
  });
});
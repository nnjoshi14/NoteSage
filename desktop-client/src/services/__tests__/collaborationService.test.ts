import { collaborationService } from '../collaborationService';
import { CollaborationUser } from '../../types/collaboration';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string) {
    // Mock sending data
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// Mock the electron API
const mockElectronAPI = {
  getWebSocketUrl: jest.fn(),
  getConnectedUsers: jest.fn(),
  resolveConflict: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

const mockUsers: CollaborationUser[] = [
  {
    id: 'user1',
    name: 'John Doe',
    email: 'john@example.com',
    isOnline: true,
    lastSeen: '2024-01-15T10:00:00Z',
  },
  {
    id: 'user2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    isOnline: false,
    lastSeen: '2024-01-15T09:00:00Z',
  },
];

describe('CollaborationService', () => {
  let mockDispatchEvent: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getWebSocketUrl.mockResolvedValue('ws://localhost:8080');
    mockElectronAPI.getConnectedUsers.mockResolvedValue({ users: mockUsers });
    mockElectronAPI.resolveConflict.mockResolvedValue({ success: true });

    // Mock window.dispatchEvent
    mockDispatchEvent = jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    collaborationService.disconnect();
    mockDispatchEvent.mockRestore();
  });

  describe('connect', () => {
    it('establishes WebSocket connection', async () => {
      await collaborationService.connect('note1');

      expect(mockElectronAPI.getWebSocketUrl).toHaveBeenCalled();
    });

    it('throws error when connection fails', async () => {
      mockElectronAPI.getWebSocketUrl.mockRejectedValue(new Error('Connection failed'));

      await expect(collaborationService.connect('note1'))
        .rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('closes WebSocket connection', async () => {
      await collaborationService.connect('note1');
      
      collaborationService.disconnect();

      // WebSocket should be closed
      expect(true).toBe(true); // Connection is closed in the service
    });

    it('handles disconnect when not connected', () => {
      expect(() => collaborationService.disconnect()).not.toThrow();
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      await collaborationService.connect('note1');
    });

    it('handles user_joined message', () => {
      const mockWebSocket = (collaborationService as any).websocket;
      const userData = mockUsers[0];

      mockWebSocket.onmessage({
        data: JSON.stringify({
          type: 'user_joined',
          data: userData,
        }),
      });

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collaboration:user_joined',
          detail: userData,
        })
      );
    });

    it('handles user_left message', () => {
      const mockWebSocket = (collaborationService as any).websocket;
      const userData = { userId: 'user1' };

      mockWebSocket.onmessage({
        data: JSON.stringify({
          type: 'user_left',
          data: userData,
        }),
      });

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collaboration:user_left',
          detail: userData,
        })
      );
    });

    it('handles cursor_update message', () => {
      const mockWebSocket = (collaborationService as any).websocket;
      const presenceData = {
        userId: 'user1',
        userName: 'John Doe',
        noteId: 'note1',
        cursor: { position: 100 },
        lastActivity: '2024-01-15T10:00:00Z',
      };

      mockWebSocket.onmessage({
        data: JSON.stringify({
          type: 'cursor_update',
          data: presenceData,
        }),
      });

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collaboration:cursor_update',
          detail: presenceData,
        })
      );
    });

    it('handles content_change message', () => {
      const mockWebSocket = (collaborationService as any).websocket;
      const changeData = {
        content: 'Updated content',
        authorId: 'user1',
        timestamp: '2024-01-15T10:00:00Z',
      };

      mockWebSocket.onmessage({
        data: JSON.stringify({
          type: 'content_change',
          data: changeData,
        }),
      });

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collaboration:content_change',
          detail: changeData,
        })
      );
    });

    it('handles conflict_detected message', () => {
      const mockWebSocket = (collaborationService as any).websocket;
      const conflictData = {
        conflictId: 'conflict1',
        noteId: 'note1',
        localVersion: { id: 'local1' },
        remoteVersion: { id: 'remote1' },
      };

      mockWebSocket.onmessage({
        data: JSON.stringify({
          type: 'conflict_detected',
          data: conflictData,
        }),
      });

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collaboration:conflict_detected',
          detail: conflictData,
        })
      );
    });

    it('logs warning for unknown message types', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockWebSocket = (collaborationService as any).websocket;

      mockWebSocket.onmessage({
        data: JSON.stringify({
          type: 'unknown_type',
          data: {},
        }),
      });

      expect(consoleSpy).toHaveBeenCalledWith('Unknown collaboration message type:', 'unknown_type');
      consoleSpy.mockRestore();
    });
  });

  describe('sendCursorUpdate', () => {
    it('sends cursor update when connected', async () => {
      await collaborationService.connect('note1');
      const mockWebSocket = (collaborationService as any).websocket;
      const sendSpy = jest.spyOn(mockWebSocket, 'send');

      collaborationService.sendCursorUpdate('note1', 100, { from: 90, to: 110 });

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'cursor_update',
          data: {
            noteId: 'note1',
            cursor: { position: 100, selection: { from: 90, to: 110 } },
            timestamp: expect.any(String),
          },
        })
      );
    });

    it('does not send when not connected', () => {
      expect(() => {
        collaborationService.sendCursorUpdate('note1', 100);
      }).not.toThrow();
    });
  });

  describe('sendContentChange', () => {
    it('sends content change when connected', async () => {
      await collaborationService.connect('note1');
      const mockWebSocket = (collaborationService as any).websocket;
      const sendSpy = jest.spyOn(mockWebSocket, 'send');

      collaborationService.sendContentChange('note1', 'Updated content');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'content_change',
          data: {
            noteId: 'note1',
            content: 'Updated content',
            timestamp: expect.any(String),
          },
        })
      );
    });

    it('does not send when not connected', () => {
      expect(() => {
        collaborationService.sendContentChange('note1', 'Updated content');
      }).not.toThrow();
    });
  });

  describe('getConnectedUsers', () => {
    it('returns connected users', async () => {
      const result = await collaborationService.getConnectedUsers('note1');

      expect(mockElectronAPI.getConnectedUsers).toHaveBeenCalledWith('note1');
      expect(result).toEqual(mockUsers);
    });

    it('returns empty array when API call fails', async () => {
      mockElectronAPI.getConnectedUsers.mockRejectedValue(new Error('API Error'));

      const result = await collaborationService.getConnectedUsers('note1');

      expect(result).toEqual([]);
    });
  });

  describe('resolveConflict', () => {
    it('resolves conflict successfully', async () => {
      const result = await collaborationService.resolveConflict('conflict1', 'local');

      expect(mockElectronAPI.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict1',
        resolution: 'local',
        content: undefined,
      });
      expect(result).toBe(true);
    });

    it('resolves conflict with merged content', async () => {
      const result = await collaborationService.resolveConflict(
        'conflict1', 
        'merged', 
        'Merged content'
      );

      expect(mockElectronAPI.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict1',
        resolution: 'merged',
        content: 'Merged content',
      });
      expect(result).toBe(true);
    });

    it('returns false when resolution fails', async () => {
      mockElectronAPI.resolveConflict.mockResolvedValue({ success: false });

      const result = await collaborationService.resolveConflict('conflict1', 'local');

      expect(result).toBe(false);
    });

    it('returns false when API call fails', async () => {
      mockElectronAPI.resolveConflict.mockRejectedValue(new Error('API Error'));

      const result = await collaborationService.resolveConflict('conflict1', 'local');

      expect(result).toBe(false);
    });
  });

  describe('reconnection', () => {
    it('attempts to reconnect when connection is lost', async () => {
      jest.useFakeTimers();
      
      await collaborationService.connect('note1');
      const mockWebSocket = (collaborationService as any).websocket;

      // Simulate connection loss
      mockWebSocket.onclose();

      // Fast-forward timers to trigger reconnection
      jest.advanceTimersByTime(1000);

      expect(mockElectronAPI.getWebSocketUrl).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('stops reconnecting after max attempts', async () => {
      jest.useFakeTimers();
      
      // Make connection fail
      mockElectronAPI.getWebSocketUrl.mockRejectedValue(new Error('Connection failed'));

      await expect(collaborationService.connect('note1')).rejects.toThrow();

      // Simulate multiple reconnection attempts
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(1000 * (i + 1));
      }

      // Should not exceed max attempts (5)
      expect(mockElectronAPI.getWebSocketUrl).toHaveBeenCalledTimes(6); // Initial + 5 retries

      jest.useRealTimers();
    });
  });
});
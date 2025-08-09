import { CollaborationUser, UserPresence, ConflictResolution } from '../types/collaboration';

export class CollaborationService {
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  async connect(noteId: string): Promise<void> {
    try {
      const wsUrl = await window.electronAPI.getWebSocketUrl();
      this.websocket = new WebSocket(`${wsUrl}/collaboration/${noteId}`);
      
      this.websocket.onopen = () => {
        console.log('Collaboration WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.websocket.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.websocket.onclose = () => {
        console.log('Collaboration WebSocket disconnected');
        this.attemptReconnect(noteId);
      };

      this.websocket.onerror = (error) => {
        console.error('Collaboration WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to collaboration service:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  private attemptReconnect(noteId: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(noteId);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'user_joined':
        this.handleUserJoined(message.data);
        break;
      case 'user_left':
        this.handleUserLeft(message.data);
        break;
      case 'cursor_update':
        this.handleCursorUpdate(message.data);
        break;
      case 'content_change':
        this.handleContentChange(message.data);
        break;
      case 'conflict_detected':
        this.handleConflictDetected(message.data);
        break;
      default:
        console.warn('Unknown collaboration message type:', message.type);
    }
  }

  private handleUserJoined(data: CollaborationUser): void {
    window.dispatchEvent(new CustomEvent('collaboration:user_joined', { detail: data }));
  }

  private handleUserLeft(data: { userId: string }): void {
    window.dispatchEvent(new CustomEvent('collaboration:user_left', { detail: data }));
  }

  private handleCursorUpdate(data: UserPresence): void {
    window.dispatchEvent(new CustomEvent('collaboration:cursor_update', { detail: data }));
  }

  private handleContentChange(data: { content: string; authorId: string; timestamp: string }): void {
    window.dispatchEvent(new CustomEvent('collaboration:content_change', { detail: data }));
  }

  private handleConflictDetected(data: ConflictResolution): void {
    window.dispatchEvent(new CustomEvent('collaboration:conflict_detected', { detail: data }));
  }

  sendCursorUpdate(noteId: string, position: number, selection?: { from: number; to: number }): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'cursor_update',
        data: {
          noteId,
          cursor: { position, selection },
          timestamp: new Date().toISOString()
        }
      }));
    }
  }

  sendContentChange(noteId: string, content: string): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'content_change',
        data: {
          noteId,
          content,
          timestamp: new Date().toISOString()
        }
      }));
    }
  }

  async getConnectedUsers(noteId: string): Promise<CollaborationUser[]> {
    try {
      const response = await window.electronAPI.getConnectedUsers(noteId);
      return response.users || [];
    } catch (error) {
      console.error('Failed to get connected users:', error);
      return [];
    }
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merged', content?: string): Promise<boolean> {
    try {
      const response = await window.electronAPI.resolveConflict({
        conflictId,
        resolution,
        content
      });
      return response.success;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    }
  }
}

export const collaborationService = new CollaborationService();
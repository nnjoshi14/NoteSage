import axios, { AxiosInstance } from 'axios';

export interface ServerConfig {
  url: string;
  port: number;
  username: string;
  password: string;
}

export interface ConnectionStatus {
  connected: boolean;
  serverUrl?: string;
  lastSync?: Date;
  error?: string;
}

export class ServerConnectionManager {
  private client: AxiosInstance | null = null;
  private config: ServerConfig | null = null;
  private status: ConnectionStatus = { connected: false };
  private authToken: string | null = null;

  async connect(config: ServerConfig): Promise<void> {
    this.config = config;
    const baseURL = `http://${config.url}:${config.port}`;

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    try {
      // Test connection with health check
      await this.client.get('/health');

      // Authenticate
      const response = await this.client.post('/api/auth/login', {
        username: config.username,
        password: config.password,
      });

      this.authToken = response.data.token;

      // Set authorization header for future requests
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;

      this.status = {
        connected: true,
        serverUrl: baseURL,
        lastSync: new Date(),
      };
    } catch (error) {
      this.status = {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.config = null;
    this.authToken = null;
    this.status = { connected: false };
  }

  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  getClient(): AxiosInstance | null {
    return this.client;
  }

  isConnected(): boolean {
    return this.status.connected && this.client !== null;
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.get('/health');
      return true;
    } catch {
      this.status.connected = false;
      return false;
    }
  }

  async refreshToken(): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('Not connected to server');
    }

    try {
      const response = await this.client.post('/api/auth/login', {
        username: this.config.username,
        password: this.config.password,
      });

      this.authToken = response.data.token;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
    } catch (error) {
      this.status.connected = false;
      throw error;
    }
  }
}
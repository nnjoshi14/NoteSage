"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerConnectionManager = void 0;
const axios_1 = __importDefault(require("axios"));
const electron_1 = require("electron");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const electron_2 = require("electron");
class ServerConnectionManager {
    constructor() {
        this.client = null;
        this.currentProfile = null;
        this.status = { connected: false };
        this.authToken = null;
        this.refreshToken = null;
        this.tokenExpiryTime = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        const userDataPath = electron_2.app.getPath('userData');
        this.profilesPath = path.join(userDataPath, 'server-profiles.json');
        this.credentialsPath = path.join(userDataPath, 'credentials');
    }
    // Profile Management
    async saveProfile(profile) {
        try {
            const profiles = await this.loadProfiles();
            const existingIndex = profiles.findIndex(p => p.id === profile.id);
            if (existingIndex >= 0) {
                profiles[existingIndex] = { ...profiles[existingIndex], ...profile };
            }
            else {
                profiles.push(profile);
            }
            // If this is marked as default, remove default from others
            if (profile.isDefault) {
                profiles.forEach(p => {
                    if (p.id !== profile.id) {
                        p.isDefault = false;
                    }
                });
            }
            await fs.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
        }
        catch (error) {
            console.error('Failed to save profile:', error);
            throw new Error('Failed to save server profile');
        }
    }
    async loadProfiles() {
        try {
            const data = await fs.readFile(this.profilesPath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return []; // File doesn't exist yet
            }
            console.error('Failed to load profiles:', error);
            return [];
        }
    }
    async deleteProfile(profileId) {
        try {
            const profiles = await this.loadProfiles();
            const filteredProfiles = profiles.filter(p => p.id !== profileId);
            await fs.writeFile(this.profilesPath, JSON.stringify(filteredProfiles, null, 2));
            // Also delete stored credentials for this profile
            await this.deleteStoredCredentials(profileId);
        }
        catch (error) {
            console.error('Failed to delete profile:', error);
            throw new Error('Failed to delete server profile');
        }
    }
    async getDefaultProfile() {
        const profiles = await this.loadProfiles();
        return profiles.find(p => p.isDefault) || profiles[0] || null;
    }
    // Secure Credential Storage
    async storeCredentials(profileId, password) {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new Error('Secure storage is not available on this system');
        }
        try {
            const encrypted = electron_1.safeStorage.encryptString(password);
            const credentialFile = path.join(this.credentialsPath, `${profileId}.cred`);
            // Ensure credentials directory exists
            await fs.mkdir(this.credentialsPath, { recursive: true });
            await fs.writeFile(credentialFile, encrypted);
        }
        catch (error) {
            console.error('Failed to store credentials:', error);
            throw new Error('Failed to store credentials securely');
        }
    }
    async loadCredentials(profileId) {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            return null;
        }
        try {
            const credentialFile = path.join(this.credentialsPath, `${profileId}.cred`);
            const encrypted = await fs.readFile(credentialFile);
            return electron_1.safeStorage.decryptString(encrypted);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null; // Credentials not stored
            }
            console.error('Failed to load credentials:', error);
            return null;
        }
    }
    async deleteStoredCredentials(profileId) {
        try {
            const credentialFile = path.join(this.credentialsPath, `${profileId}.cred`);
            await fs.unlink(credentialFile);
        }
        catch (error) {
            // Ignore if file doesn't exist
            if (error.code !== 'ENOENT') {
                console.error('Failed to delete credentials:', error);
            }
        }
    }
    // Connection Management
    async connect(config) {
        this.clearReconnectTimer();
        try {
            // Store credentials securely
            await this.storeCredentials(config.id, config.password);
            // Update profile with last used timestamp
            const profile = {
                id: config.id,
                name: config.name,
                url: config.url,
                port: config.port,
                username: config.username,
                isDefault: config.isDefault,
                lastUsed: new Date(),
            };
            await this.saveProfile(profile);
            this.currentProfile = profile;
            const baseURL = `http://${config.url}:${config.port}`;
            this.client = axios_1.default.create({
                baseURL,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            // Add request interceptor for token refresh
            this.setupRequestInterceptor();
            // Add response interceptor for error handling
            this.setupResponseInterceptor();
            // Test connection and get API version
            const healthResponse = await this.client.get('/health');
            const apiVersion = healthResponse.data?.version || 'unknown';
            // Update profile with API version
            profile.apiVersion = apiVersion;
            await this.saveProfile(profile);
            // Authenticate
            const authResponse = await this.authenticate(config.username, config.password);
            this.authToken = authResponse.token;
            this.refreshToken = authResponse.refreshToken || null;
            // Calculate token expiry time
            if (authResponse.expiresIn) {
                this.tokenExpiryTime = Date.now() + (authResponse.expiresIn * 1000);
            }
            // Set authorization header for future requests
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
            this.status = {
                connected: true,
                serverUrl: baseURL,
                profileId: config.id,
                profileName: config.name,
                lastSync: new Date(),
                apiVersion,
                userInfo: authResponse.user,
            };
            this.reconnectAttempts = 0;
            this.scheduleTokenRefresh();
        }
        catch (error) {
            this.status = {
                connected: false,
                profileId: config.id,
                profileName: config.name,
                error: this.getErrorMessage(error),
            };
            throw error;
        }
    }
    async connectWithProfile(profileId, password) {
        const profiles = await this.loadProfiles();
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) {
            throw new Error('Server profile not found');
        }
        // Try to load stored password if not provided
        const storedPassword = password || await this.loadCredentials(profileId);
        if (!storedPassword) {
            throw new Error('Password required for connection');
        }
        const config = {
            ...profile,
            password: storedPassword,
        };
        await this.connect(config);
    }
    async switchProfile(profileId, password) {
        await this.disconnect();
        await this.connectWithProfile(profileId, password);
    }
    async disconnect() {
        this.clearReconnectTimer();
        try {
            // Attempt to logout from server
            if (this.client && this.authToken) {
                await this.client.post('/api/auth/logout', {}, {
                    headers: { Authorization: `Bearer ${this.authToken}` }
                });
            }
        }
        catch (error) {
            // Ignore logout errors during disconnect
            console.warn('Logout failed during disconnect:', error);
        }
        this.client = null;
        this.currentProfile = null;
        this.authToken = null;
        this.refreshToken = null;
        this.tokenExpiryTime = null;
        this.status = { connected: false };
    }
    // Authentication
    async authenticate(username, password) {
        if (!this.client) {
            throw new Error('No client available for authentication');
        }
        try {
            const response = await this.client.post('/api/auth/login', {
                username,
                password,
            });
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    throw new Error('Invalid username or password');
                }
                else if (error.response?.status === 403) {
                    throw new Error('Account is disabled or access denied');
                }
            }
            throw new Error('Authentication failed');
        }
    }
    async refreshAuthToken() {
        if (!this.client || !this.refreshToken) {
            throw new Error('Cannot refresh token: missing client or refresh token');
        }
        try {
            const response = await this.client.post('/api/auth/refresh', {
                refreshToken: this.refreshToken,
            });
            const authResponse = response.data;
            this.authToken = authResponse.token;
            this.refreshToken = authResponse.refreshToken || this.refreshToken;
            if (authResponse.expiresIn) {
                this.tokenExpiryTime = Date.now() + (authResponse.expiresIn * 1000);
            }
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
            this.scheduleTokenRefresh();
        }
        catch (error) {
            console.error('Token refresh failed:', error);
            // If refresh fails, try to reconnect
            this.handleConnectionLoss();
        }
    }
    scheduleTokenRefresh() {
        if (!this.tokenExpiryTime)
            return;
        // Schedule refresh 5 minutes before expiry
        const refreshTime = this.tokenExpiryTime - Date.now() - (5 * 60 * 1000);
        if (refreshTime > 0) {
            setTimeout(() => {
                this.refreshAuthToken().catch(error => {
                    console.error('Scheduled token refresh failed:', error);
                });
            }, refreshTime);
        }
    }
    // Request/Response Interceptors
    setupRequestInterceptor() {
        if (!this.client)
            return;
        this.client.interceptors.request.use((config) => {
            // Add timestamp to prevent caching
            if (config.method === 'get') {
                config.params = { ...config.params, _t: Date.now() };
            }
            return config;
        }, (error) => Promise.reject(error));
    }
    setupResponseInterceptor() {
        if (!this.client)
            return;
        this.client.interceptors.response.use((response) => response, async (error) => {
            if (error.response?.status === 401 && this.refreshToken) {
                try {
                    await this.refreshAuthToken();
                    // Retry the original request
                    if (error.config) {
                        error.config.headers = error.config.headers || {};
                        error.config.headers['Authorization'] = `Bearer ${this.authToken}`;
                        return this.client.request(error.config);
                    }
                }
                catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    this.handleConnectionLoss();
                }
            }
            else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                this.handleConnectionLoss();
            }
            return Promise.reject(error);
        });
    }
    // Connection Monitoring and Reconnection
    handleConnectionLoss() {
        if (this.status.connected) {
            this.status.connected = false;
            this.status.error = 'Connection lost';
            this.status.isReconnecting = true;
            this.startReconnection();
        }
    }
    startReconnection() {
        if (this.reconnectTimer || !this.currentProfile)
            return;
        this.reconnectTimer = setTimeout(async () => {
            try {
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.status.isReconnecting = false;
                    this.status.error = 'Maximum reconnection attempts reached';
                    return;
                }
                this.reconnectAttempts++;
                console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                const password = await this.loadCredentials(this.currentProfile.id);
                if (password) {
                    await this.connectWithProfile(this.currentProfile.id, password);
                    console.log('Reconnection successful');
                }
                else {
                    throw new Error('No stored credentials for reconnection');
                }
            }
            catch (error) {
                console.error('Reconnection failed:', error);
                // Exponential backoff
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
                this.clearReconnectTimer();
                this.startReconnection();
            }
        }, this.reconnectDelay);
    }
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    async testConnection() {
        if (!this.client)
            return false;
        try {
            await this.client.get('/health');
            if (!this.status.connected) {
                this.status.connected = true;
                this.status.error = undefined;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
            }
            return true;
        }
        catch (error) {
            if (this.status.connected) {
                this.handleConnectionLoss();
            }
            return false;
        }
    }
    // Status and Utility Methods
    getStatus() {
        return { ...this.status };
    }
    getClient() {
        return this.client;
    }
    isConnected() {
        return this.status.connected && this.client !== null;
    }
    getCurrentProfile() {
        return this.currentProfile ? { ...this.currentProfile } : null;
    }
    getErrorMessage(error) {
        if (axios_1.default.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                return 'Connection refused - server may be offline';
            }
            else if (error.code === 'ENOTFOUND') {
                return 'Server not found - check URL and network connection';
            }
            else if (error.code === 'ETIMEDOUT') {
                return 'Connection timeout - server may be slow or unreachable';
            }
            else if (error.response?.status === 401) {
                return 'Authentication failed - invalid credentials';
            }
            else if (error.response?.status === 403) {
                return 'Access denied - account may be disabled';
            }
            else if (error.response?.status && error.response.status >= 500) {
                return 'Server error - please try again later';
            }
            return error.message;
        }
        return error instanceof Error ? error.message : 'Unknown connection error';
    }
}
exports.ServerConnectionManager = ServerConnectionManager;

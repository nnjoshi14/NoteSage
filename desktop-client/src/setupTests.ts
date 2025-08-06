// Mock electron API
const mockElectronAPI = {
  connectToServer: jest.fn(),
  disconnectFromServer: jest.fn(),
  getConnectionStatus: jest.fn(),
  syncData: jest.fn(),
  getCachedNotes: jest.fn(),
  cacheNote: jest.fn(),
  onMenuNewNote: jest.fn(),
  onMenuSave: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Add to global window object
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
import { configureStore } from '@reduxjs/toolkit';
import collaborationReducer, {
  loadVersionHistory,
  loadVersion,
  restoreVersion,
  createVersion,
  startCollaboration,
  stopCollaboration,
  resolveConflict,
  setCurrentVersion,
  clearVersionHistory,
  userJoined,
  userLeft,
  updateUserPresence,
  clearUserPresences,
  addConflict,
  setActiveConflict,
  removeConflict,
  clearConflicts,
  clearVersionError,
} from '../collaborationSlice';
import { NoteVersion, CollaborationUser, UserPresence, ConflictResolution } from '../../../types/collaboration';

// Mock the services
jest.mock('../../../services/versionHistoryService', () => ({
  versionHistoryService: {
    getVersionHistory: jest.fn(),
    getVersion: jest.fn(),
    restoreVersion: jest.fn(),
    createVersion: jest.fn(),
  },
}));

jest.mock('../../../services/collaborationService', () => ({
  collaborationService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    getConnectedUsers: jest.fn(),
    resolveConflict: jest.fn(),
  },
}));

import { versionHistoryService } from '../../../services/versionHistoryService';
import { collaborationService } from '../../../services/collaborationService';

const mockVersionHistoryService = versionHistoryService as jest.Mocked<typeof versionHistoryService>;
const mockCollaborationService = collaborationService as jest.Mocked<typeof collaborationService>;

const mockVersions: NoteVersion[] = [
  {
    id: 'v1',
    noteId: 'note1',
    version: 2,
    title: 'Test Note',
    content: 'Version 2 content',
    authorId: 'user1',
    authorName: 'John Doe',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'v2',
    noteId: 'note1',
    version: 1,
    title: 'Test Note',
    content: 'Version 1 content',
    authorId: 'user1',
    authorName: 'John Doe',
    createdAt: '2024-01-15T09:00:00Z',
  },
];

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

const mockConflict: ConflictResolution = {
  conflictId: 'conflict1',
  noteId: 'note1',
  localVersion: mockVersions[0],
  remoteVersion: mockVersions[1],
};

const createTestStore = () => {
  return configureStore({
    reducer: {
      collaboration: collaborationReducer,
    },
  });
};

describe('collaborationSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = store.getState().collaboration;

      expect(state).toEqual({
        versions: [],
        currentVersion: null,
        isLoadingVersions: false,
        versionError: undefined,
        connectedUsers: [],
        userPresences: [],
        isCollaborating: false,
        conflicts: [],
        activeConflict: null,
      });
    });
  });

  describe('version history actions', () => {
    describe('loadVersionHistory', () => {
      it('handles successful version history loading', async () => {
        mockVersionHistoryService.getVersionHistory.mockResolvedValue(mockVersions);

        await store.dispatch(loadVersionHistory('note1'));

        const state = store.getState().collaboration;
        expect(state.versions).toEqual(mockVersions);
        expect(state.isLoadingVersions).toBe(false);
        expect(state.versionError).toBeUndefined();
      });

      it('handles version history loading error', async () => {
        mockVersionHistoryService.getVersionHistory.mockRejectedValue(new Error('Load failed'));

        await store.dispatch(loadVersionHistory('note1'));

        const state = store.getState().collaboration;
        expect(state.versions).toEqual([]);
        expect(state.isLoadingVersions).toBe(false);
        expect(state.versionError).toBe('Load failed');
      });

      it('sets loading state during request', () => {
        mockVersionHistoryService.getVersionHistory.mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );

        store.dispatch(loadVersionHistory('note1'));

        const state = store.getState().collaboration;
        expect(state.isLoadingVersions).toBe(true);
        expect(state.versionError).toBeUndefined();
      });
    });

    describe('loadVersion', () => {
      it('handles successful version loading', async () => {
        mockVersionHistoryService.getVersion.mockResolvedValue(mockVersions[0]);

        await store.dispatch(loadVersion({ noteId: 'note1', version: 2 }));

        const state = store.getState().collaboration;
        expect(state.currentVersion).toEqual(mockVersions[0]);
      });

      it('handles version loading error', async () => {
        mockVersionHistoryService.getVersion.mockRejectedValue(new Error('Load failed'));

        await store.dispatch(loadVersion({ noteId: 'note1', version: 2 }));

        const state = store.getState().collaboration;
        expect(state.versionError).toBe('Load failed');
      });
    });

    describe('restoreVersion', () => {
      it('handles successful version restoration', async () => {
        mockVersionHistoryService.restoreVersion.mockResolvedValue(true);

        await store.dispatch(restoreVersion({ noteId: 'note1', version: 2 }));

        const state = store.getState().collaboration;
        expect(state.versionError).toBeUndefined();
      });

      it('handles version restoration error', async () => {
        mockVersionHistoryService.restoreVersion.mockResolvedValue(false);

        await expect(
          store.dispatch(restoreVersion({ noteId: 'note1', version: 2 }))
        ).rejects.toThrow('Failed to restore version');
      });
    });

    describe('createVersion', () => {
      it('handles successful version creation', async () => {
        mockVersionHistoryService.createVersion.mockResolvedValue(mockVersions[0]);

        await store.dispatch(createVersion({
          noteId: 'note1',
          content: 'New content',
          changeDescription: 'Added section',
        }));

        const state = store.getState().collaboration;
        expect(state.versions[0]).toEqual(mockVersions[0]);
        expect(state.currentVersion).toEqual(mockVersions[0]);
      });

      it('handles version creation error', async () => {
        mockVersionHistoryService.createVersion.mockRejectedValue(new Error('Create failed'));

        await store.dispatch(createVersion({
          noteId: 'note1',
          content: 'New content',
        }));

        const state = store.getState().collaboration;
        expect(state.versionError).toBe('Create failed');
      });
    });
  });

  describe('collaboration actions', () => {
    describe('startCollaboration', () => {
      it('handles successful collaboration start', async () => {
        mockCollaborationService.connect.mockResolvedValue(undefined);
        mockCollaborationService.getConnectedUsers.mockResolvedValue(mockUsers);

        await store.dispatch(startCollaboration('note1'));

        const state = store.getState().collaboration;
        expect(state.isCollaborating).toBe(true);
        expect(state.connectedUsers).toEqual(mockUsers);
      });

      it('handles collaboration start error', async () => {
        mockCollaborationService.connect.mockRejectedValue(new Error('Connect failed'));

        await store.dispatch(startCollaboration('note1'));

        const state = store.getState().collaboration;
        expect(state.isCollaborating).toBe(false);
      });
    });

    describe('stopCollaboration', () => {
      it('handles collaboration stop', async () => {
        // First start collaboration
        store.dispatch(userJoined(mockUsers[0]));
        store.dispatch(updateUserPresence({
          userId: 'user1',
          userName: 'John Doe',
          noteId: 'note1',
          lastActivity: '2024-01-15T10:00:00Z',
        }));

        mockCollaborationService.disconnect.mockResolvedValue(undefined);

        await store.dispatch(stopCollaboration());

        const state = store.getState().collaboration;
        expect(state.isCollaborating).toBe(false);
        expect(state.connectedUsers).toEqual([]);
        expect(state.userPresences).toEqual([]);
      });
    });

    describe('resolveConflict', () => {
      it('handles successful conflict resolution', async () => {
        // Add conflict first
        store.dispatch(addConflict(mockConflict));

        mockCollaborationService.resolveConflict.mockResolvedValue(true);

        await store.dispatch(resolveConflict({
          conflictId: 'conflict1',
          resolution: 'local',
        }));

        const state = store.getState().collaboration;
        expect(state.conflicts).toEqual([]);
        expect(state.activeConflict).toBeNull();
      });

      it('handles conflict resolution error', async () => {
        mockCollaborationService.resolveConflict.mockResolvedValue(false);

        await expect(
          store.dispatch(resolveConflict({
            conflictId: 'conflict1',
            resolution: 'local',
          }))
        ).rejects.toThrow('Failed to resolve conflict');
      });
    });
  });

  describe('synchronous actions', () => {
    describe('version history actions', () => {
      it('setCurrentVersion sets current version', () => {
        store.dispatch(setCurrentVersion(mockVersions[0]));

        const state = store.getState().collaboration;
        expect(state.currentVersion).toEqual(mockVersions[0]);
      });

      it('clearVersionHistory clears version data', () => {
        // Set some data first
        store.dispatch(setCurrentVersion(mockVersions[0]));

        store.dispatch(clearVersionHistory());

        const state = store.getState().collaboration;
        expect(state.versions).toEqual([]);
        expect(state.currentVersion).toBeNull();
        expect(state.versionError).toBeUndefined();
      });

      it('clearVersionError clears error', () => {
        // Set error first
        mockVersionHistoryService.getVersionHistory.mockRejectedValue(new Error('Test error'));
        store.dispatch(loadVersionHistory('note1'));

        store.dispatch(clearVersionError());

        const state = store.getState().collaboration;
        expect(state.versionError).toBeUndefined();
      });
    });

    describe('collaboration actions', () => {
      it('userJoined adds new user', () => {
        store.dispatch(userJoined(mockUsers[0]));

        const state = store.getState().collaboration;
        expect(state.connectedUsers).toContain(mockUsers[0]);
      });

      it('userJoined updates existing user', () => {
        store.dispatch(userJoined(mockUsers[0]));
        
        const updatedUser = { ...mockUsers[0], name: 'Updated Name' };
        store.dispatch(userJoined(updatedUser));

        const state = store.getState().collaboration;
        expect(state.connectedUsers).toHaveLength(1);
        expect(state.connectedUsers[0].name).toBe('Updated Name');
      });

      it('userLeft removes user and presence', () => {
        store.dispatch(userJoined(mockUsers[0]));
        store.dispatch(updateUserPresence({
          userId: 'user1',
          userName: 'John Doe',
          noteId: 'note1',
          lastActivity: '2024-01-15T10:00:00Z',
        }));

        store.dispatch(userLeft({ userId: 'user1' }));

        const state = store.getState().collaboration;
        expect(state.connectedUsers).toEqual([]);
        expect(state.userPresences).toEqual([]);
      });

      it('updateUserPresence adds new presence', () => {
        const presence: UserPresence = {
          userId: 'user1',
          userName: 'John Doe',
          noteId: 'note1',
          cursor: { position: 100 },
          lastActivity: '2024-01-15T10:00:00Z',
        };

        store.dispatch(updateUserPresence(presence));

        const state = store.getState().collaboration;
        expect(state.userPresences).toContain(presence);
      });

      it('updateUserPresence updates existing presence', () => {
        const presence: UserPresence = {
          userId: 'user1',
          userName: 'John Doe',
          noteId: 'note1',
          cursor: { position: 100 },
          lastActivity: '2024-01-15T10:00:00Z',
        };

        store.dispatch(updateUserPresence(presence));

        const updatedPresence = { ...presence, cursor: { position: 200 } };
        store.dispatch(updateUserPresence(updatedPresence));

        const state = store.getState().collaboration;
        expect(state.userPresences).toHaveLength(1);
        expect(state.userPresences[0].cursor?.position).toBe(200);
      });

      it('clearUserPresences clears all presences', () => {
        store.dispatch(updateUserPresence({
          userId: 'user1',
          userName: 'John Doe',
          noteId: 'note1',
          lastActivity: '2024-01-15T10:00:00Z',
        }));

        store.dispatch(clearUserPresences());

        const state = store.getState().collaboration;
        expect(state.userPresences).toEqual([]);
      });
    });

    describe('conflict resolution actions', () => {
      it('addConflict adds conflict and sets as active if none exists', () => {
        store.dispatch(addConflict(mockConflict));

        const state = store.getState().collaboration;
        expect(state.conflicts).toContain(mockConflict);
        expect(state.activeConflict).toEqual(mockConflict);
      });

      it('addConflict adds conflict but keeps existing active conflict', () => {
        const firstConflict = mockConflict;
        const secondConflict = { ...mockConflict, conflictId: 'conflict2' };

        store.dispatch(addConflict(firstConflict));
        store.dispatch(addConflict(secondConflict));

        const state = store.getState().collaboration;
        expect(state.conflicts).toHaveLength(2);
        expect(state.activeConflict).toEqual(firstConflict);
      });

      it('setActiveConflict sets active conflict', () => {
        store.dispatch(addConflict(mockConflict));
        store.dispatch(setActiveConflict(null));

        const state = store.getState().collaboration;
        expect(state.activeConflict).toBeNull();
      });

      it('removeConflict removes conflict and updates active conflict', () => {
        const firstConflict = mockConflict;
        const secondConflict = { ...mockConflict, conflictId: 'conflict2' };

        store.dispatch(addConflict(firstConflict));
        store.dispatch(addConflict(secondConflict));
        store.dispatch(removeConflict('conflict1'));

        const state = store.getState().collaboration;
        expect(state.conflicts).toHaveLength(1);
        expect(state.conflicts[0].conflictId).toBe('conflict2');
        expect(state.activeConflict?.conflictId).toBe('conflict2');
      });

      it('removeConflict clears active conflict when removing last conflict', () => {
        store.dispatch(addConflict(mockConflict));
        store.dispatch(removeConflict('conflict1'));

        const state = store.getState().collaboration;
        expect(state.conflicts).toEqual([]);
        expect(state.activeConflict).toBeNull();
      });

      it('clearConflicts clears all conflicts', () => {
        store.dispatch(addConflict(mockConflict));
        store.dispatch(addConflict({ ...mockConflict, conflictId: 'conflict2' }));

        store.dispatch(clearConflicts());

        const state = store.getState().collaboration;
        expect(state.conflicts).toEqual([]);
        expect(state.activeConflict).toBeNull();
      });
    });
  });
});
import { versionHistoryService } from '../versionHistoryService';
import { NoteVersion } from '../../types/collaboration';

// Mock the electron API
const mockElectronAPI = {
  getVersionHistory: jest.fn(),
  getVersion: jest.fn(),
  restoreVersion: jest.fn(),
  createVersion: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

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

describe('VersionHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVersionHistory', () => {
    it('returns version history for a note', async () => {
      mockElectronAPI.getVersionHistory.mockResolvedValue({ versions: mockVersions });

      const result = await versionHistoryService.getVersionHistory('note1');

      expect(mockElectronAPI.getVersionHistory).toHaveBeenCalledWith('note1');
      expect(result).toEqual(mockVersions);
    });

    it('returns empty array when no versions exist', async () => {
      mockElectronAPI.getVersionHistory.mockResolvedValue({ versions: [] });

      const result = await versionHistoryService.getVersionHistory('note1');

      expect(result).toEqual([]);
    });

    it('throws error when API call fails', async () => {
      mockElectronAPI.getVersionHistory.mockRejectedValue(new Error('API Error'));

      await expect(versionHistoryService.getVersionHistory('note1'))
        .rejects.toThrow('Failed to load version history');
    });
  });

  describe('getVersion', () => {
    it('returns specific version', async () => {
      mockElectronAPI.getVersion.mockResolvedValue({ version: mockVersions[0] });

      const result = await versionHistoryService.getVersion('note1', 2);

      expect(mockElectronAPI.getVersion).toHaveBeenCalledWith('note1', 2);
      expect(result).toEqual(mockVersions[0]);
    });

    it('returns null when version not found', async () => {
      mockElectronAPI.getVersion.mockResolvedValue({ version: null });

      const result = await versionHistoryService.getVersion('note1', 999);

      expect(result).toBeNull();
    });

    it('returns null when API call fails', async () => {
      mockElectronAPI.getVersion.mockRejectedValue(new Error('API Error'));

      const result = await versionHistoryService.getVersion('note1', 2);

      expect(result).toBeNull();
    });
  });

  describe('restoreVersion', () => {
    it('restores version successfully', async () => {
      mockElectronAPI.restoreVersion.mockResolvedValue({ success: true });

      const result = await versionHistoryService.restoreVersion('note1', 2);

      expect(mockElectronAPI.restoreVersion).toHaveBeenCalledWith('note1', 2);
      expect(result).toBe(true);
    });

    it('returns false when restoration fails', async () => {
      mockElectronAPI.restoreVersion.mockResolvedValue({ success: false });

      const result = await versionHistoryService.restoreVersion('note1', 2);

      expect(result).toBe(false);
    });

    it('returns false when API call fails', async () => {
      mockElectronAPI.restoreVersion.mockRejectedValue(new Error('API Error'));

      const result = await versionHistoryService.restoreVersion('note1', 2);

      expect(result).toBe(false);
    });
  });

  describe('createVersion', () => {
    it('creates new version successfully', async () => {
      const newVersion = mockVersions[0];
      mockElectronAPI.createVersion.mockResolvedValue({ version: newVersion });

      const result = await versionHistoryService.createVersion(
        'note1', 
        'New content', 
        'Added new section'
      );

      expect(mockElectronAPI.createVersion).toHaveBeenCalledWith({
        noteId: 'note1',
        content: 'New content',
        changeDescription: 'Added new section',
      });
      expect(result).toEqual(newVersion);
    });

    it('creates version without change description', async () => {
      const newVersion = mockVersions[0];
      mockElectronAPI.createVersion.mockResolvedValue({ version: newVersion });

      const result = await versionHistoryService.createVersion('note1', 'New content');

      expect(mockElectronAPI.createVersion).toHaveBeenCalledWith({
        noteId: 'note1',
        content: 'New content',
        changeDescription: undefined,
      });
      expect(result).toEqual(newVersion);
    });

    it('throws error when creation fails', async () => {
      mockElectronAPI.createVersion.mockRejectedValue(new Error('API Error'));

      await expect(versionHistoryService.createVersion('note1', 'New content'))
        .rejects.toThrow('Failed to create version');
    });
  });

  describe('generateDiff', () => {
    it('generates diff for added lines', () => {
      const oldContent = 'Line 1\nLine 2';
      const newContent = 'Line 1\nLine 2\nLine 3';

      const diffs = versionHistoryService.generateDiff(oldContent, newContent);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        type: 'added',
        content: 'Line 3',
        lineNumber: 3,
      });
    });

    it('generates diff for removed lines', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nLine 2';

      const diffs = versionHistoryService.generateDiff(oldContent, newContent);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        type: 'removed',
        content: 'Line 3',
        lineNumber: 3,
      });
    });

    it('generates diff for modified lines', () => {
      const oldContent = 'Line 1\nOld Line 2\nLine 3';
      const newContent = 'Line 1\nNew Line 2\nLine 3';

      const diffs = versionHistoryService.generateDiff(oldContent, newContent);

      expect(diffs).toHaveLength(2);
      expect(diffs[0]).toEqual({
        type: 'removed',
        content: 'Old Line 2',
        lineNumber: 2,
      });
      expect(diffs[1]).toEqual({
        type: 'added',
        content: 'New Line 2',
        lineNumber: 2,
      });
    });

    it('returns empty diff for identical content', () => {
      const content = 'Line 1\nLine 2\nLine 3';

      const diffs = versionHistoryService.generateDiff(content, content);

      expect(diffs).toHaveLength(0);
    });

    it('handles empty content', () => {
      const diffs = versionHistoryService.generateDiff('', 'New content');

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        type: 'added',
        content: 'New content',
        lineNumber: 1,
      });
    });
  });

  describe('formatChangeDescription', () => {
    it('formats single type changes', () => {
      const diffs = [
        { type: 'added' as const, content: 'Line 1', lineNumber: 1 },
        { type: 'added' as const, content: 'Line 2', lineNumber: 2 },
      ];

      const description = versionHistoryService.formatChangeDescription(diffs);

      expect(description).toBe('+2 lines');
    });

    it('formats multiple type changes', () => {
      const diffs = [
        { type: 'added' as const, content: 'Line 1', lineNumber: 1 },
        { type: 'removed' as const, content: 'Line 2', lineNumber: 2 },
        { type: 'modified' as const, content: 'Line 3', lineNumber: 3 },
      ];

      const description = versionHistoryService.formatChangeDescription(diffs);

      expect(description).toBe('+1 lines, -1 lines, ~1 lines');
    });

    it('returns "No changes" for empty diff', () => {
      const description = versionHistoryService.formatChangeDescription([]);

      expect(description).toBe('No changes');
    });
  });
});
import { NoteVersion, VersionDiff } from '../types/collaboration';

export class VersionHistoryService {
  async getVersionHistory(noteId: string): Promise<NoteVersion[]> {
    try {
      const response = await window.electronAPI.getVersionHistory(noteId);
      return response.versions || [];
    } catch (error) {
      console.error('Failed to load version history:', error);
      throw new Error('Failed to load version history');
    }
  }

  async getVersion(noteId: string, version: number): Promise<NoteVersion | null> {
    try {
      const response = await window.electronAPI.getVersion(noteId, version);
      return response.version || null;
    } catch (error) {
      console.error('Failed to load version:', error);
      return null;
    }
  }

  async restoreVersion(noteId: string, version: number): Promise<boolean> {
    try {
      const response = await window.electronAPI.restoreVersion(noteId, version);
      return response.success;
    } catch (error) {
      console.error('Failed to restore version:', error);
      return false;
    }
  }

  async createVersion(noteId: string, content: string, changeDescription?: string): Promise<NoteVersion> {
    try {
      const response = await window.electronAPI.createVersion({
        noteId,
        content,
        changeDescription
      });
      return response.version;
    } catch (error) {
      console.error('Failed to create version:', error);
      throw new Error('Failed to create version');
    }
  }

  generateDiff(oldContent: string, newContent: string): VersionDiff[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diffs: VersionDiff[] = [];

    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];

      if (oldIndex >= oldLines.length) {
        // Added line
        diffs.push({
          type: 'added',
          content: newLine,
          lineNumber: newIndex + 1
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Removed line
        diffs.push({
          type: 'removed',
          content: oldLine,
          lineNumber: oldIndex + 1
        });
        oldIndex++;
      } else if (oldLine === newLine) {
        // No change
        oldIndex++;
        newIndex++;
      } else {
        // Modified line
        diffs.push({
          type: 'removed',
          content: oldLine,
          lineNumber: oldIndex + 1
        });
        diffs.push({
          type: 'added',
          content: newLine,
          lineNumber: newIndex + 1
        });
        oldIndex++;
        newIndex++;
      }
    }

    return diffs;
  }

  formatChangeDescription(diffs: VersionDiff[]): string {
    const added = diffs.filter(d => d.type === 'added').length;
    const removed = diffs.filter(d => d.type === 'removed').length;
    const modified = diffs.filter(d => d.type === 'modified').length;

    const parts = [];
    if (added > 0) parts.push(`+${added} lines`);
    if (removed > 0) parts.push(`-${removed} lines`);
    if (modified > 0) parts.push(`~${modified} lines`);

    return parts.join(', ') || 'No changes';
  }
}

export const versionHistoryService = new VersionHistoryService();
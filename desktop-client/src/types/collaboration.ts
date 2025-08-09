export interface NoteVersion {
  id: string;
  noteId: string;
  version: number;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  changeDescription?: string;
}

export interface VersionDiff {
  type: 'added' | 'removed' | 'modified';
  content: string;
  lineNumber?: number;
}

export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface UserPresence {
  userId: string;
  userName: string;
  noteId: string;
  cursor?: {
    position: number;
    selection?: {
      from: number;
      to: number;
    };
  };
  lastActivity: string;
}

export interface ConflictResolution {
  conflictId: string;
  noteId: string;
  localVersion: NoteVersion;
  remoteVersion: NoteVersion;
  resolvedContent?: string;
  resolution?: 'local' | 'remote' | 'merged';
  resolvedAt?: string;
}

export interface CollaborationState {
  versions: NoteVersion[];
  currentVersion: NoteVersion | null;
  isLoadingVersions: boolean;
  versionError?: string;
  
  // Real-time collaboration
  connectedUsers: CollaborationUser[];
  userPresences: UserPresence[];
  isCollaborating: boolean;
  
  // Conflict resolution
  conflicts: ConflictResolution[];
  activeConflict: ConflictResolution | null;
}
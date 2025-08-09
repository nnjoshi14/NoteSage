import { ServerConnectionManager } from './server-connection';
import { OfflineCache, CachedNote, CachedPerson, CachedTodo } from './offline-cache';
import { AxiosInstance } from 'axios';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

export interface ConflictResolution {
  strategy: 'keep_local' | 'keep_remote' | 'merge';
  mergedData?: any;
}

export interface SyncConflict {
  id: string;
  type: 'note' | 'person' | 'todo';
  localData: any;
  remoteData: any;
  conflictReason: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync?: Date;
  nextSync?: Date;
  progress?: {
    current: number;
    total: number;
    operation: string;
  };
  conflicts: SyncConflict[];
}

export class SyncManager {
  private serverConnection: ServerConnectionManager;
  private offlineCache: OfflineCache;
  private syncStatus: SyncStatus = {
    isRunning: false,
    conflicts: [],
  };
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private autoSyncEnabled = true;
  private autoSyncIntervalMs = 5 * 60 * 1000; // 5 minutes
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor(serverConnection: ServerConnectionManager, offlineCache: OfflineCache) {
    this.serverConnection = serverConnection;
    this.offlineCache = offlineCache;
    this.startAutoSync();
  }

  // Main sync operations
  async syncAll(): Promise<SyncResult> {
    if (this.syncStatus.isRunning) {
      throw new Error('Sync already in progress');
    }

    if (!this.serverConnection.isConnected()) {
      throw new Error('Server connection required for sync');
    }

    this.syncStatus.isRunning = true;
    this.syncStatus.lastSync = new Date();
    this.syncStatus.conflicts = [];

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Process offline queue first
      const queueResult = await this.processOfflineQueue();
      result.synced += queueResult.synced;
      result.failed += queueResult.failed;
      result.conflicts += queueResult.conflicts;
      result.errors.push(...queueResult.errors);

      // Sync each data type
      const notesResult = await this.syncNotes();
      result.synced += notesResult.synced;
      result.failed += notesResult.failed;
      result.conflicts += notesResult.conflicts;
      result.errors.push(...notesResult.errors);

      const peopleResult = await this.syncPeople();
      result.synced += peopleResult.synced;
      result.failed += peopleResult.failed;
      result.conflicts += peopleResult.conflicts;
      result.errors.push(...peopleResult.errors);

      const todosResult = await this.syncTodos();
      result.synced += todosResult.synced;
      result.failed += todosResult.failed;
      result.conflicts += todosResult.conflicts;
      result.errors.push(...todosResult.errors);

      // Update sync metadata
      const now = new Date().toISOString();
      await this.offlineCache.updateSyncMetadata('notes', now);
      await this.offlineCache.updateSyncMetadata('people', now);
      await this.offlineCache.updateSyncMetadata('todos', now);

      result.success = result.failed === 0 && result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    } finally {
      this.syncStatus.isRunning = false;
      this.scheduleNextAutoSync();
    }

    return result;
  }

  async syncNotes(): Promise<SyncResult> {
    const client = this.serverConnection.getClient();
    if (!client) throw new Error('No server connection available');

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Get last sync metadata
      const syncMeta = await this.offlineCache.getSyncMetadata('notes');
      const lastSync = syncMeta?.last_sync;

      // Fetch remote changes since last sync
      const remoteNotes = await this.fetchRemoteNotes(client, lastSync);
      
      // Get local notes that need syncing
      const localNotes = await this.offlineCache.getNotes();
      const pendingNotes = localNotes.filter(note => note.sync_status === 'pending');

      this.updateSyncProgress(0, remoteNotes.length + pendingNotes.length, 'Syncing notes');

      // Process remote changes
      for (let i = 0; i < remoteNotes.length; i++) {
        try {
          const conflictsBefore = this.syncStatus.conflicts.length;
          await this.processRemoteNote(remoteNotes[i]);
          const conflictsAfter = this.syncStatus.conflicts.length;
          
          if (conflictsAfter > conflictsBefore) {
            result.conflicts++;
          } else {
            result.synced++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process remote note ${remoteNotes[i].id}: ${error}`);
        }
        this.updateSyncProgress(i + 1, remoteNotes.length + pendingNotes.length, 'Syncing notes');
      }

      // Push local changes
      for (let i = 0; i < pendingNotes.length; i++) {
        try {
          await this.pushNoteToServer(client, pendingNotes[i]);
          result.synced++;
        } catch (error) {
          if (this.isConflictError(error)) {
            await this.handleNoteConflict(pendingNotes[i], error);
            result.conflicts++;
          } else {
            result.failed++;
            result.errors.push(`Failed to push note ${pendingNotes[i].id}: ${error}`);
          }
        }
        this.updateSyncProgress(remoteNotes.length + i + 1, remoteNotes.length + pendingNotes.length, 'Syncing notes');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Notes sync failed: ${error}`);
    }

    return result;
  }

  async syncPeople(): Promise<SyncResult> {
    const client = this.serverConnection.getClient();
    if (!client) throw new Error('No server connection available');

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Get last sync metadata
      const syncMeta = await this.offlineCache.getSyncMetadata('people');
      const lastSync = syncMeta?.last_sync;

      // Fetch remote changes since last sync
      const remotePeople = await this.fetchRemotePeople(client, lastSync);
      
      // Get local people that need syncing
      const localPeople = await this.offlineCache.getPeople();
      const pendingPeople = localPeople.filter(person => person.sync_status === 'pending');

      this.updateSyncProgress(0, remotePeople.length + pendingPeople.length, 'Syncing people');

      // Process remote changes
      for (let i = 0; i < remotePeople.length; i++) {
        try {
          await this.processRemotePerson(remotePeople[i]);
          result.synced++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process remote person ${remotePeople[i].id}: ${error}`);
        }
        this.updateSyncProgress(i + 1, remotePeople.length + pendingPeople.length, 'Syncing people');
      }

      // Push local changes
      for (let i = 0; i < pendingPeople.length; i++) {
        try {
          await this.pushPersonToServer(client, pendingPeople[i]);
          result.synced++;
        } catch (error) {
          if (this.isConflictError(error)) {
            await this.handlePersonConflict(pendingPeople[i], error);
            result.conflicts++;
          } else {
            result.failed++;
            result.errors.push(`Failed to push person ${pendingPeople[i].id}: ${error}`);
          }
        }
        this.updateSyncProgress(remotePeople.length + i + 1, remotePeople.length + pendingPeople.length, 'Syncing people');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`People sync failed: ${error}`);
    }

    return result;
  }

  async syncTodos(): Promise<SyncResult> {
    const client = this.serverConnection.getClient();
    if (!client) throw new Error('No server connection available');

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Get last sync metadata
      const syncMeta = await this.offlineCache.getSyncMetadata('todos');
      const lastSync = syncMeta?.last_sync;

      // Fetch remote changes since last sync
      const remoteTodos = await this.fetchRemoteTodos(client, lastSync);
      
      // Get local todos that need syncing
      const localTodos = await this.offlineCache.getTodos();
      const pendingTodos = localTodos.filter(todo => todo.sync_status === 'pending');

      this.updateSyncProgress(0, remoteTodos.length + pendingTodos.length, 'Syncing todos');

      // Process remote changes
      for (let i = 0; i < remoteTodos.length; i++) {
        try {
          await this.processRemoteTodo(remoteTodos[i]);
          result.synced++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process remote todo ${remoteTodos[i].id}: ${error}`);
        }
        this.updateSyncProgress(i + 1, remoteTodos.length + pendingTodos.length, 'Syncing todos');
      }

      // Push local changes
      for (let i = 0; i < pendingTodos.length; i++) {
        try {
          await this.pushTodoToServer(client, pendingTodos[i]);
          result.synced++;
        } catch (error) {
          if (this.isConflictError(error)) {
            await this.handleTodoConflict(pendingTodos[i], error);
            result.conflicts++;
          } else {
            result.failed++;
            result.errors.push(`Failed to push todo ${pendingTodos[i].id}: ${error}`);
          }
        }
        this.updateSyncProgress(remoteTodos.length + i + 1, remoteTodos.length + pendingTodos.length, 'Syncing todos');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Todos sync failed: ${error}`);
    }

    return result;
  }

  // Offline queue processing
  async processOfflineQueue(): Promise<SyncResult> {
    const client = this.serverConnection.getClient();
    if (!client) throw new Error('No server connection available');

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    const queue = await this.offlineCache.getOfflineQueue();
    
    for (const item of queue) {
      try {
        await this.processQueueItem(client, item);
        await this.offlineCache.removeFromOfflineQueue(item.id);
        result.synced++;
      } catch (error) {
        if (item.retry_count < this.maxRetries) {
          await this.offlineCache.updateOfflineQueueError(item.id, error instanceof Error ? error.message : 'Unknown error');
        } else {
          await this.offlineCache.removeFromOfflineQueue(item.id);
          result.failed++;
          result.errors.push(`Queue item ${item.id} failed after ${this.maxRetries} retries: ${error}`);
        }
      }
    }

    return result;
  }

  private async processQueueItem(client: AxiosInstance, item: any): Promise<void> {
    switch (item.operation) {
      case 'create':
        await this.createRemoteRecord(client, item.table_name, item.data);
        break;
      case 'update':
        await this.updateRemoteRecord(client, item.table_name, item.record_id, item.data);
        break;
      case 'delete':
        await this.deleteRemoteRecord(client, item.table_name, item.record_id);
        break;
      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }
  }

  // Remote API operations
  private async fetchRemoteNotes(client: AxiosInstance, since?: string): Promise<any[]> {
    const params = since ? { since } : {};
    const response = await client.get('/api/notes', { params });
    return response.data?.notes || [];
  }

  private async fetchRemotePeople(client: AxiosInstance, since?: string): Promise<any[]> {
    const params = since ? { since } : {};
    const response = await client.get('/api/people', { params });
    return response.data?.people || [];
  }

  private async fetchRemoteTodos(client: AxiosInstance, since?: string): Promise<any[]> {
    const params = since ? { since } : {};
    const response = await client.get('/api/todos', { params });
    return response.data?.todos || [];
  }

  private async pushNoteToServer(client: AxiosInstance, note: CachedNote): Promise<void> {
    const noteData = {
      title: note.title,
      content: typeof note.content === 'string' ? JSON.parse(note.content) : note.content,
      category: note.category,
      tags: note.tags,
      folder_path: note.folder_path,
      scheduled_date: note.scheduled_date,
      is_archived: note.is_archived,
      is_pinned: note.is_pinned,
      is_favorite: note.is_favorite,
    };

    if (note.server_id) {
      // Update existing note
      await client.put(`/api/notes/${note.server_id}`, noteData);
    } else {
      // Create new note
      const response = await client.post('/api/notes', noteData);
      const serverNote = response.data;
      
      // Update local cache with server ID if available
      if (serverNote && serverNote.id) {
        await this.offlineCache.saveNote({
          ...note,
          server_id: serverNote.id,
          sync_status: 'synced',
        });
      }
    }
  }

  private async pushPersonToServer(client: AxiosInstance, person: CachedPerson): Promise<void> {
    const personData = {
      name: person.name,
      email: person.email,
      phone: person.phone,
      company: person.company,
      title: person.title,
      linkedin_url: person.linkedin_url,
      avatar_url: person.avatar_url,
      notes: person.notes,
    };

    if (person.server_id) {
      // Update existing person
      await client.put(`/api/people/${person.server_id}`, personData);
    } else {
      // Create new person
      const response = await client.post('/api/people', personData);
      const serverPerson = response.data;
      
      // Update local cache with server ID
      await this.offlineCache.savePerson({
        ...person,
        server_id: serverPerson.id,
        sync_status: 'synced',
      });
    }
  }

  private async pushTodoToServer(client: AxiosInstance, todo: CachedTodo): Promise<void> {
    const todoData = {
      note_id: todo.note_id,
      todo_id: todo.todo_id,
      text: todo.text,
      is_completed: todo.is_completed,
      assigned_person_id: todo.assigned_person_id,
      due_date: todo.due_date,
    };

    if (todo.server_id) {
      // Update existing todo
      await client.put(`/api/todos/${todo.server_id}`, todoData);
    } else {
      // Create new todo
      const response = await client.post('/api/todos', todoData);
      const serverTodo = response.data;
      
      // Update local cache with server ID
      await this.offlineCache.saveTodo({
        ...todo,
        server_id: serverTodo.id,
        sync_status: 'synced',
      });
    }
  }

  private async createRemoteRecord(client: AxiosInstance, tableName: string, data: any): Promise<void> {
    const endpoint = this.getApiEndpoint(tableName);
    await client.post(endpoint, data);
  }

  private async updateRemoteRecord(client: AxiosInstance, tableName: string, recordId: string, data: any): Promise<void> {
    const endpoint = this.getApiEndpoint(tableName);
    await client.put(`${endpoint}/${recordId}`, data);
  }

  private async deleteRemoteRecord(client: AxiosInstance, tableName: string, recordId: string): Promise<void> {
    const endpoint = this.getApiEndpoint(tableName);
    await client.delete(`${endpoint}/${recordId}`);
  }

  // Remote data processing
  private async processRemoteNote(remoteNote: any): Promise<void> {
    const localNote = await this.offlineCache.getNote(remoteNote.id);
    
    if (!localNote) {
      // New remote note - save to cache
      await this.offlineCache.saveNote({
        ...remoteNote,
        server_id: remoteNote.id,
        sync_status: 'synced',
        last_modified_locally: remoteNote.updated_at,
      });
    } else if (localNote.sync_status === 'synced' && localNote.updated_at < remoteNote.updated_at) {
      // Remote note is newer - update local
      await this.offlineCache.saveNote({
        ...localNote,
        ...remoteNote,
        server_id: remoteNote.id,
        sync_status: 'synced',
        last_modified_locally: remoteNote.updated_at,
      });
    } else if (localNote.sync_status === 'pending' && localNote.last_modified_locally < remoteNote.updated_at) {
      // Conflict - remote is newer but local has changes
      await this.handleNoteConflict(localNote, { remoteData: remoteNote });
    }
  }

  private async processRemotePerson(remotePerson: any): Promise<void> {
    const localPerson = await this.offlineCache.getPerson(remotePerson.id);
    
    if (!localPerson) {
      // New remote person - save to cache
      await this.offlineCache.savePerson({
        ...remotePerson,
        server_id: remotePerson.id,
        sync_status: 'synced',
        last_modified_locally: remotePerson.updated_at,
      });
    } else if (localPerson.sync_status === 'synced' && localPerson.updated_at < remotePerson.updated_at) {
      // Remote person is newer - update local
      await this.offlineCache.savePerson({
        ...localPerson,
        ...remotePerson,
        server_id: remotePerson.id,
        sync_status: 'synced',
        last_modified_locally: remotePerson.updated_at,
      });
    } else if (localPerson.sync_status === 'pending' && localPerson.last_modified_locally < remotePerson.updated_at) {
      // Conflict - remote is newer but local has changes
      await this.handlePersonConflict(localPerson, { remoteData: remotePerson });
    }
  }

  private async processRemoteTodo(remoteTodo: any): Promise<void> {
    const localTodo = await this.offlineCache.getTodo(remoteTodo.id);
    
    if (!localTodo) {
      // New remote todo - save to cache
      await this.offlineCache.saveTodo({
        ...remoteTodo,
        server_id: remoteTodo.id,
        sync_status: 'synced',
        last_modified_locally: remoteTodo.updated_at,
      });
    } else if (localTodo.sync_status === 'synced' && localTodo.updated_at < remoteTodo.updated_at) {
      // Remote todo is newer - update local
      await this.offlineCache.saveTodo({
        ...localTodo,
        ...remoteTodo,
        server_id: remoteTodo.id,
        sync_status: 'synced',
        last_modified_locally: remoteTodo.updated_at,
      });
    } else if (localTodo.sync_status === 'pending' && localTodo.last_modified_locally < remoteTodo.updated_at) {
      // Conflict - remote is newer but local has changes
      await this.handleTodoConflict(localTodo, { remoteData: remoteTodo });
    }
  }

  // Conflict handling
  private async handleNoteConflict(localNote: CachedNote, error: any): Promise<void> {
    const remoteData = error.remoteData || error.response?.data || {};
    
    const conflict: SyncConflict = {
      id: localNote.id,
      type: 'note',
      localData: localNote,
      remoteData,
      conflictReason: 'Both local and remote versions have been modified',
    };

    this.syncStatus.conflicts.push(conflict);
    
    // Mark as conflict in cache
    await this.offlineCache.saveNote({
      ...localNote,
      sync_status: 'conflict',
    });
  }

  private async handlePersonConflict(localPerson: CachedPerson, error: any): Promise<void> {
    const conflict: SyncConflict = {
      id: localPerson.id,
      type: 'person',
      localData: localPerson,
      remoteData: error.remoteData,
      conflictReason: 'Both local and remote versions have been modified',
    };

    this.syncStatus.conflicts.push(conflict);
    
    // Mark as conflict in cache
    await this.offlineCache.savePerson({
      ...localPerson,
      sync_status: 'conflict',
    });
  }

  private async handleTodoConflict(localTodo: CachedTodo, error: any): Promise<void> {
    const conflict: SyncConflict = {
      id: localTodo.id,
      type: 'todo',
      localData: localTodo,
      remoteData: error.remoteData,
      conflictReason: 'Both local and remote versions have been modified',
    };

    this.syncStatus.conflicts.push(conflict);
    
    // Mark as conflict in cache
    await this.offlineCache.saveTodo({
      ...localTodo,
      sync_status: 'conflict',
    });
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    const conflict = this.syncStatus.conflicts.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    const client = this.serverConnection.getClient();
    if (!client) throw new Error('No server connection available');

    try {
      switch (resolution.strategy) {
        case 'keep_local':
          // Push local version to server
          await this.forceUpdateRemote(client, conflict);
          break;
        case 'keep_remote':
          // Update local with remote version
          await this.forceUpdateLocal(conflict);
          break;
        case 'merge':
          // Use merged data
          if (!resolution.mergedData) {
            throw new Error('Merged data required for merge strategy');
          }
          await this.applyMergedData(client, conflict, resolution.mergedData);
          break;
      }

      // Remove conflict from list
      this.syncStatus.conflicts = this.syncStatus.conflicts.filter(c => c.id !== conflictId);

    } catch (error) {
      throw new Error(`Failed to resolve conflict: ${error}`);
    }
  }

  private async forceUpdateRemote(client: AxiosInstance, conflict: SyncConflict): Promise<void> {
    switch (conflict.type) {
      case 'note':
        await this.pushNoteToServer(client, conflict.localData);
        break;
      case 'person':
        await this.pushPersonToServer(client, conflict.localData);
        break;
      case 'todo':
        await this.pushTodoToServer(client, conflict.localData);
        break;
    }
  }

  private async forceUpdateLocal(conflict: SyncConflict): Promise<void> {
    switch (conflict.type) {
      case 'note':
        await this.offlineCache.saveNote({
          ...conflict.remoteData,
          sync_status: 'synced',
        });
        break;
      case 'person':
        await this.offlineCache.savePerson({
          ...conflict.remoteData,
          sync_status: 'synced',
        });
        break;
      case 'todo':
        await this.offlineCache.saveTodo({
          ...conflict.remoteData,
          sync_status: 'synced',
        });
        break;
    }
  }

  private async applyMergedData(client: AxiosInstance, conflict: SyncConflict, mergedData: any): Promise<void> {
    // Update both local and remote with merged data
    switch (conflict.type) {
      case 'note':
        // Merge with local data to ensure all required fields are present
        const noteToSave = {
          ...conflict.localData,
          ...mergedData,
          sync_status: 'synced',
        };
        await this.offlineCache.saveNote(noteToSave);
        await this.pushNoteToServer(client, noteToSave);
        break;
      case 'person':
        const personToSave = {
          ...conflict.localData,
          ...mergedData,
          sync_status: 'synced',
        };
        await this.offlineCache.savePerson(personToSave);
        await this.pushPersonToServer(client, personToSave);
        break;
      case 'todo':
        const todoToSave = {
          ...conflict.localData,
          ...mergedData,
          sync_status: 'synced',
        };
        await this.offlineCache.saveTodo(todoToSave);
        await this.pushTodoToServer(client, todoToSave);
        break;
    }
  }

  // Auto-sync management
  private startAutoSync(): void {
    if (this.autoSyncEnabled && !this.autoSyncInterval) {
      this.autoSyncInterval = setInterval(() => {
        if (this.serverConnection.isConnected() && !this.syncStatus.isRunning) {
          this.syncAll().catch(error => {
            console.error('Auto-sync failed:', error);
          });
        }
      }, this.autoSyncIntervalMs);
    }
  }

  private scheduleNextAutoSync(): void {
    if (this.autoSyncEnabled) {
      this.syncStatus.nextSync = new Date(Date.now() + this.autoSyncIntervalMs);
    }
  }

  setAutoSyncEnabled(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
    
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  setAutoSyncInterval(intervalMs: number): void {
    this.autoSyncIntervalMs = intervalMs;
    
    if (this.autoSyncInterval) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  private stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    this.syncStatus.nextSync = undefined;
  }

  // Status and utility methods
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  getConflicts(): SyncConflict[] {
    return [...this.syncStatus.conflicts];
  }

  private updateSyncProgress(current: number, total: number, operation: string): void {
    this.syncStatus.progress = {
      current,
      total,
      operation,
    };
  }

  private isConflictError(error: any): boolean {
    return error?.response?.status === 409 || error?.code === 'CONFLICT';
  }

  private getApiEndpoint(tableName: string): string {
    switch (tableName) {
      case 'notes':
      case 'cached_notes':
        return '/api/notes';
      case 'people':
      case 'cached_people':
        return '/api/people';
      case 'todos':
      case 'cached_todos':
        return '/api/todos';
      default:
        throw new Error(`Unknown table name: ${tableName}`);
    }
  }

  // Methods expected by tests
  async createNote(note: any): Promise<any> {
    if (this.serverConnection.isConnected()) {
      try {
        const client = this.serverConnection.getClient();
        if (client) {
          const serverNote = await client.post('/api/notes', note);
          const savedNote = await this.offlineCache.saveNote({
            ...serverNote.data,
            sync_status: 'synced',
          });
          return savedNote;
        }
      } catch (error) {
        // Fallback to offline
      }
    }

    // Create offline
    const localNote = await this.offlineCache.createNote(note);
    await this.offlineCache.queueOperation({
      type: 'create',
      table: 'notes',
      data: localNote,
    });
    return localNote;
  }

  async updateNote(id: string, updates: any): Promise<any> {
    if (this.serverConnection.isConnected()) {
      try {
        const client = this.serverConnection.getClient();
        if (client) {
          const serverNote = await client.put(`/api/notes/${id}`, updates);
          const savedNote = await this.offlineCache.updateNote(id, {
            ...serverNote.data,
            sync_status: 'synced',
          });
          return savedNote;
        }
      } catch (error) {
        // Fallback to offline
      }
    }

    // Update offline
    const localNote = await this.offlineCache.updateNote(id, updates);
    await this.offlineCache.queueOperation({
      type: 'update',
      table: 'notes',
      id,
      data: updates,
    });
    return localNote;
  }

  async deleteNote(id: string): Promise<void> {
    if (this.serverConnection.isConnected()) {
      try {
        const client = this.serverConnection.getClient();
        if (client) {
          await client.delete(`/api/notes/${id}`);
          await this.offlineCache.deleteNote(id);
          return;
        }
      } catch (error) {
        // Fallback to offline
      }
    }

    // Delete offline
    await this.offlineCache.deleteNote(id);
    await this.offlineCache.queueOperation({
      type: 'delete',
      table: 'notes',
      id,
    });
  }

  async syncPendingOperations(): Promise<SyncResult> {
    return this.processOfflineQueue();
  }

  async close(): Promise<void> {
    this.stopAutoSync();
  }
}
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncManager = void 0;
class SyncManager {
    constructor(serverConnection, offlineCache) {
        this.syncStatus = {
            isRunning: false,
            conflicts: [],
        };
        this.autoSyncInterval = null;
        this.autoSyncEnabled = true;
        this.autoSyncIntervalMs = 5 * 60 * 1000; // 5 minutes
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.serverConnection = serverConnection;
        this.offlineCache = offlineCache;
        this.startAutoSync();
    }
    // Main sync operations
    async syncAll() {
        if (this.syncStatus.isRunning) {
            throw new Error('Sync already in progress');
        }
        if (!this.serverConnection.isConnected()) {
            throw new Error('Server connection required for sync');
        }
        this.syncStatus.isRunning = true;
        this.syncStatus.lastSync = new Date();
        this.syncStatus.conflicts = [];
        const result = {
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
            result.success = result.failed === 0;
        }
        catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
        }
        finally {
            this.syncStatus.isRunning = false;
            this.scheduleNextAutoSync();
        }
        return result;
    }
    async syncNotes() {
        const client = this.serverConnection.getClient();
        if (!client)
            throw new Error('No server connection available');
        const result = {
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
                    await this.processRemoteNote(remoteNotes[i]);
                    result.synced++;
                }
                catch (error) {
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
                }
                catch (error) {
                    if (this.isConflictError(error)) {
                        await this.handleNoteConflict(pendingNotes[i], error);
                        result.conflicts++;
                    }
                    else {
                        result.failed++;
                        result.errors.push(`Failed to push note ${pendingNotes[i].id}: ${error}`);
                    }
                }
                this.updateSyncProgress(remoteNotes.length + i + 1, remoteNotes.length + pendingNotes.length, 'Syncing notes');
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Notes sync failed: ${error}`);
        }
        return result;
    }
    async syncPeople() {
        const client = this.serverConnection.getClient();
        if (!client)
            throw new Error('No server connection available');
        const result = {
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
                }
                catch (error) {
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
                }
                catch (error) {
                    if (this.isConflictError(error)) {
                        await this.handlePersonConflict(pendingPeople[i], error);
                        result.conflicts++;
                    }
                    else {
                        result.failed++;
                        result.errors.push(`Failed to push person ${pendingPeople[i].id}: ${error}`);
                    }
                }
                this.updateSyncProgress(remotePeople.length + i + 1, remotePeople.length + pendingPeople.length, 'Syncing people');
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push(`People sync failed: ${error}`);
        }
        return result;
    }
    async syncTodos() {
        const client = this.serverConnection.getClient();
        if (!client)
            throw new Error('No server connection available');
        const result = {
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
                }
                catch (error) {
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
                }
                catch (error) {
                    if (this.isConflictError(error)) {
                        await this.handleTodoConflict(pendingTodos[i], error);
                        result.conflicts++;
                    }
                    else {
                        result.failed++;
                        result.errors.push(`Failed to push todo ${pendingTodos[i].id}: ${error}`);
                    }
                }
                this.updateSyncProgress(remoteTodos.length + i + 1, remoteTodos.length + pendingTodos.length, 'Syncing todos');
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Todos sync failed: ${error}`);
        }
        return result;
    }
    // Offline queue processing
    async processOfflineQueue() {
        const client = this.serverConnection.getClient();
        if (!client)
            throw new Error('No server connection available');
        const result = {
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
            }
            catch (error) {
                if (item.retry_count < this.maxRetries) {
                    await this.offlineCache.updateOfflineQueueError(item.id, error instanceof Error ? error.message : 'Unknown error');
                }
                else {
                    await this.offlineCache.removeFromOfflineQueue(item.id);
                    result.failed++;
                    result.errors.push(`Queue item ${item.id} failed after ${this.maxRetries} retries: ${error}`);
                }
            }
        }
        return result;
    }
    async processQueueItem(client, item) {
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
    async fetchRemoteNotes(client, since) {
        const params = since ? { since } : {};
        const response = await client.get('/api/notes', { params });
        return response.data.notes || [];
    }
    async fetchRemotePeople(client, since) {
        const params = since ? { since } : {};
        const response = await client.get('/api/people', { params });
        return response.data.people || [];
    }
    async fetchRemoteTodos(client, since) {
        const params = since ? { since } : {};
        const response = await client.get('/api/todos', { params });
        return response.data.todos || [];
    }
    async pushNoteToServer(client, note) {
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
        }
        else {
            // Create new note
            const response = await client.post('/api/notes', noteData);
            const serverNote = response.data;
            // Update local cache with server ID
            await this.offlineCache.saveNote({
                ...note,
                server_id: serverNote.id,
                sync_status: 'synced',
            });
        }
    }
    async pushPersonToServer(client, person) {
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
        }
        else {
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
    async pushTodoToServer(client, todo) {
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
        }
        else {
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
    async createRemoteRecord(client, tableName, data) {
        const endpoint = this.getApiEndpoint(tableName);
        await client.post(endpoint, data);
    }
    async updateRemoteRecord(client, tableName, recordId, data) {
        const endpoint = this.getApiEndpoint(tableName);
        await client.put(`${endpoint}/${recordId}`, data);
    }
    async deleteRemoteRecord(client, tableName, recordId) {
        const endpoint = this.getApiEndpoint(tableName);
        await client.delete(`${endpoint}/${recordId}`);
    }
    // Remote data processing
    async processRemoteNote(remoteNote) {
        const localNote = await this.offlineCache.getNote(remoteNote.id);
        if (!localNote) {
            // New remote note - save to cache
            await this.offlineCache.saveNote({
                ...remoteNote,
                server_id: remoteNote.id,
                sync_status: 'synced',
                last_modified_locally: remoteNote.updated_at,
            });
        }
        else if (localNote.sync_status === 'synced' && localNote.updated_at < remoteNote.updated_at) {
            // Remote note is newer - update local
            await this.offlineCache.saveNote({
                ...localNote,
                ...remoteNote,
                server_id: remoteNote.id,
                sync_status: 'synced',
                last_modified_locally: remoteNote.updated_at,
            });
        }
        else if (localNote.sync_status === 'pending' && localNote.last_modified_locally < remoteNote.updated_at) {
            // Conflict - remote is newer but local has changes
            await this.handleNoteConflict(localNote, { remoteData: remoteNote });
        }
    }
    async processRemotePerson(remotePerson) {
        const localPerson = await this.offlineCache.getPerson(remotePerson.id);
        if (!localPerson) {
            // New remote person - save to cache
            await this.offlineCache.savePerson({
                ...remotePerson,
                server_id: remotePerson.id,
                sync_status: 'synced',
                last_modified_locally: remotePerson.updated_at,
            });
        }
        else if (localPerson.sync_status === 'synced' && localPerson.updated_at < remotePerson.updated_at) {
            // Remote person is newer - update local
            await this.offlineCache.savePerson({
                ...localPerson,
                ...remotePerson,
                server_id: remotePerson.id,
                sync_status: 'synced',
                last_modified_locally: remotePerson.updated_at,
            });
        }
        else if (localPerson.sync_status === 'pending' && localPerson.last_modified_locally < remotePerson.updated_at) {
            // Conflict - remote is newer but local has changes
            await this.handlePersonConflict(localPerson, { remoteData: remotePerson });
        }
    }
    async processRemoteTodo(remoteTodo) {
        const localTodo = await this.offlineCache.getTodo(remoteTodo.id);
        if (!localTodo) {
            // New remote todo - save to cache
            await this.offlineCache.saveTodo({
                ...remoteTodo,
                server_id: remoteTodo.id,
                sync_status: 'synced',
                last_modified_locally: remoteTodo.updated_at,
            });
        }
        else if (localTodo.sync_status === 'synced' && localTodo.updated_at < remoteTodo.updated_at) {
            // Remote todo is newer - update local
            await this.offlineCache.saveTodo({
                ...localTodo,
                ...remoteTodo,
                server_id: remoteTodo.id,
                sync_status: 'synced',
                last_modified_locally: remoteTodo.updated_at,
            });
        }
        else if (localTodo.sync_status === 'pending' && localTodo.last_modified_locally < remoteTodo.updated_at) {
            // Conflict - remote is newer but local has changes
            await this.handleTodoConflict(localTodo, { remoteData: remoteTodo });
        }
    }
    // Conflict handling
    async handleNoteConflict(localNote, error) {
        const conflict = {
            id: localNote.id,
            type: 'note',
            localData: localNote,
            remoteData: error.remoteData,
            conflictReason: 'Both local and remote versions have been modified',
        };
        this.syncStatus.conflicts.push(conflict);
        // Mark as conflict in cache
        await this.offlineCache.saveNote({
            ...localNote,
            sync_status: 'conflict',
        });
    }
    async handlePersonConflict(localPerson, error) {
        const conflict = {
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
    async handleTodoConflict(localTodo, error) {
        const conflict = {
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
    async resolveConflict(conflictId, resolution) {
        const conflict = this.syncStatus.conflicts.find(c => c.id === conflictId);
        if (!conflict) {
            throw new Error('Conflict not found');
        }
        const client = this.serverConnection.getClient();
        if (!client)
            throw new Error('No server connection available');
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
        }
        catch (error) {
            throw new Error(`Failed to resolve conflict: ${error}`);
        }
    }
    async forceUpdateRemote(client, conflict) {
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
    async forceUpdateLocal(conflict) {
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
    async applyMergedData(client, conflict, mergedData) {
        // Update both local and remote with merged data
        switch (conflict.type) {
            case 'note':
                await this.offlineCache.saveNote({
                    ...mergedData,
                    sync_status: 'synced',
                });
                await this.pushNoteToServer(client, mergedData);
                break;
            case 'person':
                await this.offlineCache.savePerson({
                    ...mergedData,
                    sync_status: 'synced',
                });
                await this.pushPersonToServer(client, mergedData);
                break;
            case 'todo':
                await this.offlineCache.saveTodo({
                    ...mergedData,
                    sync_status: 'synced',
                });
                await this.pushTodoToServer(client, mergedData);
                break;
        }
    }
    // Auto-sync management
    startAutoSync() {
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
    scheduleNextAutoSync() {
        if (this.autoSyncEnabled) {
            this.syncStatus.nextSync = new Date(Date.now() + this.autoSyncIntervalMs);
        }
    }
    setAutoSyncEnabled(enabled) {
        this.autoSyncEnabled = enabled;
        if (enabled) {
            this.startAutoSync();
        }
        else {
            this.stopAutoSync();
        }
    }
    setAutoSyncInterval(intervalMs) {
        this.autoSyncIntervalMs = intervalMs;
        if (this.autoSyncInterval) {
            this.stopAutoSync();
            this.startAutoSync();
        }
    }
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        this.syncStatus.nextSync = undefined;
    }
    // Status and utility methods
    getSyncStatus() {
        return { ...this.syncStatus };
    }
    getConflicts() {
        return [...this.syncStatus.conflicts];
    }
    updateSyncProgress(current, total, operation) {
        this.syncStatus.progress = {
            current,
            total,
            operation,
        };
    }
    isConflictError(error) {
        return error?.response?.status === 409 || error?.code === 'CONFLICT';
    }
    getApiEndpoint(tableName) {
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
    async close() {
        this.stopAutoSync();
    }
}
exports.SyncManager = SyncManager;

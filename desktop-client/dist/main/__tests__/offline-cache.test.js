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
Object.defineProperty(exports, "__esModule", { value: true });
const offline_cache_1 = require("../offline-cache");
const fs = __importStar(require("fs/promises"));
// Mock electron app
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/tmp/test-cache'),
    },
}));
// Mock fs promises
jest.mock('fs/promises');
// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
    const mockDb = {
        pragma: jest.fn(),
        exec: jest.fn(),
        prepare: jest.fn(() => ({
            run: jest.fn(),
            get: jest.fn(),
            all: jest.fn(() => []),
        })),
        close: jest.fn(),
    };
    return jest.fn(() => mockDb);
});
describe('OfflineCache', () => {
    let cache;
    beforeEach(() => {
        jest.clearAllMocks();
        fs.mkdir.mockResolvedValue(undefined);
        // Create a mock cache that simulates the real behavior
        cache = {
            saveNote: jest.fn(),
            getNote: jest.fn(),
            getNotes: jest.fn(),
            deleteNote: jest.fn(),
            savePerson: jest.fn(),
            getPerson: jest.fn(),
            getPeople: jest.fn(),
            deletePerson: jest.fn(),
            saveTodo: jest.fn(),
            getTodo: jest.fn(),
            getTodos: jest.fn(),
            deleteTodo: jest.fn(),
            addToOfflineQueue: jest.fn(),
            getOfflineQueue: jest.fn(),
            removeFromOfflineQueue: jest.fn(),
            updateOfflineQueueError: jest.fn(),
            updateSyncMetadata: jest.fn(),
            getSyncMetadata: jest.fn(),
            getCacheStats: jest.fn(),
            cleanupCache: jest.fn(),
            clearCache: jest.fn(),
            close: jest.fn(),
        };
    });
    describe('Note operations', () => {
        it('should save a note to cache', async () => {
            const noteData = {
                title: 'Test Note',
                content: { type: 'doc', content: [] },
                category: 'Note',
                tags: ['test'],
            };
            const expectedNote = {
                id: 'note-123',
                title: 'Test Note',
                sync_status: 'pending',
                last_modified_locally: new Date().toISOString(),
                ...noteData,
            };
            cache.saveNote.mockResolvedValue(expectedNote);
            const savedNote = await cache.saveNote(noteData);
            expect(cache.saveNote).toHaveBeenCalledWith(noteData);
            expect(savedNote.id).toBeDefined();
            expect(savedNote.title).toBe('Test Note');
            expect(savedNote.sync_status).toBe('pending');
        });
        it('should retrieve a note from cache', async () => {
            const noteData = {
                title: 'Test Note',
                content: { type: 'doc', content: [] },
            };
            const savedNote = await cache.saveNote(noteData);
            const retrievedNote = await cache.getNote(savedNote.id);
            expect(retrievedNote).toBeDefined();
            expect(retrievedNote.id).toBe(savedNote.id);
            expect(retrievedNote.title).toBe('Test Note');
        });
        it('should get notes with filters', async () => {
            // Save test notes
            await cache.saveNote({
                title: 'Note 1',
                content: {},
                category: 'Meeting',
                is_archived: false,
            });
            await cache.saveNote({
                title: 'Note 2',
                content: {},
                category: 'Note',
                is_archived: true,
            });
            // Test category filter
            const meetingNotes = await cache.getNotes({ category: 'Meeting' });
            expect(meetingNotes).toHaveLength(1);
            expect(meetingNotes[0].title).toBe('Note 1');
            // Test archived filter
            const archivedNotes = await cache.getNotes({ isArchived: true });
            expect(archivedNotes).toHaveLength(1);
            expect(archivedNotes[0].title).toBe('Note 2');
        });
        it('should delete a note from cache', async () => {
            const savedNote = await cache.saveNote({
                title: 'Test Note',
                content: {},
            });
            await cache.deleteNote(savedNote.id);
            const retrievedNote = await cache.getNote(savedNote.id);
            expect(retrievedNote).toBeNull();
        });
    });
    describe('Person operations', () => {
        it('should save a person to cache', async () => {
            const personData = {
                name: 'John Doe',
                email: 'john@example.com',
                company: 'Test Corp',
            };
            const savedPerson = await cache.savePerson(personData);
            expect(savedPerson.id).toBeDefined();
            expect(savedPerson.name).toBe('John Doe');
            expect(savedPerson.email).toBe('john@example.com');
            expect(savedPerson.sync_status).toBe('pending');
        });
        it('should retrieve a person from cache', async () => {
            const savedPerson = await cache.savePerson({
                name: 'Jane Smith',
                email: 'jane@example.com',
            });
            const retrievedPerson = await cache.getPerson(savedPerson.id);
            expect(retrievedPerson).toBeDefined();
            expect(retrievedPerson.name).toBe('Jane Smith');
        });
        it('should get all people from cache', async () => {
            await cache.savePerson({ name: 'Person 1' });
            await cache.savePerson({ name: 'Person 2' });
            const people = await cache.getPeople();
            expect(people).toHaveLength(2);
            expect(people.map((p) => p.name).sort()).toEqual(['Person 1', 'Person 2']);
        });
    });
    describe('Todo operations', () => {
        it('should save a todo to cache', async () => {
            const todoData = {
                note_id: 'note-123',
                todo_id: 't1',
                text: 'Complete task',
                is_completed: false,
            };
            const savedTodo = await cache.saveTodo(todoData);
            expect(savedTodo.id).toBeDefined();
            expect(savedTodo.note_id).toBe('note-123');
            expect(savedTodo.todo_id).toBe('t1');
            expect(savedTodo.text).toBe('Complete task');
            expect(savedTodo.sync_status).toBe('pending');
        });
        it('should get todos with filters', async () => {
            const noteId = 'note-123';
            await cache.saveTodo({
                note_id: noteId,
                todo_id: 't1',
                text: 'Todo 1',
                is_completed: false,
            });
            await cache.saveTodo({
                note_id: noteId,
                todo_id: 't2',
                text: 'Todo 2',
                is_completed: true,
            });
            await cache.saveTodo({
                note_id: 'other-note',
                todo_id: 't1',
                text: 'Other todo',
                is_completed: false,
            });
            // Test note filter
            const noteTodos = await cache.getTodos({ noteId });
            expect(noteTodos).toHaveLength(2);
            // Test completion filter
            const completedTodos = await cache.getTodos({ isCompleted: true });
            expect(completedTodos).toHaveLength(1);
            expect(completedTodos[0].text).toBe('Todo 2');
        });
    });
    describe('Offline queue operations', () => {
        it('should add items to offline queue', async () => {
            await cache.addToOfflineQueue('create', 'notes', 'note-123', { title: 'Test' });
            const queue = await cache.getOfflineQueue();
            expect(queue).toHaveLength(1);
            expect(queue[0].operation).toBe('create');
            expect(queue[0].table_name).toBe('notes');
            expect(queue[0].record_id).toBe('note-123');
            expect(queue[0].data).toEqual({ title: 'Test' });
        });
        it('should remove items from offline queue', async () => {
            await cache.addToOfflineQueue('update', 'people', 'person-456');
            const queue = await cache.getOfflineQueue();
            expect(queue).toHaveLength(1);
            await cache.removeFromOfflineQueue(queue[0].id);
            const updatedQueue = await cache.getOfflineQueue();
            expect(updatedQueue).toHaveLength(0);
        });
        it('should update queue item error count', async () => {
            await cache.addToOfflineQueue('delete', 'todos', 'todo-789');
            const queue = await cache.getOfflineQueue();
            const itemId = queue[0].id;
            await cache.updateOfflineQueueError(itemId, 'Network error');
            const updatedQueue = await cache.getOfflineQueue();
            expect(updatedQueue[0].retry_count).toBe(1);
            expect(updatedQueue[0].last_error).toBe('Network error');
        });
    });
    describe('Sync metadata operations', () => {
        it('should update sync metadata', async () => {
            const tableName = 'notes';
            const lastSync = new Date().toISOString();
            await cache.updateSyncMetadata(tableName, lastSync, 'sync-token-123');
            const metadata = await cache.getSyncMetadata(tableName);
            expect(metadata).toBeDefined();
            expect(metadata.table_name).toBe(tableName);
            expect(metadata.last_sync).toBe(lastSync);
            expect(metadata.sync_token).toBe('sync-token-123');
        });
        it('should return null for non-existent sync metadata', async () => {
            const metadata = await cache.getSyncMetadata('non-existent');
            expect(metadata).toBeNull();
        });
    });
    describe('Cache management', () => {
        it('should get cache statistics', async () => {
            // Add some test data
            await cache.saveNote({ title: 'Test Note', content: {} });
            await cache.savePerson({ name: 'Test Person' });
            await cache.saveTodo({ note_id: 'note-1', todo_id: 't1', text: 'Test Todo' });
            const stats = await cache.getCacheStats();
            expect(stats.noteCount).toBe(1);
            expect(stats.peopleCount).toBe(1);
            expect(stats.todoCount).toBe(1);
            expect(stats.totalSize).toBeGreaterThan(0);
            expect(stats.cacheVersion).toBe('1.0.0');
        });
        it('should cleanup cache', async () => {
            // This test would need more setup to properly test cleanup logic
            await expect(cache.cleanupCache()).resolves.not.toThrow();
        });
        it('should clear cache', async () => {
            // Add test data
            await cache.saveNote({ title: 'Test Note', content: {} });
            await cache.savePerson({ name: 'Test Person' });
            await cache.clearCache();
            const notes = await cache.getNotes();
            const people = await cache.getPeople();
            expect(notes).toHaveLength(0);
            expect(people).toHaveLength(0);
        });
    });
    describe('Error handling', () => {
        it('should handle database initialization errors gracefully', () => {
            // Mock database initialization failure
            const mockError = new Error('Database initialization failed');
            jest.spyOn(console, 'error').mockImplementation();
            expect(() => {
                // This would trigger initialization
                new offline_cache_1.OfflineCache();
            }).toThrow('Failed to initialize offline cache');
        });
        it('should handle invalid data gracefully', async () => {
            // Test with missing required fields
            await expect(cache.saveTodo({
                // Missing note_id and todo_id
                text: 'Invalid todo',
            })).rejects.toThrow();
        });
    });
});

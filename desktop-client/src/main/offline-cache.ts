import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs/promises';

export interface CachedNote {
  id: string;
  title: string;
  content: any; // JSON content
  category: string;
  tags: string[];
  folder_path: string;
  scheduled_date?: string;
  is_archived: boolean;
  is_pinned: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  server_id?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_modified_locally: string;
}

export interface CachedPerson {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  avatar_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  server_id?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_modified_locally: string;
}

export interface CachedTodo {
  id: string;
  note_id: string;
  todo_id: string;
  text: string;
  is_completed: boolean;
  assigned_person_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  server_id?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_modified_locally: string;
}

export interface SyncMetadata {
  table_name: string;
  last_sync: string;
  sync_token?: string;
  total_records: number;
  pending_changes: number;
}

export interface CacheStats {
  totalSize: number; // in bytes
  noteCount: number;
  peopleCount: number;
  todoCount: number;
  pendingChanges: number;
  lastCleanup: string;
  cacheVersion: string;
}

export class OfflineCache {
  private db: Database.Database | null = null;
  private dbPath: string;
  private maxCacheSize: number = 100 * 1024 * 1024; // 100MB default
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_VERSION = '1.0.0';

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'offline-cache.db');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = MEMORY');
      
      await this.createTables();
      await this.runMigrations();
      this.startCleanupScheduler();
      
      console.log('Offline cache initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline cache:', error);
      throw new Error('Failed to initialize offline cache');
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Notes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cached_notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL, -- JSON string
        category TEXT DEFAULT 'Note',
        tags TEXT DEFAULT '[]', -- JSON array
        folder_path TEXT DEFAULT '/',
        scheduled_date TEXT,
        is_archived INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        server_id TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_modified_locally TEXT NOT NULL,
        UNIQUE(id)
      )
    `);

    // People table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cached_people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        title TEXT,
        linkedin_url TEXT,
        avatar_url TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        server_id TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_modified_locally TEXT NOT NULL,
        UNIQUE(id)
      )
    `);

    // Todos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cached_todos (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        todo_id TEXT NOT NULL,
        text TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        assigned_person_id TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        server_id TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_modified_locally TEXT NOT NULL,
        UNIQUE(note_id, todo_id),
        FOREIGN KEY(note_id) REFERENCES cached_notes(id) ON DELETE CASCADE
      )
    `);

    // Sync metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        last_sync TEXT NOT NULL,
        sync_token TEXT,
        total_records INTEGER DEFAULT 0,
        pending_changes INTEGER DEFAULT 0
      )
    `);

    // Offline queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL, -- 'create', 'update', 'delete'
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT, -- JSON
        created_at TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT
      )
    `);

    // Cache settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON cached_notes(updated_at);
      CREATE INDEX IF NOT EXISTS idx_notes_sync_status ON cached_notes(sync_status);
      CREATE INDEX IF NOT EXISTS idx_notes_category ON cached_notes(category);
      CREATE INDEX IF NOT EXISTS idx_people_name ON cached_people(name);
      CREATE INDEX IF NOT EXISTS idx_people_sync_status ON cached_people(sync_status);
      CREATE INDEX IF NOT EXISTS idx_todos_note_id ON cached_todos(note_id);
      CREATE INDEX IF NOT EXISTS idx_todos_sync_status ON cached_todos(sync_status);
      CREATE INDEX IF NOT EXISTS idx_todos_due_date ON cached_todos(due_date);
      CREATE INDEX IF NOT EXISTS idx_queue_table_record ON offline_queue(table_name, record_id);
    `);

    // Initialize cache settings
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO cache_settings (key, value, updated_at) 
      VALUES (?, ?, ?)
    `).run('cache_version', this.CACHE_VERSION, now);

    this.db.prepare(`
      INSERT OR IGNORE INTO cache_settings (key, value, updated_at) 
      VALUES (?, ?, ?)
    `).run('last_cleanup', now, now);
  }

  private async runMigrations(): Promise<void> {
    // Future migrations can be added here
    // Check cache version and run necessary migrations
  }

  // Note operations
  async saveNote(note: Partial<CachedNote>): Promise<CachedNote> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const noteData: CachedNote = {
      id: note.id || this.generateId(),
      title: note.title || 'Untitled',
      content: typeof note.content === 'string' ? note.content : JSON.stringify(note.content || {}),
      category: note.category || 'Note',
      tags: Array.isArray(note.tags) ? note.tags : [],
      folder_path: note.folder_path || '/',
      scheduled_date: note.scheduled_date,
      is_archived: note.is_archived || false,
      is_pinned: note.is_pinned || false,
      is_favorite: note.is_favorite || false,
      created_at: note.created_at || now,
      updated_at: now,
      version: (note.version || 0) + 1,
      server_id: note.server_id,
      sync_status: 'pending',
      last_modified_locally: now,
    };

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cached_notes (
        id, title, content, category, tags, folder_path, scheduled_date,
        is_archived, is_pinned, is_favorite, created_at, updated_at, version,
        server_id, sync_status, last_modified_locally
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      noteData.id,
      noteData.title,
      noteData.content,
      noteData.category,
      JSON.stringify(noteData.tags),
      noteData.folder_path,
      noteData.scheduled_date,
      noteData.is_archived ? 1 : 0,
      noteData.is_pinned ? 1 : 0,
      noteData.is_favorite ? 1 : 0,
      noteData.created_at,
      noteData.updated_at,
      noteData.version,
      noteData.server_id,
      noteData.sync_status,
      noteData.last_modified_locally
    );

    // Add to offline queue if not synced
    if (noteData.sync_status === 'pending') {
      await this.addToOfflineQueue('update', 'notes', noteData.id, noteData);
    }

    return noteData;
  }

  async getNote(id: string): Promise<CachedNote | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM cached_notes WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapNoteFromDb(row);
  }

  async getNotes(filters?: {
    category?: string;
    tags?: string[];
    isArchived?: boolean;
    isPinned?: boolean;
    isFavorite?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CachedNote[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM cached_notes WHERE 1=1';
    const params: any[] = [];

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters?.isArchived !== undefined) {
      query += ' AND is_archived = ?';
      params.push(filters.isArchived ? 1 : 0);
    }

    if (filters?.isPinned !== undefined) {
      query += ' AND is_pinned = ?';
      params.push(filters.isPinned ? 1 : 0);
    }

    if (filters?.isFavorite !== undefined) {
      query += ' AND is_favorite = ?';
      params.push(filters.isFavorite ? 1 : 0);
    }

    query += ' ORDER BY updated_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapNoteFromDb(row));
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM cached_notes WHERE id = ?');
    stmt.run(id);

    // Add to offline queue
    await this.addToOfflineQueue('delete', 'notes', id);
  }

  // Person operations
  async savePerson(person: Partial<CachedPerson>): Promise<CachedPerson> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const personData: CachedPerson = {
      id: person.id || this.generateId(),
      name: person.name || 'Unnamed Person',
      email: person.email,
      phone: person.phone,
      company: person.company,
      title: person.title,
      linkedin_url: person.linkedin_url,
      avatar_url: person.avatar_url,
      notes: person.notes,
      created_at: person.created_at || now,
      updated_at: now,
      server_id: person.server_id,
      sync_status: 'pending',
      last_modified_locally: now,
    };

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cached_people (
        id, name, email, phone, company, title, linkedin_url, avatar_url, notes,
        created_at, updated_at, server_id, sync_status, last_modified_locally
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      personData.id,
      personData.name,
      personData.email,
      personData.phone,
      personData.company,
      personData.title,
      personData.linkedin_url,
      personData.avatar_url,
      personData.notes,
      personData.created_at,
      personData.updated_at,
      personData.server_id,
      personData.sync_status,
      personData.last_modified_locally
    );

    // Add to offline queue if not synced
    if (personData.sync_status === 'pending') {
      await this.addToOfflineQueue('update', 'people', personData.id, personData);
    }

    return personData;
  }

  async getPerson(id: string): Promise<CachedPerson | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM cached_people WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapPersonFromDb(row);
  }

  async getPeople(limit?: number, offset?: number): Promise<CachedPerson[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM cached_people ORDER BY name ASC';
    const params: any[] = [];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
      
      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapPersonFromDb(row));
  }

  async deletePerson(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM cached_people WHERE id = ?');
    stmt.run(id);

    // Add to offline queue
    await this.addToOfflineQueue('delete', 'people', id);
  }

  // Todo operations
  async saveTodo(todo: Partial<CachedTodo>): Promise<CachedTodo> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const todoData: CachedTodo = {
      id: todo.id || this.generateId(),
      note_id: todo.note_id!,
      todo_id: todo.todo_id!,
      text: todo.text || '',
      is_completed: todo.is_completed || false,
      assigned_person_id: todo.assigned_person_id,
      due_date: todo.due_date,
      created_at: todo.created_at || now,
      updated_at: now,
      server_id: todo.server_id,
      sync_status: 'pending',
      last_modified_locally: now,
    };

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cached_todos (
        id, note_id, todo_id, text, is_completed, assigned_person_id, due_date,
        created_at, updated_at, server_id, sync_status, last_modified_locally
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      todoData.id,
      todoData.note_id,
      todoData.todo_id,
      todoData.text,
      todoData.is_completed ? 1 : 0,
      todoData.assigned_person_id,
      todoData.due_date,
      todoData.created_at,
      todoData.updated_at,
      todoData.server_id,
      todoData.sync_status,
      todoData.last_modified_locally
    );

    // Add to offline queue if not synced
    if (todoData.sync_status === 'pending') {
      await this.addToOfflineQueue('update', 'todos', todoData.id, todoData);
    }

    return todoData;
  }

  async getTodo(id: string): Promise<CachedTodo | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM cached_todos WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapTodoFromDb(row);
  }

  async getTodos(filters?: {
    noteId?: string;
    isCompleted?: boolean;
    assignedPersonId?: string;
    dueDateRange?: { start: string; end: string };
    limit?: number;
    offset?: number;
  }): Promise<CachedTodo[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM cached_todos WHERE 1=1';
    const params: any[] = [];

    if (filters?.noteId) {
      query += ' AND note_id = ?';
      params.push(filters.noteId);
    }

    if (filters?.isCompleted !== undefined) {
      query += ' AND is_completed = ?';
      params.push(filters.isCompleted ? 1 : 0);
    }

    if (filters?.assignedPersonId) {
      query += ' AND assigned_person_id = ?';
      params.push(filters.assignedPersonId);
    }

    if (filters?.dueDateRange) {
      query += ' AND due_date BETWEEN ? AND ?';
      params.push(filters.dueDateRange.start, filters.dueDateRange.end);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapTodoFromDb(row));
  }

  async deleteTodo(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM cached_todos WHERE id = ?');
    stmt.run(id);

    // Add to offline queue
    await this.addToOfflineQueue('delete', 'todos', id);
  }

  // Offline queue operations
  async addToOfflineQueue(operation: 'create' | 'update' | 'delete', tableName: string, recordId: string, data?: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO offline_queue (operation, table_name, record_id, data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(operation, tableName, recordId, data ? JSON.stringify(data) : null, now);
  }

  async getOfflineQueue(): Promise<Array<{
    id: number;
    operation: 'create' | 'update' | 'delete';
    table_name: string;
    record_id: string;
    data?: any;
    created_at: string;
    retry_count: number;
    last_error?: string;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM offline_queue ORDER BY created_at ASC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : undefined,
    }));
  }

  async removeFromOfflineQueue(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM offline_queue WHERE id = ?');
    stmt.run(id);
  }

  async updateOfflineQueueError(id: number, error: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE offline_queue 
      SET retry_count = retry_count + 1, last_error = ? 
      WHERE id = ?
    `);
    stmt.run(error, id);
  }

  // Sync metadata operations
  async updateSyncMetadata(tableName: string, lastSync: string, syncToken?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const totalRecords = this.getRecordCount(tableName);
    const pendingChanges = this.getPendingChangesCount(tableName);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (table_name, last_sync, sync_token, total_records, pending_changes)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(tableName, lastSync, syncToken, totalRecords, pendingChanges);
  }

  async getSyncMetadata(tableName: string): Promise<SyncMetadata | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM sync_metadata WHERE table_name = ?');
    const row = stmt.get(tableName) as any;

    return row || null;
  }

  // Cache management
  async getCacheStats(): Promise<CacheStats> {
    if (!this.db) throw new Error('Database not initialized');

    const noteCount = this.getRecordCount('cached_notes');
    const peopleCount = this.getRecordCount('cached_people');
    const todoCount = this.getRecordCount('cached_todos');
    const pendingChanges = this.getTotalPendingChanges();

    // Get database file size
    const stats = await fs.stat(this.dbPath);
    const totalSize = stats.size;

    const lastCleanupStmt = this.db.prepare('SELECT value FROM cache_settings WHERE key = ?');
    const lastCleanupRow = lastCleanupStmt.get('last_cleanup') as any;
    const lastCleanup = lastCleanupRow?.value || new Date().toISOString();

    return {
      totalSize,
      noteCount,
      peopleCount,
      todoCount,
      pendingChanges,
      lastCleanup,
      cacheVersion: this.CACHE_VERSION,
    };
  }

  async cleanupCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    // Remove old synced records if cache is too large
    const stats = await this.getCacheStats();
    if (stats.totalSize > this.maxCacheSize) {
      // Keep only recent synced notes (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      this.db.prepare(`
        DELETE FROM cached_notes 
        WHERE sync_status = 'synced' 
        AND updated_at < ? 
        AND is_pinned = 0 
        AND is_favorite = 0
      `).run(thirtyDaysAgo);

      // Clean up orphaned todos
      this.db.prepare(`
        DELETE FROM cached_todos 
        WHERE note_id NOT IN (SELECT id FROM cached_notes)
      `).run();
    }

    // Remove old failed queue items (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    this.db.prepare(`
      DELETE FROM offline_queue 
      WHERE created_at < ? AND retry_count > 5
    `).run(sevenDaysAgo);

    // Vacuum database to reclaim space
    this.db.exec('VACUUM');

    // Update last cleanup time
    this.db.prepare(`
      UPDATE cache_settings 
      SET value = ?, updated_at = ? 
      WHERE key = 'last_cleanup'
    `).run(now, now);

    console.log('Cache cleanup completed');
  }

  async clearCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Clear all cached data but keep settings
    this.db.exec('DELETE FROM cached_notes');
    this.db.exec('DELETE FROM cached_people');
    this.db.exec('DELETE FROM cached_todos');
    this.db.exec('DELETE FROM offline_queue');
    this.db.exec('DELETE FROM sync_metadata');

    // Vacuum to reclaim space
    this.db.exec('VACUUM');

    console.log('Cache cleared successfully');
  }

  // Utility methods
  private mapNoteFromDb(row: any): CachedNote {
    return {
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      is_archived: Boolean(row.is_archived),
      is_pinned: Boolean(row.is_pinned),
      is_favorite: Boolean(row.is_favorite),
    };
  }

  private mapPersonFromDb(row: any): CachedPerson {
    return {
      ...row,
    };
  }

  private mapTodoFromDb(row: any): CachedTodo {
    return {
      ...row,
      is_completed: Boolean(row.is_completed),
    };
  }

  private getRecordCount(tableName: string): number {
    if (!this.db) return 0;

    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
    const result = stmt.get() as any;
    return result.count || 0;
  }

  private getPendingChangesCount(tableName: string): number {
    if (!this.db) return 0;

    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE sync_status = 'pending'`);
    const result = stmt.get() as any;
    return result.count || 0;
  }

  private getTotalPendingChanges(): number {
    if (!this.db) return 0;

    const queueStmt = this.db.prepare('SELECT COUNT(*) as count FROM offline_queue');
    const queueResult = queueStmt.get() as any;
    return queueResult.count || 0;
  }

  private generateId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startCleanupScheduler(): void {
    // Run cleanup every 24 hours
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache().catch(error => {
        console.error('Scheduled cache cleanup failed:', error);
      });
    }, 24 * 60 * 60 * 1000);
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
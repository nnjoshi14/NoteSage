import * as path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';

export interface CachedNote {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  folder_path: string;
  is_archived: boolean;
  is_pinned: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: 'synced' | 'pending' | 'conflict';
}

export interface SyncMetadata {
  table_name: string;
  last_sync: string;
  sync_token?: string;
}

export class OfflineCache {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'notesage-cache.db');
    
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cached_notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        category TEXT DEFAULT 'Note',
        tags TEXT, -- JSON array as string
        folder_path TEXT DEFAULT '/',
        is_archived BOOLEAN DEFAULT 0,
        is_pinned BOOLEAN DEFAULT 0,
        is_favorite BOOLEAN DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'synced'
      );

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
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS cached_todos (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        todo_id TEXT NOT NULL,
        text TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
        assigned_person_id TEXT,
        due_date TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced',
        UNIQUE(note_id, todo_id)
      );

      CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        last_sync TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_token TEXT
      );

      CREATE TABLE IF NOT EXISTS offline_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL, -- 'create', 'update', 'delete'
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT, -- JSON
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize sync metadata
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO sync_metadata (table_name) 
      VALUES ('notes'), ('people'), ('todos')
    `);
    stmt.run();
  }

  // Notes operations
  async getNotes(): Promise<CachedNote[]> {
    const stmt = this.db.prepare('SELECT * FROM cached_notes ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      is_archived: Boolean(row.is_archived),
      is_pinned: Boolean(row.is_pinned),
      is_favorite: Boolean(row.is_favorite),
    }));
  }

  async getNote(id: string): Promise<CachedNote | null> {
    const stmt = this.db.prepare('SELECT * FROM cached_notes WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      is_archived: Boolean(row.is_archived),
      is_pinned: Boolean(row.is_pinned),
      is_favorite: Boolean(row.is_favorite),
    };
  }

  async saveNote(note: Partial<CachedNote>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cached_notes 
      (id, title, content, category, tags, folder_path, is_archived, is_pinned, is_favorite, 
       created_at, updated_at, version, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      note.id,
      note.title,
      note.content,
      note.category || 'Note',
      JSON.stringify(note.tags || []),
      note.folder_path || '/',
      note.is_archived ? 1 : 0,
      note.is_pinned ? 1 : 0,
      note.is_favorite ? 1 : 0,
      note.created_at || new Date().toISOString(),
      note.updated_at || new Date().toISOString(),
      note.version || 1,
      note.sync_status || 'pending'
    );
  }

  async deleteNote(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM cached_notes WHERE id = ?');
    stmt.run(id);
  }

  // Sync operations
  async getSyncMetadata(tableName: string): Promise<SyncMetadata | null> {
    const stmt = this.db.prepare('SELECT * FROM sync_metadata WHERE table_name = ?');
    return stmt.get(tableName) as SyncMetadata | null;
  }

  async updateSyncMetadata(tableName: string, lastSync: Date, syncToken?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sync_metadata 
      SET last_sync = ?, sync_token = ? 
      WHERE table_name = ?
    `);
    stmt.run(lastSync.toISOString(), syncToken, tableName);
  }

  // Offline queue operations
  async addToOfflineQueue(operation: string, tableName: string, recordId: string, data: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO offline_queue (operation, table_name, record_id, data)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(operation, tableName, recordId, JSON.stringify(data));
  }

  async getOfflineQueue(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM offline_queue ORDER BY created_at ASC');
    return stmt.all();
  }

  async removeFromOfflineQueue(id: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM offline_queue WHERE id = ?');
    stmt.run(id);
  }

  async clearOfflineQueue(): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM offline_queue');
    stmt.run();
  }

  // Utility methods
  async getPendingChanges(): Promise<any[]> {
    const notes = this.db.prepare("SELECT * FROM cached_notes WHERE sync_status = 'pending'").all();
    const people = this.db.prepare("SELECT * FROM cached_people WHERE sync_status = 'pending'").all();
    const todos = this.db.prepare("SELECT * FROM cached_todos WHERE sync_status = 'pending'").all();
    
    return [
      ...notes.map(n => ({ ...n, table: 'notes' })),
      ...people.map(p => ({ ...p, table: 'people' })),
      ...todos.map(t => ({ ...t, table: 'todos' })),
    ];
  }

  close(): void {
    this.db.close();
  }
}
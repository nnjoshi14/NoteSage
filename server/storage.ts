import {
  users,
  people,
  notes,
  tags,
  noteTags,
  noteConnections,
  noteLinks,
  insights,
  todos,
  userAIConfigs,
  type User,
  type UpsertUser,
  type Person,
  type InsertPerson,
  type Note,
  type InsertNote,
  type Tag,
  type InsertTag,
  type Todo,
  type InsertTodo,
  type Insight,
  type InsertInsight,
  type NoteConnection,
  type NoteLink,
  type UserAIConfig,
  type InsertUserAIConfig,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // People operations
  getPeople(userId: string): Promise<Person[]>;
  getPerson(id: string): Promise<Person | undefined>;
  createPerson(person: InsertPerson): Promise<Person>;
  updatePerson(id: string, updates: Partial<InsertPerson>): Promise<Person>;
  deletePerson(id: string): Promise<void>;
  searchPeople(userId: string, query: string): Promise<Person[]>;
  
  // Notes operations
  getNotes(userId: string): Promise<Note[]>;
  getNote(id: string): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, updates: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  searchNotes(userId: string, query: string): Promise<Note[]>;
  getRecentNotes(userId: string, limit: number): Promise<Note[]>;
  
  // Connections operations
  createNoteConnection(noteId: string, personId: string, connectionType?: string): Promise<NoteConnection>;
  getNoteConnections(noteId: string): Promise<Array<NoteConnection & { person: Person }>>;
  getPersonConnections(personId: string): Promise<Array<NoteConnection & { note: Note }>>;
  deleteNoteConnection(noteId: string, personId: string): Promise<void>;
  
  // Note links operations
  createNoteLink(sourceNoteId: string, targetNoteId: string): Promise<NoteLink>;
  getNoteLinks(noteId: string): Promise<Array<NoteLink & { sourceNote?: Note; targetNote?: Note }>>;
  deleteNoteLink(sourceNoteId: string, targetNoteId: string): Promise<void>;
  
  // Tags operations
  getTags(userId: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  addTagToNote(noteId: string, tagId: string): Promise<void>;
  removeTagFromNote(noteId: string, tagId: string): Promise<void>;
  
  // Insights operations
  getInsights(userId: string): Promise<Insight[]>;
  createInsight(insight: InsertInsight): Promise<Insight>;
  markInsightAsRead(id: string): Promise<void>;
  
  // Todos operations
  getTodos(userId: string): Promise<Todo[]>;
  createTodo(todo: InsertTodo): Promise<Todo>;
  updateTodo(id: string, updates: Partial<InsertTodo>): Promise<Todo>;
  deleteTodo(id: string): Promise<void>;
  
  // Analytics
  getConnectionStats(userId: string): Promise<{
    totalNotes: number;
    totalPeople: number;
    totalConnections: number;
    totalTodos: number;
    completedTodos: number;
  }>;

  // AI Config operations
  getUserAIConfigs(userId: string): Promise<UserAIConfig[]>;
  getActiveAIConfig(userId: string): Promise<UserAIConfig | undefined>;
  createAIConfig(config: InsertUserAIConfig): Promise<UserAIConfig>;
  updateAIConfig(id: string, updates: Partial<InsertUserAIConfig>): Promise<UserAIConfig>;
  deleteAIConfig(id: string): Promise<void>;
  setActiveAIConfig(userId: string, configId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // People operations
  async getPeople(userId: string): Promise<Person[]> {
    return db.select().from(people).where(eq(people.userId, userId)).orderBy(desc(people.createdAt));
  }

  async getPerson(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person;
  }

  async createPerson(person: InsertPerson): Promise<Person> {
    const [newPerson] = await db.insert(people).values(person).returning();
    return newPerson;
  }

  async updatePerson(id: string, updates: Partial<InsertPerson>): Promise<Person> {
    const [updatedPerson] = await db
      .update(people)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(people.id, id))
      .returning();
    return updatedPerson;
  }

  async deletePerson(id: string): Promise<void> {
    await db.delete(people).where(eq(people.id, id));
  }

  async searchPeople(userId: string, query: string): Promise<Person[]> {
    return db
      .select()
      .from(people)
      .where(
        and(
          eq(people.userId, userId),
          or(
            ilike(people.name, `%${query}%`),
            ilike(people.email, `%${query}%`),
            ilike(people.company, `%${query}%`)
          )
        )
      )
      .orderBy(desc(people.createdAt));
  }

  // Notes operations
  async getNotes(userId: string): Promise<Note[]> {
    return db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.updatedAt));
  }

  async getNote(id: string): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    return note;
  }

  async createNote(note: InsertNote): Promise<Note> {
    const [newNote] = await db.insert(notes).values(note).returning();
    return newNote;
  }

  async updateNote(id: string, updates: Partial<InsertNote>): Promise<Note> {
    const [updatedNote] = await db
      .update(notes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();
    return updatedNote;
  }

  async deleteNote(id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  async searchNotes(userId: string, query: string): Promise<Note[]> {
    return db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          or(
            ilike(notes.title, `%${query}%`),
            ilike(notes.content, `%${query}%`)
          )
        )
      )
      .orderBy(desc(notes.updatedAt));
  }

  async getRecentNotes(userId: string, limit: number): Promise<Note[]> {
    return db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt))
      .limit(limit);
  }

  // Connections operations
  async createNoteConnection(noteId: string, personId: string, connectionType = "mentioned"): Promise<NoteConnection> {
    const [connection] = await db
      .insert(noteConnections)
      .values({ noteId, personId, connectionType })
      .returning();
    return connection;
  }

  async getNoteConnections(noteId: string): Promise<Array<NoteConnection & { person: Person }>> {
    return db
      .select({
        id: noteConnections.id,
        noteId: noteConnections.noteId,
        personId: noteConnections.personId,
        connectionType: noteConnections.connectionType,
        createdAt: noteConnections.createdAt,
        person: people,
      })
      .from(noteConnections)
      .innerJoin(people, eq(noteConnections.personId, people.id))
      .where(eq(noteConnections.noteId, noteId));
  }

  async getPersonConnections(personId: string): Promise<Array<NoteConnection & { note: Note }>> {
    return db
      .select({
        id: noteConnections.id,
        noteId: noteConnections.noteId,
        personId: noteConnections.personId,
        connectionType: noteConnections.connectionType,
        createdAt: noteConnections.createdAt,
        note: notes,
      })
      .from(noteConnections)
      .innerJoin(notes, eq(noteConnections.noteId, notes.id))
      .where(eq(noteConnections.personId, personId));
  }

  async deleteNoteConnection(noteId: string, personId: string): Promise<void> {
    await db
      .delete(noteConnections)
      .where(and(eq(noteConnections.noteId, noteId), eq(noteConnections.personId, personId)));
  }

  // Note links operations
  async createNoteLink(sourceNoteId: string, targetNoteId: string): Promise<NoteLink> {
    const [link] = await db
      .insert(noteLinks)
      .values({ sourceNoteId, targetNoteId })
      .returning();
    return link;
  }

  async getNoteLinks(noteId: string): Promise<Array<NoteLink & { sourceNote?: Note; targetNote?: Note }>> {
    const outgoingLinks = await db
      .select({
        id: noteLinks.id,
        sourceNoteId: noteLinks.sourceNoteId,
        targetNoteId: noteLinks.targetNoteId,
        createdAt: noteLinks.createdAt,
        sourceNote: sql`NULL`.as("sourceNote"),
        targetNote: notes,
      })
      .from(noteLinks)
      .innerJoin(notes, eq(noteLinks.targetNoteId, notes.id))
      .where(eq(noteLinks.sourceNoteId, noteId));

    const incomingLinks = await db
      .select({
        id: noteLinks.id,
        sourceNoteId: noteLinks.sourceNoteId,
        targetNoteId: noteLinks.targetNoteId,
        createdAt: noteLinks.createdAt,
        sourceNote: notes,
        targetNote: sql`NULL`.as("targetNote"),
      })
      .from(noteLinks)
      .innerJoin(notes, eq(noteLinks.sourceNoteId, notes.id))
      .where(eq(noteLinks.targetNoteId, noteId));

    return [...outgoingLinks, ...incomingLinks];
  }

  async deleteNoteLink(sourceNoteId: string, targetNoteId: string): Promise<void> {
    await db
      .delete(noteLinks)
      .where(and(eq(noteLinks.sourceNoteId, sourceNoteId), eq(noteLinks.targetNoteId, targetNoteId)));
  }

  // Tags operations
  async getTags(userId: string): Promise<Tag[]> {
    return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db.insert(tags).values(tag).returning();
    return newTag;
  }

  async addTagToNote(noteId: string, tagId: string): Promise<void> {
    await db.insert(noteTags).values({ noteId, tagId });
  }

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    await db.delete(noteTags).where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)));
  }

  // Insights operations
  async getInsights(userId: string): Promise<Insight[]> {
    return db
      .select()
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt));
  }

  async createInsight(insight: InsertInsight): Promise<Insight> {
    const [newInsight] = await db.insert(insights).values(insight).returning();
    return newInsight;
  }

  async markInsightAsRead(id: string): Promise<void> {
    await db.update(insights).set({ isRead: true }).where(eq(insights.id, id));
  }

  // Todos operations
  async getTodos(userId: string): Promise<Todo[]> {
    return db
      .select()
      .from(todos)
      .where(eq(todos.userId, userId))
      .orderBy(desc(todos.createdAt));
  }

  async createTodo(todo: InsertTodo): Promise<Todo> {
    const [newTodo] = await db.insert(todos).values(todo).returning();
    return newTodo;
  }

  async updateTodo(id: string, updates: Partial<InsertTodo>): Promise<Todo> {
    const [updatedTodo] = await db
      .update(todos)
      .set(updates)
      .where(eq(todos.id, id))
      .returning();
    return updatedTodo;
  }

  async deleteTodo(id: string): Promise<void> {
    await db.delete(todos).where(eq(todos.id, id));
  }

  // Analytics
  async getConnectionStats(userId: string): Promise<{
    totalNotes: number;
    totalPeople: number;
    totalConnections: number;
    totalTodos: number;
    completedTodos: number;
  }> {
    const [notesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(eq(notes.userId, userId));

    const [peopleCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(people)
      .where(eq(people.userId, userId));

    const [connectionsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(noteConnections)
      .innerJoin(notes, eq(noteConnections.noteId, notes.id))
      .where(eq(notes.userId, userId));

    const [todosCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(todos)
      .where(eq(todos.userId, userId));

    const [completedTodosCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.isCompleted, true)));

    return {
      totalNotes: notesCount.count,
      totalPeople: peopleCount.count,
      totalConnections: connectionsCount.count,
      totalTodos: todosCount.count,
      completedTodos: completedTodosCount.count,
    };
  }

  // AI Config operations
  async getUserAIConfigs(userId: string): Promise<UserAIConfig[]> {
    return await db.select().from(userAIConfigs).where(eq(userAIConfigs.userId, userId));
  }

  async getActiveAIConfig(userId: string): Promise<UserAIConfig | undefined> {
    const [config] = await db
      .select()
      .from(userAIConfigs)
      .where(and(eq(userAIConfigs.userId, userId), eq(userAIConfigs.isActive, true)));
    return config;
  }

  async createAIConfig(config: InsertUserAIConfig): Promise<UserAIConfig> {
    // First, set all existing configs for this user to inactive if this one is active
    if (config.isActive) {
      await db
        .update(userAIConfigs)
        .set({ isActive: false })
        .where(eq(userAIConfigs.userId, config.userId));
    }

    const [newConfig] = await db.insert(userAIConfigs).values(config).returning();
    return newConfig;
  }

  async updateAIConfig(id: string, updates: Partial<InsertUserAIConfig>): Promise<UserAIConfig> {
    // If setting this config as active, deactivate others for this user
    if (updates.isActive) {
      const [existingConfig] = await db
        .select()
        .from(userAIConfigs)
        .where(eq(userAIConfigs.id, id));
      
      if (existingConfig) {
        await db
          .update(userAIConfigs)
          .set({ isActive: false })
          .where(eq(userAIConfigs.userId, existingConfig.userId));
      }
    }

    const [updatedConfig] = await db
      .update(userAIConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userAIConfigs.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteAIConfig(id: string): Promise<void> {
    await db.delete(userAIConfigs).where(eq(userAIConfigs.id, id));
  }

  async setActiveAIConfig(userId: string, configId: string): Promise<void> {
    // Deactivate all configs for this user
    await db
      .update(userAIConfigs)
      .set({ isActive: false })
      .where(eq(userAIConfigs.userId, userId));

    // Activate the specified config
    await db
      .update(userAIConfigs)
      .set({ isActive: true })
      .where(eq(userAIConfigs.id, configId));
  }
}

export const storage = new DatabaseStorage();

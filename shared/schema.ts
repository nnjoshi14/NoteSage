import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
  text,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userAIConfigs = pgTable("user_ai_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { enum: ["openai", "gemini", "grok"] }).notNull(),
  apiKey: varchar("api_key").notNull(),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userProviderIdx: uniqueIndex("user_provider_idx").on(table.userId, table.provider),
}));

// People database for contacts and relationships
export const people = pgTable("people", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  company: varchar("company"),
  title: varchar("title"),
  linkedinUrl: varchar("linkedin_url"),
  notes: text("notes"),
  avatarUrl: varchar("avatar_url"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notes table for knowledge management
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tags for organizing notes
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for note-tag relationships
export const noteTags = pgTable("note_tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
});

// Connections between notes and people
export const noteConnections = pgTable("note_connections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  connectionType: varchar("connection_type").default("mentioned"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Backlinks between notes
export const noteLinks = pgTable("note_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceNoteId: uuid("source_note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  targetNoteId: uuid("target_note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI-generated insights
export const insights = pgTable("insights", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // "pattern", "suggestion", "connection"
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  relevantNoteIds: jsonb("relevant_note_ids"),
  relevantPersonIds: jsonb("relevant_person_ids"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI-generated todos
export const todos = pgTable("todos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").default(false),
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  people: many(people),
  notes: many(notes),
  tags: many(tags),
  insights: many(insights),
  todos: many(todos),
  aiConfigs: many(userAIConfigs),
}));

export const userAIConfigsRelations = relations(userAIConfigs, ({ one }) => ({
  user: one(users, {
    fields: [userAIConfigs.userId],
    references: [users.id],
  }),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(users, {
    fields: [people.userId],
    references: [users.id],
  }),
  noteConnections: many(noteConnections),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  noteTags: many(noteTags),
  noteConnections: many(noteConnections),
  sourceLinks: many(noteLinks, { relationName: "sourceLinks" }),
  targetLinks: many(noteLinks, { relationName: "targetLinks" }),
  todos: many(todos),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  noteTags: many(noteTags),
}));

export const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, {
    fields: [noteTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [noteTags.tagId],
    references: [tags.id],
  }),
}));

export const noteConnectionsRelations = relations(noteConnections, ({ one }) => ({
  note: one(notes, {
    fields: [noteConnections.noteId],
    references: [notes.id],
  }),
  person: one(people, {
    fields: [noteConnections.personId],
    references: [people.id],
  }),
}));

export const noteLinksRelations = relations(noteLinks, ({ one }) => ({
  sourceNote: one(notes, {
    fields: [noteLinks.sourceNoteId],
    references: [notes.id],
    relationName: "sourceLinks",
  }),
  targetNote: one(notes, {
    fields: [noteLinks.targetNoteId],
    references: [notes.id],
    relationName: "targetLinks",
  }),
}));

export const insightsRelations = relations(insights, ({ one }) => ({
  user: one(users, {
    fields: [insights.userId],
    references: [users.id],
  }),
}));

export const todosRelations = relations(todos, ({ one }) => ({
  user: one(users, {
    fields: [todos.userId],
    references: [users.id],
  }),
  note: one(notes, {
    fields: [todos.noteId],
    references: [notes.id],
  }),
}));

// Insert schemas
export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const insertTodoSchema = createInsertSchema(todos).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertInsightSchema = createInsertSchema(insights).omit({
  id: true,
  createdAt: true,
});

export const insertUserAIConfigSchema = createInsertSchema(userAIConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Additional types for frontend
export interface Stats {
  totalNotes?: number;
  totalPeople?: number;
}

export interface Todo {
  id: string;
  content: string;
  isCompleted: boolean;
  noteId?: string;
  createdAt: Date;
}

export interface Insight {
  id: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
}
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof people.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTodo = z.infer<typeof insertTodoSchema>;
export type Todo = typeof todos.$inferSelect;
export type InsertInsight = z.infer<typeof insertInsightSchema>;
export type Insight = typeof insights.$inferSelect;
export type NoteConnection = typeof noteConnections.$inferSelect;
export type NoteLink = typeof noteLinks.$inferSelect;
export type InsertUserAIConfig = z.infer<typeof insertUserAIConfigSchema>;
export type UserAIConfig = typeof userAIConfigs.$inferSelect;

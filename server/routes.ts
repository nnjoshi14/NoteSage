import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { aiService } from "./services/aiService";
import { insertNoteSchema, insertPersonSchema, insertTodoSchema, insertUserAIConfigSchema } from "@shared/schema";
import { extractTodosFromNote, generateInsights, analyzeRelationships, type AIConfig } from "./services/aiService";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Notes routes
  app.get('/api/notes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notes = await storage.getNotes(userId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.get('/api/notes/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const notes = await storage.getRecentNotes(userId, limit);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching recent notes:", error);
      res.status(500).json({ message: "Failed to fetch recent notes" });
    }
  });

  app.get('/api/notes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error fetching note:", error);
      res.status(500).json({ message: "Failed to fetch note" });
    }
  });

  app.post('/api/notes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const noteData = insertNoteSchema.parse({ ...req.body, userId });
      const note = await storage.createNote(noteData);
      
      // Auto-extract todos from content with AI if configured
      if (note.content) {
        const aiConfig = await storage.getActiveAIConfig(userId);
        if (aiConfig) {
          try {
            const config: AIConfig = { provider: aiConfig.provider, apiKey: aiConfig.apiKey };
            const todos = await extractTodosFromNote(note.content, config);
            for (const todo of todos) {
              await storage.createTodo({
                ...todo,
                noteId: note.id,
                userId,
              });
            }
          } catch (error) {
            console.warn("AI todo extraction failed:", error);
            // Continue without AI features
          }
        }
      }
      
      res.json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.put('/api/notes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updates = req.body;
      const note = await storage.updateNote(req.params.id, updates);
      
      // Re-extract todos if content changed
      if (updates.content) {
        const todos = await aiService.extractTodosFromNote(updates.content);
        for (const todo of todos) {
          await storage.createTodo({
            ...todo,
            noteId: note.id,
            userId: req.user.claims.sub,
          });
        }
      }
      
      res.json(note);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete('/api/notes/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteNote(req.params.id);
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // People routes
  app.get('/api/people', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const people = await storage.getPeople(userId);
      res.json(people);
    } catch (error) {
      console.error("Error fetching people:", error);
      res.status(500).json({ message: "Failed to fetch people" });
    }
  });

  app.get('/api/people/:id', isAuthenticated, async (req: any, res) => {
    try {
      const person = await storage.getPerson(req.params.id);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }
      res.json(person);
    } catch (error) {
      console.error("Error fetching person:", error);
      res.status(500).json({ message: "Failed to fetch person" });
    }
  });

  app.post('/api/people', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const personData = insertPersonSchema.parse({ ...req.body, userId });
      const person = await storage.createPerson(personData);
      res.json(person);
    } catch (error) {
      console.error("Error creating person:", error);
      res.status(500).json({ message: "Failed to create person" });
    }
  });

  app.put('/api/people/:id', isAuthenticated, async (req: any, res) => {
    try {
      const person = await storage.updatePerson(req.params.id, req.body);
      res.json(person);
    } catch (error) {
      console.error("Error updating person:", error);
      res.status(500).json({ message: "Failed to update person" });
    }
  });

  app.delete('/api/people/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deletePerson(req.params.id);
      res.json({ message: "Person deleted successfully" });
    } catch (error) {
      console.error("Error deleting person:", error);
      res.status(500).json({ message: "Failed to delete person" });
    }
  });

  // Search routes
  app.get('/api/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      
      if (!query) {
        return res.json({ notes: [], people: [] });
      }

      const [notes, people] = await Promise.all([
        storage.searchNotes(userId, query),
        storage.searchPeople(userId, query),
      ]);

      res.json({ notes, people });
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ message: "Failed to search" });
    }
  });

  // Connections routes
  app.get('/api/notes/:id/connections', isAuthenticated, async (req: any, res) => {
    try {
      const connections = await storage.getNoteConnections(req.params.id);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching note connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  app.post('/api/notes/:noteId/connections/:personId', isAuthenticated, async (req: any, res) => {
    try {
      const { noteId, personId } = req.params;
      const { connectionType } = req.body;
      const connection = await storage.createNoteConnection(noteId, personId, connectionType);
      res.json(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      res.status(500).json({ message: "Failed to create connection" });
    }
  });

  app.delete('/api/notes/:noteId/connections/:personId', isAuthenticated, async (req: any, res) => {
    try {
      const { noteId, personId } = req.params;
      await storage.deleteNoteConnection(noteId, personId);
      res.json({ message: "Connection deleted successfully" });
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  app.get('/api/people/:id/connections', isAuthenticated, async (req: any, res) => {
    try {
      const connections = await storage.getPersonConnections(req.params.id);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching person connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Note links routes
  app.get('/api/notes/:id/links', isAuthenticated, async (req: any, res) => {
    try {
      const links = await storage.getNoteLinks(req.params.id);
      res.json(links);
    } catch (error) {
      console.error("Error fetching note links:", error);
      res.status(500).json({ message: "Failed to fetch links" });
    }
  });

  app.post('/api/notes/:sourceId/links/:targetId', isAuthenticated, async (req: any, res) => {
    try {
      const { sourceId, targetId } = req.params;
      const link = await storage.createNoteLink(sourceId, targetId);
      res.json(link);
    } catch (error) {
      console.error("Error creating note link:", error);
      res.status(500).json({ message: "Failed to create link" });
    }
  });

  // Todos routes
  app.get('/api/todos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const todos = await storage.getTodos(userId);
      res.json(todos);
    } catch (error) {
      console.error("Error fetching todos:", error);
      res.status(500).json({ message: "Failed to fetch todos" });
    }
  });

  app.post('/api/todos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const todoData = insertTodoSchema.parse({ ...req.body, userId });
      const todo = await storage.createTodo(todoData);
      res.json(todo);
    } catch (error) {
      console.error("Error creating todo:", error);
      res.status(500).json({ message: "Failed to create todo" });
    }
  });

  app.put('/api/todos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updates = req.body;
      if (updates.isCompleted) {
        updates.completedAt = new Date();
      }
      const todo = await storage.updateTodo(req.params.id, updates);
      res.json(todo);
    } catch (error) {
      console.error("Error updating todo:", error);
      res.status(500).json({ message: "Failed to update todo" });
    }
  });

  app.delete('/api/todos/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteTodo(req.params.id);
      res.json({ message: "Todo deleted successfully" });
    } catch (error) {
      console.error("Error deleting todo:", error);
      res.status(500).json({ message: "Failed to delete todo" });
    }
  });

  // Insights routes
  app.get('/api/insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const insights = await storage.getInsights(userId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.post('/api/insights/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const [notes, people, connections] = await Promise.all([
        storage.getNotes(userId),
        storage.getPeople(userId),
        storage.getConnectionStats(userId),
      ]);

      const noteConnections = [];
      for (const note of notes) {
        const noteConns = await storage.getNoteConnections(note.id);
        noteConnections.push(...noteConns.map(c => ({ noteId: note.id, personId: c.personId })));
      }

      // Generate insights with AI if configured
      const aiConfig = await storage.getActiveAIConfig(userId);
      if (!aiConfig) {
        return res.status(400).json({ message: "AI configuration required for insights generation" });
      }

      try {
        const config: AIConfig = { provider: aiConfig.provider, apiKey: aiConfig.apiKey };
        const aiInsights = await generateInsights(notes, people, noteConnections, config);
        
        const insights = [];
        for (const insight of aiInsights) {
          const created = await storage.createInsight({
            ...insight,
            userId,
          });
          insights.push(created);
        }
        
        res.json(insights);
      } catch (error) {
        console.error("AI insights generation failed:", error);
        res.status(500).json({ message: "Failed to generate insights with AI provider" });
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  app.put('/api/insights/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      await storage.markInsightAsRead(req.params.id);
      res.json({ message: "Insight marked as read" });
    } catch (error) {
      console.error("Error marking insight as read:", error);
      res.status(500).json({ message: "Failed to mark insight as read" });
    }
  });

  // Stats route
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getConnectionStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // AI Config routes
  app.get('/api/ai-configs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const configs = await storage.getUserAIConfigs(userId);
      
      // Don't expose API keys in the response
      const safeConfigs = configs.map(config => ({
        ...config,
        apiKey: config.apiKey.replace(/./g, '*').slice(0, 20) + '...',
      }));
      
      res.json(safeConfigs);
    } catch (error) {
      console.error("Error fetching AI configs:", error);
      res.status(500).json({ message: "Failed to fetch AI configurations" });
    }
  });

  app.get('/api/ai-configs/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.getActiveAIConfig(userId);
      
      if (config) {
        // Don't expose API key in the response
        const safeConfig = {
          ...config,
          apiKey: config.apiKey.replace(/./g, '*').slice(0, 20) + '...',
        };
        res.json(safeConfig);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching active AI config:", error);
      res.status(500).json({ message: "Failed to fetch active AI configuration" });
    }
  });

  app.post('/api/ai-configs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const configData = insertUserAIConfigSchema.parse({ ...req.body, userId });
      
      // Test the API key before saving
      const testConfig: AIConfig = { provider: configData.provider, apiKey: configData.apiKey };
      try {
        // Test with a simple extraction to validate the key
        await extractTodosFromNote("Test note for API validation", testConfig);
      } catch (error) {
        return res.status(400).json({ message: "Invalid API key or provider configuration" });
      }
      
      const config = await storage.createAIConfig(configData);
      res.json({ ...config, apiKey: '***' }); // Don't return the API key
    } catch (error) {
      console.error("Error creating AI config:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid configuration data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create AI configuration" });
      }
    }
  });

  app.put('/api/ai-configs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updates = req.body;
      
      // If updating API key, test it first
      if (updates.apiKey && updates.provider) {
        const testConfig: AIConfig = { provider: updates.provider, apiKey: updates.apiKey };
        try {
          await extractTodosFromNote("Test note for API validation", testConfig);
        } catch (error) {
          return res.status(400).json({ message: "Invalid API key or provider configuration" });
        }
      }
      
      const config = await storage.updateAIConfig(req.params.id, updates);
      res.json({ ...config, apiKey: '***' }); // Don't return the API key
    } catch (error) {
      console.error("Error updating AI config:", error);
      res.status(500).json({ message: "Failed to update AI configuration" });
    }
  });

  app.delete('/api/ai-configs/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteAIConfig(req.params.id);
      res.json({ message: "AI configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting AI config:", error);
      res.status(500).json({ message: "Failed to delete AI configuration" });
    }
  });

  app.post('/api/ai-configs/:id/activate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.setActiveAIConfig(userId, req.params.id);
      res.json({ message: "AI configuration activated successfully" });
    } catch (error) {
      console.error("Error activating AI config:", error);
      res.status(500).json({ message: "Failed to activate AI configuration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

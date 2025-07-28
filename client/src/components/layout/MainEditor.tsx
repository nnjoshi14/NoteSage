import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import RichTextEditor from "@/components/editor/RichTextEditor";
import DrawingCanvas from "@/components/editor/DrawingCanvas";
import KnowledgeGraph from "@/components/graph/KnowledgeGraph";
import PersonCard from "@/components/people/PersonCard";
import PersonDialog from "@/components/people/PersonDialog";
import { 
  Menu, 
  Share, 
  Pencil, 
  Lightbulb, 
  Plus,
  CheckSquare,
  Users,
  StickyNote,
  Network,
  Eye
} from "lucide-react";
import type { Note, Person, Todo, Insight } from "@shared/schema";

interface MainEditorProps {
  currentView: "notes" | "people" | "graph" | "insights" | "todos";
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export default function MainEditor({
  currentView,
  selectedNoteId,
  onSelectNote,
  onToggleSidebar,
  isSidebarOpen
}: MainEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);

  // Queries
  const { data: currentNote, isLoading: noteLoading } = useQuery<Note>({
    queryKey: ["/api/notes", selectedNoteId],
    enabled: !!selectedNoteId && currentView === "notes",
  });

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
    enabled: currentView === "notes",
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
    enabled: currentView === "people",
  });

  const { data: todos = [] } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
    enabled: currentView === "todos",
  });

  const { data: insights = [] } = useQuery<Insight[]>({
    queryKey: ["/api/insights"],
    enabled: currentView === "insights",
  });

  // Mutations
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: { title: string; content?: string }) => {
      return apiRequest("POST", "/api/notes", noteData);
    },
    onSuccess: async (response) => {
      const newNote = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onSelectNote(newNote.id);
      toast({
        title: "Note created",
        description: "Your new note has been created successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Note> }) => {
      return apiRequest("PUT", `/api/notes/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", selectedNoteId] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleTodoMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      return apiRequest("PUT", `/api/todos/${id}`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update todo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/insights/generate", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      toast({
        title: "Insights generated",
        description: "New AI insights have been generated from your knowledge base.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markInsightReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PUT", `/api/insights/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
    },
  });

  const handleCreateNote = () => {
    createNoteMutation.mutate({
      title: "Untitled",
      content: "",
    });
  };

  const handleNoteUpdate = (updates: Partial<Note>) => {
    if (selectedNoteId) {
      updateNoteMutation.mutate({ id: selectedNoteId, updates });
    }
  };

  const handleToggleTodo = (id: string, isCompleted: boolean) => {
    toggleTodoMutation.mutate({ id, isCompleted });
  };

  const handleMarkInsightRead = (id: string) => {
    markInsightReadMutation.mutate(id);
  };

  const renderBreadcrumb = () => {
    const viewLabels = {
      notes: "Notes",
      people: "People",
      graph: "Knowledge Graph",
      insights: "AI Insights",
      todos: "To-Dos",
    };

    return (
      <nav className="flex items-center space-x-2 text-sm">
        <span className="text-muted-foreground">{viewLabels[currentView]}</span>
        {currentView === "notes" && currentNote && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground font-medium">{currentNote.title || "Untitled"}</span>
          </>
        )}
      </nav>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case "notes":
        if (!selectedNoteId) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <StickyNote className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No note selected</h2>
                <p className="text-muted-foreground mb-6">
                  Select a note from the sidebar or create a new one to get started.
                </p>
                <Button onClick={handleCreateNote} disabled={createNoteMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Note
                </Button>
              </div>
            </div>
          );
        }

        if (noteLoading) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <div className="spinner" />
            </div>
          );
        }

        return (
          <div className="flex-1 p-6 overflow-y-auto">
            {isDrawingMode ? (
              <DrawingCanvas
                onSave={(drawing) => {
                  // Handle drawing save
                  setIsDrawingMode(false);
                }}
                onCancel={() => setIsDrawingMode(false)}
              />
            ) : (
              <RichTextEditor
                note={currentNote}
                onUpdate={handleNoteUpdate}
                people={people}
              />
            )}
          </div>
        );

      case "people":
        return (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-bold">People</h1>
              <Button onClick={() => setIsPersonDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Person
              </Button>
            </div>
            
            {people.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No people yet</h2>
                <p className="text-muted-foreground mb-6">
                  Add people to your knowledge base to start building connections.
                </p>
                <Button onClick={() => setIsPersonDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Person
                </Button>
              </div>
            ) : (
              <div className="connections-grid">
                {people.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            )}
          </div>
        );

      case "graph":
        return (
          <div className="flex-1">
            <KnowledgeGraph />
          </div>
        );

      case "insights":
        return (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-bold">AI Insights</h1>
              <Button 
                onClick={() => generateInsightsMutation.mutate()}
                disabled={generateInsightsMutation.isPending}
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Generate New Insights
              </Button>
            </div>

            {insights.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No insights yet</h2>
                <p className="text-muted-foreground mb-6">
                  AI will analyze your notes and connections to generate insights.
                </p>
                <Button 
                  onClick={() => generateInsightsMutation.mutate()}
                  disabled={generateInsightsMutation.isPending}
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Generate First Insights
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {insights.map((insight) => (
                  <div 
                    key={insight.id} 
                    className={`p-4 border rounded-lg ${
                      insight.type === "pattern" 
                        ? "bg-accent/5 border-accent/20" 
                        : insight.type === "suggestion"
                        ? "bg-blue-50 border-blue-200"
                        : "bg-purple-50 border-purple-200"
                    } ${!insight.isRead ? "ring-2 ring-primary/20" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={insight.isRead ? "secondary" : "default"}>
                            {insight.type}
                          </Badge>
                          {!insight.isRead && (
                            <Badge variant="outline" className="text-primary border-primary">
                              New
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold mb-2">{insight.title}</h3>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                      </div>
                      {!insight.isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleMarkInsightRead(insight.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "todos":
        return (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">To-Dos</h1>
              <p className="text-muted-foreground">AI-extracted action items from your notes</p>
            </div>

            {todos.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No todos yet</h2>
                <p className="text-muted-foreground mb-6">
                  AI will automatically extract action items as you take notes.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {todos.map((todo) => (
                  <div 
                    key={todo.id} 
                    className={`p-4 border rounded-lg ${
                      todo.isCompleted ? "bg-muted/50" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={todo.isCompleted}
                        onChange={(e) => handleToggleTodo(todo.id, e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                      />
                      <div className="flex-1">
                        <h3 className={`font-medium ${todo.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {todo.title}
                        </h3>
                        {todo.description && (
                          <p className={`text-sm mt-1 ${todo.isCompleted ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>
                            {todo.description}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          Created {new Date(todo.createdAt).toLocaleDateString()}
                          {todo.completedAt && (
                            <span> • Completed {new Date(todo.completedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Navigation Bar */}
      <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          {renderBreadcrumb()}
        </div>

        <div className="flex items-center space-x-3">
          {currentView === "notes" && selectedNoteId && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={isDrawingMode ? "bg-primary text-primary-foreground" : ""}
              >
                <Pencil className="h-4 w-4 mr-2" />
                {isDrawingMode ? "Exit Draw" : "Draw"}
              </Button>
              
              <Button variant="default" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
            </>
          )}

          {currentView === "notes" && !selectedNoteId && (
            <Button 
              onClick={handleCreateNote} 
              disabled={createNoteMutation.isPending}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          )}
        </div>
      </div>

      {renderContent()}

      <PersonDialog
        isOpen={isPersonDialogOpen}
        onOpenChange={setIsPersonDialogOpen}
      />
    </div>
  );
}

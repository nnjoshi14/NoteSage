import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Search, 
  StickyNote, 
  Users, 
  Network, 
  Lightbulb, 
  CheckSquare,
  Settings,
  Menu,
  X,
  Zap
} from "lucide-react";
import type { Note, Stats, Todo, Insight, User } from "@shared/schema";
import { AISettingsDialog } from "@/components/settings/AISettingsDialog";

interface SidebarProps {
  currentView: "notes" | "people" | "graph" | "insights" | "todos";
  onViewChange: (view: "notes" | "people" | "graph" | "insights" | "todos") => void;
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ 
  currentView, 
  onViewChange, 
  selectedNoteId, 
  onSelectNote,
  isOpen,
  onToggle 
}: SidebarProps) {
  const { user } = useAuth() as { user: User | null };
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [location, navigate] = useLocation();

  const { data: recentNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes/recent", { limit: "5" }],
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: searchResults } = useQuery({
    queryKey: ["/api/search", { q: searchQuery }],
    enabled: searchQuery.length > 0,
  });

  const { data: todos = [] } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
  });

  const { data: insights = [] } = useQuery<Insight[]>({
    queryKey: ["/api/insights"],
  });

  const { data: activeAIConfig } = useQuery({
    queryKey: ["/api/ai-configs/active"],
  });

  const pendingTodos = todos.filter(todo => !todo.isCompleted);
  const unreadInsights = insights.filter(insight => !insight.isRead);

  const handleNavigation = (view: "notes" | "people" | "graph" | "insights" | "todos") => {
    onViewChange(view);
    if (view === "notes") {
      navigate("/");
    } else {
      navigate(`/${view}`);
    }
  };

  const handleNoteSelect = (noteId: string) => {
    onSelectNote(noteId);
    navigate(`/notes/${noteId}`);
  };

  if (!isOpen) {
    return (
      <div className="w-0 lg:w-80 relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 z-10 lg:hidden"
          onClick={onToggle}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">KnowledgeBase Pro</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search everything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Search Results */}
        {searchQuery && searchResults && (
          <div className="mt-2 bg-popover border border-border rounded-lg p-2 max-h-60 overflow-y-auto">
            {searchResults.notes?.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Notes</h4>
                {searchResults.notes.map((note: Note) => (
                  <button
                    key={note.id}
                    onClick={() => handleNoteSelect(note.id)}
                    className="w-full text-left p-2 hover:bg-accent rounded text-sm"
                  >
                    {note.title}
                  </button>
                ))}
              </div>
            )}
            {searchResults.people?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">People</h4>
                {searchResults.people.map((person: any) => (
                  <button
                    key={person.id}
                    onClick={() => handleNavigation("people")}
                    className="w-full text-left p-2 hover:bg-accent rounded text-sm"
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="space-y-1">
          <button
            onClick={() => handleNavigation("notes")}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              currentView === "notes" 
                ? "bg-primary/10 text-primary font-medium" 
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            <StickyNote className="h-4 w-4" />
            <span>Notes</span>
            {stats?.totalNotes && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {stats.totalNotes}
              </Badge>
            )}
          </button>
          
          <button
            onClick={() => handleNavigation("people")}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              currentView === "people" 
                ? "bg-primary/10 text-primary font-medium" 
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>People</span>
            {stats?.totalPeople && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {stats.totalPeople}
              </Badge>
            )}
          </button>
          
          <button
            onClick={() => handleNavigation("graph")}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              currentView === "graph" 
                ? "bg-primary/10 text-primary font-medium" 
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            <Network className="h-4 w-4" />
            <span>Knowledge Graph</span>
          </button>
          
          <button
            onClick={() => handleNavigation("insights")}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              currentView === "insights" 
                ? "bg-primary/10 text-primary font-medium" 
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            <span>AI Insights</span>
            {unreadInsights.length > 0 && (
              <Badge className="ml-auto text-xs bg-accent text-accent-foreground">
                {unreadInsights.length} new
              </Badge>
            )}
          </button>
          
          <button
            onClick={() => handleNavigation("todos")}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              currentView === "todos" 
                ? "bg-primary/10 text-primary font-medium" 
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>To-Dos</span>
            {pendingTodos.length > 0 && (
              <Badge variant="outline" className="ml-auto text-xs border-orange-500 text-orange-700">
                {pendingTodos.length}
              </Badge>
            )}
          </button>
        </div>

        {/* Recent Notes */}
        {currentView === "notes" && recentNotes.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Notes
              </h3>
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => handleNoteSelect(note.id)}
                    className={`block w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm transition-colors ${
                      selectedNoteId === note.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="font-medium text-foreground truncate">
                      {note.title || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt="Profile"
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-medium">
                {user?.firstName?.[0] || user?.email?.[0] || "U"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "User"
              }
            </div>
            <div className="text-xs text-muted-foreground">
              Enterprise User
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiSettingsOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              title="AI Settings"
            >
              <Zap className={`h-4 w-4 ${activeAIConfig ? 'text-green-600' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = "/api/logout"}
              className="text-muted-foreground hover:text-foreground"
              title="Logout"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* AI Status Indicator */}
        {activeAIConfig ? (
          <div className="mt-2 px-2 py-1 bg-green-100 dark:bg-green-900 rounded text-xs text-green-800 dark:text-green-100">
            AI: {activeAIConfig.provider.toUpperCase()} Active
          </div>
        ) : (
          <div className="mt-2 px-2 py-1 bg-orange-100 dark:bg-orange-900 rounded text-xs text-orange-800 dark:text-orange-100">
            AI Features Disabled
          </div>
        )}
      </div>

      <AISettingsDialog
        open={aiSettingsOpen}
        onOpenChange={setAiSettingsOpen}
      />
    </div>
  );
}

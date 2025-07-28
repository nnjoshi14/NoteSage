import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/Sidebar";
import MainEditor from "@/components/layout/MainEditor";
import RightSidebar from "@/components/layout/RightSidebar";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [currentView, setCurrentView] = useState<"notes" | "people" | "graph" | "insights" | "todos">("notes");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Handle authentication
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  // Handle route changes
  useEffect(() => {
    if (location.startsWith("/notes")) {
      setCurrentView("notes");
      const noteId = location.split("/")[2];
      if (noteId) {
        setSelectedNoteId(noteId);
      }
    } else if (location === "/people") {
      setCurrentView("people");
    } else if (location === "/graph") {
      setCurrentView("graph");
    } else if (location === "/insights") {
      setCurrentView("insights");
    } else if (location === "/todos") {
      setCurrentView("todos");
    } else {
      setCurrentView("notes");
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0'} lg:w-80`}>
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <MainEditor
          currentView={currentView}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
      </div>

      {/* Right Sidebar - Only show for notes view */}
      {currentView === "notes" && selectedNoteId && (
        <div className="w-80 border-l border-border bg-card">
          <RightSidebar noteId={selectedNoteId} />
        </div>
      )}
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import PersonDialog from "@/components/people/PersonDialog";
import { 
  Users, 
  Link, 
  Lightbulb, 
  Network, 
  Plus,
  Expand,
  ChartLine,
  MessageSquare
} from "lucide-react";
import { useState } from "react";
import type { Person, Note, NoteConnection, Insight } from "@shared/schema";

interface RightSidebarProps {
  noteId: string;
}

export default function RightSidebar({ noteId }: RightSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);

  const { data: connections = [] } = useQuery<Array<NoteConnection & { person: Person }>>({
    queryKey: ["/api/notes", noteId, "connections"],
  });

  const { data: relatedNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
    select: (notes: Note[]) => notes.filter(note => note.id !== noteId).slice(0, 5),
  });

  const { data: insights = [] } = useQuery<Insight[]>({
    queryKey: ["/api/insights"],
    select: (insights: Insight[]) => insights.filter(insight => !insight.isRead).slice(0, 3),
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  const disconnectPersonMutation = useMutation({
    mutationFn: async (personId: string) => {
      return apiRequest("DELETE", `/api/notes/${noteId}/connections/${personId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", noteId, "connections"] });
      toast({
        title: "Person disconnected",
        description: "The person has been disconnected from this note.",
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
        description: "Failed to disconnect person. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {/* Connected People */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center">
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            Connected People
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPersonDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {connections.length === 0 ? (
          <div className="text-center py-6">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No people connected to this note yet
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPersonDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect Person
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer group"
              >
                {connection.person.avatarUrl ? (
                  <img
                    src={connection.person.avatarUrl}
                    alt={connection.person.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-medium">
                      {connection.person.name[0]}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {connection.person.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {connection.person.title || connection.person.company || "No title"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectPersonMutation.mutate(connection.personId)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Related Notes */}
      <div>
        <h3 className="font-semibold text-foreground mb-4 flex items-center">
          <Link className="h-4 w-4 mr-2 text-muted-foreground" />
          Related Notes
        </h3>

        {relatedNotes.length === 0 ? (
          <div className="text-center py-6">
            <Link className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No related notes found
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {relatedNotes.map((note) => (
              <div
                key={note.id}
                className="block p-3 rounded-lg hover:bg-accent text-sm cursor-pointer"
              >
                <div className="font-medium text-foreground truncate">
                  {note.title || "Untitled"}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {note.content ? 
                    note.content.substring(0, 100) + "..." : 
                    "No content"
                  }
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* AI Insights */}
      <div>
        <h3 className="font-semibold text-foreground mb-4 flex items-center">
          <Lightbulb className="h-4 w-4 mr-2 text-accent" />
          AI Insights
        </h3>

        {insights.length === 0 ? (
          <div className="text-center py-6">
            <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No new insights available
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border ${
                  insight.type === "pattern" 
                    ? "bg-accent/5 border-accent/20" 
                    : insight.type === "suggestion"
                    ? "bg-blue-50 border-blue-200"
                    : "bg-purple-50 border-purple-200"
                }`}
              >
                <div className="flex items-start space-x-3">
                  {insight.type === "pattern" ? (
                    <ChartLine className="h-4 w-4 text-accent mt-1 flex-shrink-0" />
                  ) : insight.type === "suggestion" ? (
                    <Lightbulb className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground mb-1">
                      {insight.title}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {insight.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Knowledge Graph Preview */}
      <div>
        <h3 className="font-semibold text-foreground mb-4 flex items-center">
          <Network className="h-4 w-4 mr-2 text-muted-foreground" />
          Knowledge Graph
        </h3>
        
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="relative h-32 flex items-center justify-center">
            {/* Simplified graph visualization */}
            <div className="absolute w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-medium">
              N
            </div>
            
            {connections.length > 0 && (
              <>
                <div className="absolute top-2 left-8 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs">
                  P
                </div>
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line x1="50%" y1="50%" x2="25%" y2="25%" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.6" />
                </svg>
              </>
            )}

            {relatedNotes.length > 0 && (
              <>
                <div className="absolute bottom-2 right-8 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs">
                  R
                </div>
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line x1="50%" y1="50%" x2="75%" y2="75%" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.6" />
                </svg>
              </>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
        >
          <Expand className="h-4 w-4 mr-2" />
          View Full Graph
        </Button>
      </div>

      <PersonDialog
        isOpen={isPersonDialogOpen}
        onOpenChange={setIsPersonDialogOpen}
        noteId={noteId}
      />
    </div>
  );
}

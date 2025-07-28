import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest } from '@/lib/queryClient';
import PersonDialog from './PersonDialog';
import { 
  Mail, 
  Phone, 
  Building, 
  Linkedin, 
  FileText,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';
import type { Person } from '@shared/schema';

interface PersonCardProps {
  person: Person;
}

export default function PersonCard({ person }: PersonCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch connections for this person
  const { data: connections = [] } = useQuery({
    queryKey: ["/api/people", person.id, "connections"],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/people/${person.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Person deleted",
        description: "The person has been removed from your knowledge base.",
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
        description: "Failed to delete person. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${person.name}? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              {person.avatarUrl ? (
                <img
                  src={person.avatarUrl}
                  alt={person.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-lg">
                    {person.name[0]}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-foreground">{person.name}</h3>
                {person.title && (
                  <p className="text-sm text-muted-foreground">{person.title}</p>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-2 mb-4">
            {person.email && (
              <div className="flex items-center space-x-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={`mailto:${person.email}`}
                  className="text-primary hover:underline truncate"
                >
                  {person.email}
                </a>
              </div>
            )}
            
            {person.phone && (
              <div className="flex items-center space-x-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={`tel:${person.phone}`}
                  className="text-primary hover:underline"
                >
                  {person.phone}
                </a>
              </div>
            )}
            
            {person.company && (
              <div className="flex items-center space-x-2 text-sm">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{person.company}</span>
              </div>
            )}
            
            {person.linkedinUrl && (
              <div className="flex items-center space-x-2 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={person.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center space-x-1"
                >
                  <span>LinkedIn Profile</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Personal Notes */}
          {person.notes && (
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Notes</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {person.notes}
              </p>
            </div>
          )}

          {/* Connection Count */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              {connections.length} note{connections.length !== 1 ? 's' : ''}
            </Badge>
            
            <span className="text-xs text-muted-foreground">
              Added {new Date(person.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Connected Notes Preview */}
          {connections.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Recent Connections
              </p>
              <div className="space-y-1">
                {connections.slice(0, 3).map((connection: any) => (
                  <div key={connection.id} className="text-xs text-muted-foreground truncate">
                    → {connection.note?.title || 'Untitled Note'}
                  </div>
                ))}
                {connections.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{connections.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PersonDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        person={person}
      />
    </>
  );
}

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest } from '@/lib/queryClient';
import { insertPersonSchema } from '@shared/schema';
import type { Person } from '@shared/schema';

interface PersonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
  noteId?: string; // If provided, will connect the person to this note
}

const formSchema = insertPersonSchema.extend({
  connectToNote: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function PersonDialog({ 
  isOpen, 
  onOpenChange, 
  person, 
  noteId 
}: PersonDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      linkedinUrl: '',
      notes: '',
      connectToNote: !!noteId,
    },
  });

  // Reset form when person or dialog state changes
  useEffect(() => {
    if (person) {
      form.reset({
        name: person.name,
        email: person.email || '',
        phone: person.phone || '',
        company: person.company || '',
        title: person.title || '',
        linkedinUrl: person.linkedinUrl || '',
        notes: person.notes || '',
        connectToNote: false,
      });
    } else {
      form.reset({
        name: '',
        email: '',
        phone: '',
        company: '',
        title: '',
        linkedinUrl: '',
        notes: '',
        connectToNote: !!noteId,
      });
    }
  }, [person, noteId, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { connectToNote, ...personData } = data;
      return apiRequest("POST", "/api/people", personData);
    },
    onSuccess: async (response, variables) => {
      const newPerson = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Connect to note if requested
      if (variables.connectToNote && noteId) {
        try {
          await apiRequest("POST", `/api/notes/${noteId}/connections/${newPerson.id}`, {
            connectionType: "mentioned"
          });
          queryClient.invalidateQueries({ queryKey: ["/api/notes", noteId, "connections"] });
        } catch (error) {
          console.error("Failed to connect person to note:", error);
        }
      }
      
      toast({
        title: "Person created",
        description: `${newPerson.name} has been added to your knowledge base.`,
      });
      onOpenChange(false);
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
        description: "Failed to create person. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!person) throw new Error("No person to update");
      const { connectToNote, ...personData } = data;
      return apiRequest("PUT", `/api/people/${person.id}`, personData);
    },
    onSuccess: async (response) => {
      const updatedPerson = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people", person?.id] });
      
      toast({
        title: "Person updated",
        description: `${updatedPerson.name} has been updated.`,
      });
      onOpenChange(false);
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
        description: "Failed to update person. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      if (person) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
      if (!open) {
        form.reset();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {person ? "Edit Person" : "Add Person"}
          </DialogTitle>
          <DialogDescription>
            {person 
              ? "Update the person's information in your knowledge base."
              : "Add a new person to your knowledge base for better connection tracking."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="email@example.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="+1 (555) 123-4567" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company and Title */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Job title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* LinkedIn URL */}
            <FormField
              control={form.control}
              name="linkedinUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://linkedin.com/in/username" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Personal Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any personal notes, interests, or context about this person..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Connect to current note option */}
            {noteId && !person && (
              <FormField
                control={form.control}
                name="connectToNote"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Connect to current note
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Automatically create a connection between this person and the current note.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="spinner" />
                    <span>{person ? "Updating..." : "Creating..."}</span>
                  </div>
                ) : (
                  person ? "Update Person" : "Create Person"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

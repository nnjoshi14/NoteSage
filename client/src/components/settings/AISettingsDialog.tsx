import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Check, Settings, Plus, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface AIConfig {
  id: string;
  provider: "openai" | "gemini" | "grok";
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const aiConfigSchema = z.object({
  provider: z.enum(["openai", "gemini", "grok"]),
  apiKey: z.string().min(1, "API key is required"),
  isActive: z.boolean().default(false),
});

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const providerInfo = {
  openai: {
    name: "OpenAI",
    description: "GPT-4o for advanced text processing and analysis",
    website: "https://platform.openai.com/api-keys",
  },
  gemini: {
    name: "Google Gemini",
    description: "Multimodal AI with vision and reasoning capabilities",
    website: "https://aistudio.google.com/app/apikey",
  },
  grok: {
    name: "xAI Grok",
    description: "Real-time AI with access to X platform data",
    website: "https://console.x.ai/",
  },
};

export function AISettingsDialog({ open, onOpenChange }: AISettingsDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof aiConfigSchema>>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      provider: "openai",
      apiKey: "",
      isActive: false,
    },
  });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["/api/ai-configs"],
    enabled: open,
  });

  const { data: activeConfig } = useQuery({
    queryKey: ["/api/ai-configs/active"],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof aiConfigSchema>) => {
      return await apiRequest("/api/ai-configs", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "AI configuration created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-configs/active"] });
      setIsCreating(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create AI configuration",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/ai-configs/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "AI configuration deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-configs/active"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete AI configuration",
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/ai-configs/${id}/activate`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "AI configuration activated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-configs/active"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate AI configuration",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof aiConfigSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI Provider Settings
          </DialogTitle>
          <DialogDescription>
            Configure your AI providers for smart features like todo extraction, insights generation, and relationship analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Active Provider */}
          {activeConfig && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-blue-600" />
                  Active Provider
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{providerInfo[activeConfig.provider as keyof typeof providerInfo].name}</p>
                    <p className="text-sm text-muted-foreground">
                      {providerInfo[activeConfig.provider as keyof typeof providerInfo].description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Configurations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Your AI Configurations</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(true)}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : configs.length === 0 && !isCreating ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Settings className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-center">
                    No AI providers configured yet.
                    <br />
                    Add one to enable smart features.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {configs.map((config: AIConfig) => (
                  <Card key={config.id} className={config.isActive ? "ring-2 ring-blue-500" : ""}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {providerInfo[config.provider].name}
                            </p>
                            {config.isActive && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            API Key: {config.apiKey}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!config.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => activateMutation.mutate(config.id)}
                            disabled={activateMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(config.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Add New Configuration Form */}
          {isCreating && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add AI Provider</CardTitle>
                <CardDescription>
                  Configure a new AI provider to enable smart features in your knowledge base.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AI Provider</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an AI provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="openai">
                                <div className="flex flex-col">
                                  <span>OpenAI</span>
                                  <span className="text-xs text-muted-foreground">
                                    GPT-4o for text processing
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gemini">
                                <div className="flex flex-col">
                                  <span>Google Gemini</span>
                                  <span className="text-xs text-muted-foreground">
                                    Multimodal AI with vision
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value="grok">
                                <div className="flex flex-col">
                                  <span>xAI Grok</span>
                                  <span className="text-xs text-muted-foreground">
                                    Real-time AI with X data
                                  </span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your API key"
                              {...field}
                            />
                          </FormControl>
                          <div className="text-sm text-muted-foreground">
                            Get your API key from{" "}
                            <a
                              href={providerInfo[form.watch("provider") as keyof typeof providerInfo]?.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {providerInfo[form.watch("provider") as keyof typeof providerInfo]?.name}'s website
                            </a>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="rounded"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">
                            Set as active provider
                          </FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreating(false);
                          form.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Testing & Saving..." : "Save Configuration"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* AI Features Info */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm">AI-Powered Features</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• <strong>Todo Extraction:</strong> Automatically find action items in your notes</p>
              <p>• <strong>Insights Generation:</strong> Discover patterns and connections in your knowledge base</p>
              <p>• <strong>Relationship Analysis:</strong> Smart linking between people and content</p>
              <p>• <strong>Content Summarization:</strong> Quick summaries of your notes</p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Users, Network, Lightbulb } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">KnowledgeBase Pro</h1>
        </div>
        
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          Enterprise knowledge management with comprehensive backlinking, people database, and AI-powered relationship analysis
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">People Database</h3>
              <p className="text-sm text-muted-foreground">
                Comprehensive contact management with bidirectional linking to notes
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-accent/20 hover:border-accent/40 transition-colors">
            <CardContent className="p-6 text-center">
              <Network className="h-8 w-8 text-accent mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Knowledge Graph</h3>
              <p className="text-sm text-muted-foreground">
                Visualize relationships and connections between all your content
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 hover:border-orange-300 transition-colors">
            <CardContent className="p-6 text-center">
              <Lightbulb className="h-8 w-8 text-orange-600 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">AI Insights</h3>
              <p className="text-sm text-muted-foreground">
                Automatic todo extraction and intelligent relationship analysis
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Button 
            size="lg" 
            className="text-lg px-8 py-3 h-auto"
            onClick={() => window.location.href = "/api/login"}
          >
            Get Started
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Optimized for iPad and Apple Pencil • Enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Maximize2, 
  Minimize2,
  Filter,
  RefreshCw
} from 'lucide-react';
import type { Note, Person, NoteConnection } from '@shared/schema';

interface GraphNode {
  id: string;
  type: 'note' | 'person';
  label: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  connections: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'note-person' | 'note-note';
}

export default function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [nodeFilter, setNodeFilter] = useState<'all' | 'notes' | 'people'>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Fetch data
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  const { data: allConnections = [] } = useQuery<Array<{ noteId: string; personId: string }>>({
    queryKey: ["/api/connections"],
    queryFn: async () => {
      // Aggregate connections from all notes
      const connections: Array<{ noteId: string; personId: string }> = [];
      
      for (const note of notes) {
        try {
          const response = await fetch(`/api/notes/${note.id}/connections`);
          if (response.ok) {
            const noteConnections = await response.json();
            connections.push(...noteConnections.map((conn: any) => ({
              noteId: note.id,
              personId: conn.personId
            })));
          }
        } catch (error) {
          console.error(`Error fetching connections for note ${note.id}:`, error);
        }
      }
      
      return connections;
    },
    enabled: notes.length > 0,
  });

  // Create graph data
  const graphData = {
    nodes: [
      ...notes.map(note => ({
        id: note.id,
        type: 'note' as const,
        label: note.title || 'Untitled',
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        connections: allConnections.filter(conn => conn.noteId === note.id).length,
      })),
      ...people.map(person => ({
        id: person.id,
        type: 'person' as const,
        label: person.name,
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        connections: allConnections.filter(conn => conn.personId === person.id).length,
      })),
    ].filter(node => {
      if (nodeFilter === 'notes') return node.type === 'note';
      if (nodeFilter === 'people') return node.type === 'person';
      return true;
    }).filter(node => 
      searchQuery === '' || 
      node.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    links: allConnections.map(conn => ({
      source: conn.noteId,
      target: conn.personId,
      type: 'note-person' as const,
    })),
  };

  // Simple force simulation
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });

    // Simple physics simulation
    const nodes = [...graphData.nodes];
    const links = graphData.links;

    const simulation = () => {
      // Apply forces
      nodes.forEach((node, i) => {
        if (!node.vx) node.vx = 0;
        if (!node.vy) node.vy = 0;

        // Repulsion from other nodes
        nodes.forEach((other, j) => {
          if (i === j) return;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (distance * distance);
          node.vx! -= (dx / distance) * force;
          node.vy! -= (dy / distance) * force;
        });

        // Attraction from links
        links.forEach(link => {
          let target: GraphNode | undefined;
          if (link.source === node.id) {
            target = nodes.find(n => n.id === link.target);
          } else if (link.target === node.id) {
            target = nodes.find(n => n.id === link.source);
          }

          if (target) {
            const dx = target.x - node.x;
            const dy = target.y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = distance * 0.1;
            node.vx! += (dx / distance) * force;
            node.vy! += (dy / distance) * force;
          }
        });

        // Center force
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        node.vx! += (centerX - node.x) * 0.01;
        node.vy! += (centerY - node.y) * 0.01;

        // Apply velocity with damping
        node.vx! *= 0.8;
        node.vy! *= 0.8;
        
        if (!node.fx && !node.fy) {
          node.x += node.vx!;
          node.y += node.vy!;

          // Keep in bounds
          node.x = Math.max(30, Math.min(dimensions.width - 30, node.x));
          node.y = Math.max(30, Math.min(dimensions.height - 30, node.y));
        }
      });

      // Re-render
      renderGraph();
    };

    const interval = setInterval(simulation, 50);
    return () => clearInterval(interval);
  }, [graphData, dimensions]);

  const renderGraph = () => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear previous content
    svg.innerHTML = '';

    // Create defs for markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', 'hsl(var(--muted-foreground))');
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Render links
    graphData.links.forEach(link => {
      const sourceNode = graphData.nodes.find(n => n.id === link.source);
      const targetNode = graphData.nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', sourceNode.x.toString());
        line.setAttribute('y1', sourceNode.y.toString());
        line.setAttribute('x2', targetNode.x.toString());
        line.setAttribute('y2', targetNode.y.toString());
        line.setAttribute('stroke', 'hsl(var(--muted-foreground))');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('opacity', '0.6');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        svg.appendChild(line);
      }
    });

    // Render nodes
    graphData.nodes.forEach(node => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('transform', `translate(${node.x}, ${node.y})`);
      group.setAttribute('class', 'graph-node cursor-pointer');
      
      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', Math.max(8, Math.min(20, 8 + node.connections * 2)).toString());
      circle.setAttribute('fill', node.type === 'note' ? 'hsl(var(--primary))' : 'hsl(var(--accent))');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      
      // Node label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('dy', '25');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', 'hsl(var(--foreground))');
      text.textContent = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label;
      
      group.appendChild(circle);
      group.appendChild(text);
      
      // Add click handler
      group.addEventListener('click', () => {
        setSelectedNode(node);
      });
      
      // Add drag handlers
      let isDragging = false;
      group.addEventListener('mousedown', () => {
        isDragging = true;
        node.fx = node.x;
        node.fy = node.y;
      });
      
      svg.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const rect = svg.getBoundingClientRect();
          node.fx = e.clientX - rect.left;
          node.fy = e.clientY - rect.top;
          node.x = node.fx;
          node.y = node.fy;
        }
      });
      
      svg.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          node.fx = null;
          node.fy = null;
        }
      });
      
      svg.appendChild(group);
    });
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'} flex flex-col`}>
      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold">Knowledge Graph</h2>
          <Badge variant="outline">
            {graphData.nodes.length} nodes, {graphData.links.length} connections
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-48"
            />
          </div>
          
          {/* Filter */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter className="h-4 w-4" />
          </Button>
          
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          {/* Fullscreen */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Show:</span>
            <div className="flex space-x-2">
              <Button
                variant={nodeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNodeFilter('all')}
              >
                All
              </Button>
              <Button
                variant={nodeFilter === 'notes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNodeFilter('notes')}
              >
                Notes Only
              </Button>
              <Button
                variant={nodeFilter === 'people' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNodeFilter('people')}
              >
                People Only
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Graph */}
      <div className="flex-1 relative overflow-hidden">
        {graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 opacity-20">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="20" cy="20" r="8" fill="hsl(var(--primary))" />
                  <circle cx="80" cy="20" r="8" fill="hsl(var(--accent))" />
                  <circle cx="50" cy="80" r="8" fill="hsl(var(--primary))" />
                  <line x1="20" y1="20" x2="80" y2="20" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
                  <line x1="20" y1="20" x2="50" y2="80" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
                  <line x1="80" y1="20" x2="50" y2="80" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No Connections Yet</h3>
              <p className="text-muted-foreground max-w-md">
                Start creating notes and connecting them to people to see your knowledge graph come to life.
              </p>
            </div>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="w-full h-full knowledge-graph"
            style={{ background: 'hsl(var(--background))' }}
          />
        )}
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 bg-card border border-border rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={selectedNode.type === 'note' ? 'default' : 'secondary'}>
              {selectedNode.type}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNode(null)}
            >
              ×
            </Button>
          </div>
          <h3 className="font-semibold text-foreground">{selectedNode.label}</h3>
          <p className="text-sm text-muted-foreground">
            {selectedNode.connections} connection{selectedNode.connections !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-20 right-4 bg-card border border-border rounded-lg p-3 shadow-lg">
        <h4 className="font-medium text-foreground mb-2">Legend</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span>Notes</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-accent"></div>
            <span>People</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-px bg-muted-foreground"></div>
            <span>Connections</span>
          </div>
        </div>
      </div>
    </div>
  );
}

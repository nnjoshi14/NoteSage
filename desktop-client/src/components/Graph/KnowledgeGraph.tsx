import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useSelector } from 'react-redux';
import { RootState } from '../../stores/store';
import { Note } from '../../stores/slices/notesSlice';
import { Person } from '../../stores/slices/peopleSlice';
import './KnowledgeGraph.css';

export interface GraphNode {
  id: string;
  type: 'note' | 'person';
  title: string;
  data: Note | Person;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'mention' | 'reference';
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface KnowledgeGraphProps {
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  className?: string;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  onNodeClick,
  onNodeDoubleClick,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutType, setLayoutType] = useState<'force' | 'circular' | 'hierarchical'>('force');
  const [filterType, setFilterType] = useState<'all' | 'notes' | 'people'>('all');
  
  const notes = useSelector((state: RootState) => state.notes.notes);
  const people = useSelector((state: RootState) => state.people.people);

  // Extract connections from note content
  const extractConnections = useCallback((notes: Note[], people: Person[]): GraphData => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Create person nodes
    people.forEach(person => {
      const node: GraphNode = {
        id: `person-${person.id}`,
        type: 'person',
        title: person.name,
        data: person,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // Create note nodes and extract connections
    notes.forEach(note => {
      if (note.is_archived) return; // Skip archived notes

      const noteNode: GraphNode = {
        id: `note-${note.id}`,
        type: 'note',
        title: note.title,
        data: note,
      };
      nodes.push(noteNode);
      nodeMap.set(noteNode.id, noteNode);

      // Extract @mentions (people references)
      const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
      let match;
      while ((match = mentionRegex.exec(note.content)) !== null) {
        const mentionedName = match[1].toLowerCase();
        const mentionedPerson = people.find(p => 
          p.name.toLowerCase().includes(mentionedName) ||
          mentionedName.includes(p.name.toLowerCase())
        );
        
        if (mentionedPerson) {
          const personNodeId = `person-${mentionedPerson.id}`;
          if (nodeMap.has(personNodeId)) {
            links.push({
              source: noteNode.id,
              target: personNodeId,
              type: 'mention',
              strength: 1,
            });
          }
        }
      }

      // Extract #references (note references)
      const referenceRegex = /#\[\[([^\]]+)\]\]/g;
      while ((match = referenceRegex.exec(note.content)) !== null) {
        const referencedTitle = match[1].toLowerCase();
        const referencedNote = notes.find(n => 
          n.title.toLowerCase().includes(referencedTitle) ||
          referencedTitle.includes(n.title.toLowerCase())
        );
        
        if (referencedNote && referencedNote.id !== note.id) {
          const referencedNodeId = `note-${referencedNote.id}`;
          if (nodeMap.has(referencedNodeId)) {
            links.push({
              source: noteNode.id,
              target: referencedNodeId,
              type: 'reference',
              strength: 0.8,
            });
          }
        }
      }
    });

    return { nodes, links };
  }, []);

  // Filter graph data based on search and filters
  const filterGraphData = useCallback((data: GraphData): GraphData => {
    let filteredNodes = data.nodes;
    
    // Apply type filter
    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter(node => 
        filterType === 'notes' ? node.type === 'note' : node.type === 'person'
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter(node =>
        node.title.toLowerCase().includes(query)
      );
    }

    // Filter links to only include connections between remaining nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = data.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [searchQuery, filterType]);

  // Create and update the D3 visualization
  const createVisualization = useCallback((data: GraphData) => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous content
    svg.selectAll('*').remove();

    // Set up SVG dimensions
    svg.attr('width', width).attr('height', height);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create main group for zoomable content
    const g = svg.append('g');

    // Create simulation based on layout type
    let simulation: d3.Simulation<GraphNode, GraphLink>;
    
    if (layoutType === 'force') {
      simulation = d3.forceSimulation<GraphNode>(data.nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(data.links)
          .id(d => d.id)
          .distance(100)
          .strength(d => d.strength))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    } else if (layoutType === 'circular') {
      const radius = Math.min(width, height) / 3;
      data.nodes.forEach((node, i) => {
        const angle = (i / data.nodes.length) * 2 * Math.PI;
        node.fx = width / 2 + radius * Math.cos(angle);
        node.fy = height / 2 + radius * Math.sin(angle);
      });
      simulation = d3.forceSimulation<GraphNode>(data.nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(data.links)
          .id(d => d.id)
          .distance(50));
    } else { // hierarchical
      simulation = d3.forceSimulation<GraphNode>(data.nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(data.links)
          .id(d => d.id)
          .distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY().strength(0.3).y(d => d.type === 'person' ? height / 4 : 3 * height / 4));
    }

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('class', d => `link link-${d.type}`)
      .attr('stroke-width', d => Math.sqrt(d.strength * 3));

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', d => `node node-${d.type}`)
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          if (layoutType === 'force') {
            d.fx = null;
            d.fy = null;
          }
        }));

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.type === 'person' ? 20 : 15)
      .attr('class', d => selectedNode?.id === d.id ? 'selected' : '');

    // Add labels
    node.append('text')
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title)
      .attr('dy', -25)
      .attr('text-anchor', 'middle')
      .attr('class', 'node-label');

    // Add click handlers
    node
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        onNodeClick?.(d);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        onNodeDoubleClick?.(d);
      });

    // Clear selection when clicking on empty space
    svg.on('click', () => {
      setSelectedNode(null);
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Update selected node styling
    node.select('circle')
      .attr('class', d => selectedNode?.id === d.id ? 'selected' : '');

  }, [layoutType, selectedNode, onNodeClick, onNodeDoubleClick]);

  // Main effect to create/update visualization
  useEffect(() => {
    const rawData = extractConnections(notes, people);
    const filteredData = filterGraphData(rawData);
    createVisualization(filteredData);
  }, [notes, people, extractConnections, filterGraphData, createVisualization]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const rawData = extractConnections(notes, people);
      const filteredData = filterGraphData(rawData);
      createVisualization(filteredData);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [notes, people, extractConnections, filterGraphData, createVisualization]);

  const hasConnections = notes.length > 0 || people.length > 0;

  return (
    <div className={`knowledge-graph ${className}`}>
      <div className="graph-controls">
        <div className="search-controls">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="notes">Notes Only</option>
            <option value="people">People Only</option>
          </select>
        </div>

        <div className="layout-controls">
          <select
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value as typeof layoutType)}
            className="layout-select"
          >
            <option value="force">Force Layout</option>
            <option value="circular">Circular Layout</option>
            <option value="hierarchical">Hierarchical Layout</option>
          </select>
        </div>
      </div>

      <div className="graph-container" ref={containerRef}>
        {hasConnections ? (
          <svg ref={svgRef} className="graph-svg" />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <h3>No Connections Yet</h3>
            <p>
              Create connections by mentioning people with @name or referencing notes with #[[note title]] in your notes.
            </p>
            <div className="empty-state-tips">
              <h4>Tips to build your knowledge graph:</h4>
              <ul>
                <li>Add people to your contacts</li>
                <li>Mention people in notes using @name</li>
                <li>Reference other notes using #[[note title]]</li>
                <li>Create notes about meetings, projects, and ideas</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="node-detail-panel">
          <div className="node-detail-header">
            <h3>{selectedNode.title}</h3>
            <button
              className="close-button"
              onClick={() => setSelectedNode(null)}
            >
              ×
            </button>
          </div>
          <div className="node-detail-content">
            <div className="node-type">
              Type: {selectedNode.type === 'person' ? 'Person' : 'Note'}
            </div>
            {selectedNode.type === 'person' && (
              <div className="person-details">
                <p><strong>Email:</strong> {(selectedNode.data as Person).email || 'N/A'}</p>
                <p><strong>Company:</strong> {(selectedNode.data as Person).company || 'N/A'}</p>
                <p><strong>Title:</strong> {(selectedNode.data as Person).title || 'N/A'}</p>
              </div>
            )}
            {selectedNode.type === 'note' && (
              <div className="note-details">
                <p><strong>Category:</strong> {(selectedNode.data as Note).category}</p>
                <p><strong>Tags:</strong> {(selectedNode.data as Note).tags.join(', ') || 'None'}</p>
                <p><strong>Created:</strong> {new Date((selectedNode.data as Note).created_at).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph;
# Knowledge Graph Component

The Knowledge Graph component provides an interactive D3.js-based visualization of connections between notes and people in the NoteSage application.

## Features

### Core Visualization
- **Interactive D3.js Graph**: Force-directed layout with draggable nodes
- **Node Types**: Distinct styling for notes (blue circles) and people (green circles)
- **Connection Types**: Visual distinction between @mentions (dashed lines) and #[[references]] (solid lines)
- **Zoom and Pan**: Mouse wheel zoom and drag to pan functionality

### Layout Options
- **Force Layout**: Physics-based simulation with attraction/repulsion forces
- **Circular Layout**: Nodes arranged in a circle for clear overview
- **Hierarchical Layout**: People at top, notes at bottom for structured view

### Interactive Features
- **Node Selection**: Click nodes to view details in side panel
- **Node Navigation**: Double-click to navigate to note/person detail page
- **Search**: Real-time filtering of nodes by title
- **Type Filtering**: Show all nodes, notes only, or people only
- **Detail Panel**: Shows metadata for selected nodes

### Connection Detection
- **@Mentions**: Automatically detects `@Person Name` patterns in note content
- **Note References**: Detects `#[[Note Title]]` patterns for note-to-note connections
- **Fuzzy Matching**: Partial name matching for robust connection detection
- **Archived Notes**: Automatically excludes archived notes from visualization

### Empty State
- **Helpful Instructions**: Guides users on how to create connections
- **Tips and Examples**: Shows how to use @mentions and #[[references]]

## Usage

### Basic Usage

```tsx
import { KnowledgeGraph } from './components/Graph';

function MyComponent() {
  const handleNodeClick = (node) => {
    console.log('Node clicked:', node);
  };

  const handleNodeDoubleClick = (node) => {
    // Navigate to node detail page
    if (node.type === 'note') {
      navigate(`/notes/${node.data.id}`);
    } else if (node.type === 'person') {
      navigate(`/people/${node.data.id}`);
    }
  };

  return (
    <KnowledgeGraph
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      className="my-graph"
    />
  );
}
```

### Full Page Usage

```tsx
import { GraphPage } from './components/Graph';

function App() {
  return <GraphPage />;
}
```

## Props

### KnowledgeGraph

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onNodeClick` | `(node: GraphNode) => void` | `undefined` | Callback fired when a node is clicked |
| `onNodeDoubleClick` | `(node: GraphNode) => void` | `undefined` | Callback fired when a node is double-clicked |
| `className` | `string` | `''` | Additional CSS class for the component |

### GraphNode Interface

```tsx
interface GraphNode {
  id: string;
  type: 'note' | 'person';
  title: string;
  data: Note | Person;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}
```

### GraphLink Interface

```tsx
interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'mention' | 'reference';
  strength: number;
}
```

## Data Requirements

The component expects data from Redux store slices:

### Notes Slice
- `notes`: Array of Note objects
- Must include `content` field for connection extraction
- `is_archived` notes are automatically excluded

### People Slice  
- `people`: Array of Person objects
- Used for @mention matching by name

## Connection Patterns

### @Mentions
The component detects people mentions using the pattern:
```
@Person Name
@John Smith
@Sarah
```

### Note References
The component detects note references using the pattern:
```
#[[Note Title]]
#[[Project Planning]]
#[[Meeting Notes]]
```

## Styling

The component uses CSS classes for styling:

- `.knowledge-graph` - Main container
- `.graph-controls` - Control panel
- `.graph-container` - SVG container
- `.node-note` - Note nodes (blue)
- `.node-person` - Person nodes (green)
- `.link-mention` - @mention connections (dashed)
- `.link-reference` - #[[reference]] connections (solid)
- `.empty-state` - Empty state display

## Accessibility

- Keyboard navigation support
- Screen reader friendly labels
- High contrast mode support
- Reduced motion support for animations

## Performance

- Efficient D3.js rendering with minimal re-renders
- Connection extraction cached and memoized
- Responsive design for different screen sizes
- Optimized for datasets up to 1000+ nodes

## Browser Support

- Modern browsers with SVG support
- Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- Requires D3.js v7+ for full functionality

## Demo

See `GraphDemo.tsx` for a complete working example with sample data.
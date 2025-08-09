# Knowledge Graph

The Knowledge Graph provides a visual representation of connections between your notes, people, and ideas, helping you discover patterns and relationships in your knowledge base.

## Overview

The Knowledge Graph shows:
- **Notes** as nodes connected by references and mentions
- **People** as nodes connected to notes where they're mentioned
- **Relationships** as links showing connection strength
- **Clusters** of related content and collaborators
- **Navigation paths** between different concepts

## Understanding the Graph

### Node Types
- **Note Nodes**: Circular nodes representing your notes
  - Size indicates note length or importance
  - Color represents category or recency
  - Label shows note title
- **People Nodes**: Square nodes representing people
  - Size indicates connection frequency
  - Color represents relationship strength
  - Label shows person's name

### Connection Types
- **Note References**: Links created by #note-references
- **People Mentions**: Links created by @person mentions
- **Todo Assignments**: Links between people and notes with assigned todos
- **Shared Topics**: AI-detected thematic connections
- **Temporal Links**: Notes created or modified around the same time

### Visual Indicators
- **Line Thickness**: Stronger connections have thicker lines
- **Line Color**: Different colors for different relationship types
- **Node Highlighting**: Selected nodes and their connections are highlighted
- **Clustering**: Related nodes are positioned closer together

## Navigating the Graph

### Basic Interaction
- **Pan**: Click and drag empty space to move around
- **Zoom**: Use mouse wheel or pinch gestures to zoom in/out
- **Select**: Click on nodes to select and highlight connections
- **Hover**: Hover over nodes to see quick information
- **Double-click**: Double-click nodes to open notes or people profiles

### Graph Controls
- **Zoom Controls**: Plus/minus buttons for precise zooming
- **Fit to Screen**: Button to show entire graph
- **Center on Selection**: Focus on selected nodes
- **Reset Layout**: Reorganize nodes for better visibility
- **Fullscreen**: Expand graph to full window

### Search and Filter
- **Search Bar**: Find specific notes or people in the graph
- **Filter Panel**: Show/hide different node types
- **Date Range**: Filter by creation or modification date
- **Category Filter**: Show only specific note categories
- **Connection Strength**: Filter by relationship intensity

## Graph Layouts

### Force-Directed Layout (Default)
- Nodes repel each other while connections pull them together
- Creates natural clustering of related content
- Automatically adjusts as you add or remove content
- Best for exploring overall structure

### Hierarchical Layout
- Organizes nodes in tree-like structures
- Shows clear parent-child relationships
- Good for project hierarchies and dependencies
- Useful for understanding information flow

### Circular Layout
- Arranges nodes in concentric circles
- Central nodes are most connected
- Peripheral nodes are more specialized
- Helps identify key concepts and outliers

### Grid Layout
- Organizes nodes in a regular grid pattern
- Easier to locate specific items
- Good for systematic browsing
- Less emphasis on relationships

## Customization Options

### Visual Settings
- **Node Size**: Adjust based on connections, content length, or recency
- **Color Schemes**: Choose from predefined themes or create custom colors
- **Label Display**: Show/hide node labels, adjust font size
- **Animation Speed**: Control movement and transition effects
- **Background**: Light, dark, or custom background colors

### Layout Parameters
- **Repulsion Strength**: How strongly nodes push apart
- **Link Distance**: Preferred distance between connected nodes
- **Gravity**: Pull toward center or spread out
- **Clustering**: Strength of grouping similar nodes
- **Stabilization**: Time to settle into final positions

### Filter Options
- **Node Types**: Show/hide notes, people, or both
- **Connection Types**: Display specific relationship types
- **Time Filters**: Focus on recent activity or historical data
- **Content Filters**: Filter by tags, categories, or keywords
- **Strength Thresholds**: Hide weak connections for clarity

## Using the Graph for Discovery

### Finding Related Content
1. Select a note node to see all its connections
2. Follow links to discover related notes and people
3. Look for unexpected connections that reveal new insights
4. Use the "expand neighborhood" feature to explore further

### Identifying Key Concepts
- **Central Nodes**: Highly connected nodes are often key concepts
- **Bridge Nodes**: Nodes connecting different clusters
- **Isolated Nodes**: Content that might need more connections
- **Dense Clusters**: Areas of concentrated activity or topics

### Exploring Collaboration Patterns
- **People Clusters**: Groups of people who appear together frequently
- **Project Networks**: Notes and people connected by shared projects
- **Communication Patterns**: Who mentions whom and how often
- **Knowledge Sharing**: How information flows between people

### Temporal Analysis
- **Recent Activity**: Highlight recently created or modified content
- **Growth Patterns**: See how your knowledge base has evolved
- **Seasonal Trends**: Identify cyclical patterns in your work
- **Project Timelines**: Trace the development of ideas over time

## Graph Analytics

### Connection Metrics
- **Degree Centrality**: Number of direct connections
- **Betweenness Centrality**: How often a node bridges others
- **Closeness Centrality**: Average distance to all other nodes
- **PageRank**: Importance based on connection quality

### Network Statistics
- **Total Nodes**: Count of notes and people
- **Total Connections**: Number of relationships
- **Average Degree**: Typical number of connections per node
- **Clustering Coefficient**: How interconnected the graph is
- **Diameter**: Longest shortest path between any two nodes

### Growth Analysis
- **New Connections**: Rate of relationship formation
- **Content Growth**: How quickly you're adding notes
- **Network Density**: Ratio of actual to possible connections
- **Community Detection**: Identification of distinct topic clusters

## Advanced Features

### Graph Queries
Use the query interface to find specific patterns:
- `connected(note1, note2)`: Check if two notes are connected
- `neighbors(person)`: Find all notes mentioning a person
- `path(start, end)`: Find connection path between nodes
- `cluster(node)`: Identify the cluster containing a node

### Export Options
- **Image Export**: Save graph as PNG, SVG, or PDF
- **Data Export**: Export graph data as JSON or GraphML
- **Subgraph Export**: Save selected portions of the graph
- **Animation Export**: Create animated GIFs of graph evolution

### Integration Features
- **Embed in Notes**: Include graph visualizations in notes
- **Share Views**: Send specific graph configurations to others
- **API Access**: Programmatic access to graph data
- **Plugin Support**: Extend functionality with custom plugins

## Best Practices

### Building a Rich Graph
- **Use References**: Actively link related notes with #references
- **Mention People**: Include @mentions to build people connections
- **Create Hubs**: Develop index notes that link to many related topics
- **Regular Review**: Periodically explore the graph to find missing connections

### Maintaining Graph Quality
- **Clean Up**: Remove outdated or irrelevant connections
- **Merge Duplicates**: Combine similar notes or people entries
- **Categorize**: Use consistent categories and tags
- **Archive Old Content**: Move outdated material to keep graph current

### Effective Exploration
- **Start with Questions**: Use the graph to answer specific questions
- **Follow Curiosity**: Explore unexpected connections
- **Take Notes**: Document insights discovered through graph exploration
- **Share Discoveries**: Discuss interesting patterns with collaborators

## Troubleshooting

### Performance Issues
**Slow graph rendering**
- Reduce the number of visible nodes using filters
- Simplify the layout algorithm
- Hide labels for better performance
- Consider upgrading hardware for large graphs

**Memory usage**
- Close other applications while using the graph
- Use time-based filters to show smaller subsets
- Archive old content to reduce graph size
- Restart the application if memory usage is high

### Visual Problems
**Overlapping nodes**
- Adjust repulsion strength in layout settings
- Use a different layout algorithm
- Increase the canvas size
- Manually reposition problematic nodes

**Missing connections**
- Check that references and mentions are properly formatted
- Verify that sync has completed
- Refresh the graph view
- Check filter settings that might hide connections

**Poor layout**
- Try different layout algorithms
- Adjust layout parameters
- Reset to default settings
- Manually arrange important nodes

### Data Issues
**Incorrect relationships**
- Verify that @mentions and #references are accurate
- Check for typos in names and references
- Update people directory for consistent naming
- Review and clean up duplicate entries

**Missing nodes**
- Ensure all notes and people are properly synced
- Check filter settings
- Verify that content meets minimum connection thresholds
- Refresh the graph data

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open graph | `Ctrl+G` |
| Search in graph | `Ctrl+F` |
| Fit to screen | `F` |
| Reset layout | `R` |
| Toggle filters | `Ctrl+Shift+F` |
| Export graph | `Ctrl+E` |
| Fullscreen | `F11` |
| Select all | `Ctrl+A` |
| Zoom in | `+` or `Ctrl++` |
| Zoom out | `-` or `Ctrl+-` |

## Integration with Other Features

### Notes Integration
- Click graph nodes to open corresponding notes
- See graph context while editing notes
- Automatic graph updates when notes change
- Visual feedback for note relationships

### People Integration
- People appear as distinct nodes in the graph
- Click to view person profiles and connections
- Visual representation of collaboration networks
- Track relationship strength over time

### AI Integration
- AI-suggested connections based on content similarity
- Automatic detection of implicit relationships
- Smart clustering of related topics
- Insights about knowledge gaps and opportunities

### Search Integration
- Search results highlighted in graph view
- Graph-based search suggestions
- Visual exploration of search results
- Context-aware search based on graph position

---

*For more help, see the [FAQ](../faq.md) or [Troubleshooting Guide](../troubleshooting.md)*
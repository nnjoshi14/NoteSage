# Search and Navigation

NoteSage provides powerful search capabilities to help you quickly find information across your notes, people, and todos.

## Overview

Search features include:
- **Full-text search** across all content
- **Advanced filters** for precise results
- **Quick switcher** for fast navigation
- **Semantic search** using AI understanding
- **Visual search** in the knowledge graph
- **Saved searches** for frequent queries

## Basic Search

### Global Search
1. **Open Search**: Press `Ctrl+F` or click the search icon
2. **Enter Query**: Type your search terms
3. **View Results**: Browse through matching content
4. **Navigate**: Click results to open notes, people, or todos

### Search Scope
- **All Content**: Search across notes, people, and todos
- **Notes Only**: Focus search on note content
- **People Only**: Search people directory
- **Todos Only**: Find specific tasks
- **Current Note**: Search within the active note

### Search Results
Results are organized by:
- **Relevance**: Most relevant matches first
- **Content Type**: Notes, people, todos grouped separately
- **Recency**: Recently modified content prioritized
- **Connection Strength**: Highly connected content ranked higher

## Quick Switcher

### Fast Navigation
Press `Ctrl+P` to open the quick switcher:
- **Fuzzy Search**: Type partial names to find notes
- **Recent Files**: Recently accessed content appears first
- **Smart Ranking**: Frequently used content ranked higher
- **Instant Preview**: See content preview without opening

### Switcher Features
- **Keyboard Navigation**: Use arrow keys to navigate results
- **Quick Open**: Press Enter to open selected item
- **New Note**: Type new name and press Enter to create
- **Multiple Selection**: Hold Ctrl to select multiple items

### Search Shortcuts
- `@person` - Search for people
- `#tag` - Search by tags
- `todo:` - Search todos
- `recent:` - Show recent items
- `modified:today` - Today's changes

## Advanced Search

### Search Operators
Use operators for precise searches:
- **AND**: `meeting AND project` (both terms required)
- **OR**: `meeting OR standup` (either term)
- **NOT**: `meeting NOT cancelled` (exclude term)
- **Quotes**: `"exact phrase"` (exact match)
- **Wildcards**: `meet*` (partial matching)

### Field-Specific Search
- **Title**: `title:project` (search in titles only)
- **Content**: `content:analysis` (search in note body)
- **Author**: `author:john` (created by specific person)
- **Category**: `category:meeting` (specific note category)
- **Tags**: `tag:urgent` (notes with specific tags)

### Date Filters
- **Today**: `modified:today` or `created:today`
- **This Week**: `modified:week` or `created:week`
- **Date Range**: `modified:2024-01-01..2024-01-31`
- **Before/After**: `created:>2024-01-01` or `modified:<2024-01-31`
- **Relative**: `modified:7d` (last 7 days)

## Search Filters

### Content Filters
- **Note Categories**: Filter by Meeting, Note, Project, etc.
- **Tags**: Include or exclude specific tags
- **Folders**: Search within specific folder hierarchies
- **Status**: Archived, pinned, or favorite notes
- **Length**: Short, medium, or long notes

### People Filters
- **Company**: Filter by employer or organization
- **Role**: Search by job title or function
- **Connection Strength**: Highly connected or rarely mentioned
- **Recent Activity**: Recently mentioned or inactive

### Todo Filters
- **Status**: Pending, completed, or overdue
- **Assignee**: Tasks assigned to specific people
- **Due Date**: Today, this week, overdue, or no date
- **Priority**: High, medium, or low priority tasks
- **Source**: Todos from specific notes or projects

## Semantic Search

### AI-Powered Understanding
When AI is enabled, search includes:
- **Concept Matching**: Find related concepts even without exact keywords
- **Synonym Recognition**: Matches alternative terms and phrases
- **Context Understanding**: Considers surrounding content for relevance
- **Intent Recognition**: Understands what you're looking for

### Natural Language Queries
Ask questions in plain English:
- "What did we discuss about the budget?"
- "Show me todos assigned to Sarah"
- "Find notes about machine learning from last month"
- "Who was mentioned in the project planning meeting?"

### Smart Suggestions
- **Query Completion**: Suggests how to complete your search
- **Related Searches**: Recommends similar or follow-up searches
- **Spelling Correction**: Fixes typos and suggests alternatives
- **Search Refinement**: Helps narrow down broad searches

## Visual Search

### Knowledge Graph Search
1. **Open Graph**: Navigate to the Knowledge Graph view
2. **Search Nodes**: Use the graph search to find specific nodes
3. **Filter Connections**: Show only certain types of relationships
4. **Explore Visually**: Follow connections to discover related content

### Graph Search Features
- **Node Highlighting**: Search results are highlighted in the graph
- **Path Finding**: Find connection paths between concepts
- **Cluster Search**: Find all nodes in a specific cluster
- **Relationship Filtering**: Show only specific connection types

## Saved Searches

### Creating Saved Searches
1. **Perform Search**: Execute a search with filters
2. **Save Search**: Click "Save Search" button
3. **Name Search**: Give it a descriptive name
4. **Set Alerts**: Optionally get notified of new matches

### Managing Saved Searches
- **Quick Access**: Saved searches appear in search dropdown
- **Edit Searches**: Modify search criteria and filters
- **Share Searches**: Export search configurations for others
- **Search Alerts**: Get notified when new content matches

### Common Saved Searches
- **Today's Work**: `modified:today AND NOT archived`
- **My Todos**: `todo: AND assigned:me AND status:pending`
- **Team Updates**: `author:team AND modified:week`
- **Project Notes**: `category:project AND tag:active`

## Search Performance

### Optimization Tips
- **Use Specific Terms**: More specific searches are faster
- **Combine Filters**: Use multiple filters to narrow results
- **Recent Content**: Search recent content first for speed
- **Index Status**: Ensure search index is up to date

### Large Knowledge Bases
For extensive content:
- **Incremental Search**: Results appear as you type
- **Result Limits**: Show top results first, load more as needed
- **Background Indexing**: Search index updates in background
- **Cache Results**: Frequently accessed results are cached

### Search Index Management
- **Automatic Updates**: Index updates as content changes
- **Manual Refresh**: Force index rebuild if needed
- **Index Status**: Monitor indexing progress and health
- **Selective Indexing**: Choose what content to include in search

## Search Analytics

### Usage Insights
- **Popular Searches**: Most frequently used search terms
- **Search Patterns**: How search usage changes over time
- **Result Quality**: Which searches find relevant results
- **Performance Metrics**: Search speed and efficiency

### Content Discovery
- **Unused Content**: Notes that never appear in search results
- **Popular Content**: Most frequently found content
- **Search Gaps**: Terms that don't return good results
- **Content Recommendations**: Suggestions for new content

## Mobile and Offline Search

### Offline Search
- **Local Index**: Search works without internet connection
- **Cached Results**: Recent search results available offline
- **Sync Updates**: Search index syncs when connection restored
- **Partial Results**: Some results available even when partially synced

### Mobile Optimization
- **Touch Interface**: Optimized for mobile search interaction
- **Voice Search**: Speak search queries on supported devices
- **Quick Actions**: Swipe gestures for common search actions
- **Responsive Design**: Search interface adapts to screen size

## Integration Features

### External Search
- **Web Search**: Search the web for related information
- **Document Search**: Search attached files and documents
- **Email Integration**: Search connected email accounts
- **Cloud Storage**: Search files in connected cloud services

### API Access
- **Search API**: Programmatic access to search functionality
- **Custom Integrations**: Build custom search interfaces
- **Webhook Notifications**: Get notified of search events
- **Bulk Operations**: Perform operations on search results

## Troubleshooting Search

### Common Issues

**No search results**
- Check spelling and try alternative terms
- Remove filters that might be too restrictive
- Verify content exists and is properly synced
- Try broader search terms or wildcards

**Slow search performance**
- Reduce search scope with filters
- Use more specific search terms
- Check network connection for cloud search
- Consider rebuilding search index

**Irrelevant results**
- Use more specific search terms
- Add filters to narrow results
- Use quotes for exact phrase matching
- Try advanced search operators

**Missing recent content**
- Wait for search index to update
- Try manual sync to refresh content
- Check if content is properly saved
- Verify search index is functioning

### Performance Optimization
- **Regular Maintenance**: Periodically rebuild search index
- **Content Cleanup**: Archive or delete outdated content
- **Filter Usage**: Use filters to improve search speed
- **Hardware Considerations**: More RAM improves search performance

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Global search | `Ctrl+F` |
| Quick switcher | `Ctrl+P` |
| Search in current note | `Ctrl+Shift+F` |
| Advanced search | `Ctrl+Shift+A` |
| Save search | `Ctrl+S` (in search) |
| Clear search | `Escape` |
| Next result | `Ctrl+G` |
| Previous result | `Ctrl+Shift+G` |

## Best Practices

### Effective Searching
- **Start Broad**: Begin with general terms, then narrow down
- **Use Filters**: Combine text search with filters for precision
- **Learn Operators**: Master search operators for complex queries
- **Save Frequent Searches**: Create shortcuts for common searches

### Content Organization
- **Consistent Tagging**: Use consistent tags for better searchability
- **Descriptive Titles**: Write clear, searchable note titles
- **Rich Metadata**: Include relevant information in note metadata
- **Regular Cleanup**: Remove or archive outdated content

### Search Strategy
- **Multiple Approaches**: Try different search methods for complex queries
- **Iterative Refinement**: Gradually refine searches for better results
- **Context Awareness**: Consider when and where content was created
- **Collaborative Search**: Share search strategies with team members

---

*For more help, see the [FAQ](../faq.md) or [Troubleshooting Guide](../troubleshooting.md)*
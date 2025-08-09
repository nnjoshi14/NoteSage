# Todo Management

NoteSage's todo system helps you capture, organize, and track action items that emerge from your notes and meetings.

## Overview

The Todo system features:
- **Automatic extraction** from notes using structured format
- **Unique ID system** for stable todo references
- **Person assignments** with @mentions
- **Due date tracking** and calendar integration
- **Real-time synchronization** across devices
- **Manual sync triggers** for immediate updates

## Todo Format

NoteSage uses a structured format for todos within notes:

```
- [ ][t1] Complete project documentation @john.smith 2024-01-15
- [x][t2] Review quarterly report @sarah.johnson 2024-01-10
- [ ][t3] Schedule team meeting
```

### Format Components
- **Checkbox**: `[ ]` (pending) or `[x]` (completed)
- **Todo ID**: `[t1]`, `[t2]`, etc. (auto-generated, unique per note)
- **Text**: Description of the task
- **Assignment**: `@person` (optional)
- **Due Date**: `YYYY-MM-DD` format (optional)

## Creating Todos

### Method 1: Direct Entry in Notes
1. Type the todo format directly in any note
2. Use auto-generated IDs (t1, t2, t3, etc.)
3. Save the note to register the todo

### Method 2: Todo Panel
1. Open the **Todos** section
2. Click **"Add Todo"**
3. Fill in the details:
   - Description
   - Assign to person (optional)
   - Set due date (optional)
   - Choose source note
4. The todo is automatically formatted and added to the note

### Method 3: AI Extraction
1. Write natural language in your notes
2. AI automatically identifies action items
3. Converts them to structured todo format
4. Assigns unique IDs and suggests assignments

## Managing Todos

### Viewing Todos
- **All Todos**: Complete list with filtering options
- **By Status**: Pending, completed, or overdue
- **By Person**: Filter by assignee
- **By Date**: Due today, this week, or custom range
- **By Note**: See todos from specific notes

### Updating Todos
- **Mark Complete**: Check the box in the note or todo panel
- **Change Assignment**: Edit the @mention in the note
- **Update Due Date**: Modify the date in the note
- **Edit Description**: Change the text in the note

### Todo Status Sync
- Changes in notes automatically update the todo database
- Changes in todo panel update the source note
- Real-time sync across all connected devices
- Manual sync button for immediate updates

## Calendar Integration

### Calendar View
1. Navigate to **Todos** → **Calendar**
2. View todos by day, week, or month
3. Drag and drop to reschedule
4. Color coding by status and priority

### Due Date Features
- **Overdue Indicators**: Red highlighting for past due items
- **Today's Tasks**: Special highlighting for current day
- **Upcoming Deadlines**: Preview of next 7 days
- **Date Parsing**: Flexible date input (tomorrow, next Friday, etc.)

### Calendar Export
- Export todos to ICS format
- Import into external calendar applications
- Sync with Google Calendar, Outlook, etc.
- Set up recurring todo patterns

## Person Assignments

### Assigning Todos
1. Use @mentions in the todo text
2. Select from existing people or add new ones
3. Multiple assignments: `@john @sarah`
4. Team assignments: `@team-frontend`

### Assignment Features
- **Auto-complete**: Type @ to see people suggestions
- **Assignment History**: Track who completes what
- **Workload View**: See todos per person
- **Notification System**: Alert assignees of new tasks

### Team Collaboration
- Share notes with embedded todos
- Real-time updates when others complete tasks
- Comment on todos for clarification
- Track team progress and bottlenecks

## Advanced Features

### Todo Relationships
- **Parent-Child**: Break large tasks into subtasks
- **Dependencies**: Link related todos
- **Project Grouping**: Organize by project or category
- **Cross-Note References**: Todos spanning multiple notes

### Bulk Operations
- **Bulk Complete**: Mark multiple todos as done
- **Bulk Assign**: Assign multiple todos to someone
- **Bulk Reschedule**: Change due dates for multiple items
- **Bulk Delete**: Remove completed or obsolete todos

### Todo Templates
- **Meeting Templates**: Standard action items for meetings
- **Project Templates**: Common tasks for project types
- **Personal Templates**: Recurring personal tasks
- **Custom Templates**: Create your own patterns

## Synchronization

### Automatic Sync
- Todos sync automatically when notes are saved
- Real-time updates across all devices
- Conflict resolution for simultaneous edits
- Offline queue for disconnected changes

### Manual Sync
1. Click the **"Sync"** button in the todo panel
2. Scans all modified notes since last sync
3. Updates todo database with changes
4. Shows sync progress and results

### Sync Status
- **Green**: All todos synchronized
- **Yellow**: Sync in progress
- **Red**: Sync errors or conflicts
- **Offline**: Working with local cache

## Search and Filtering

### Search Options
- **Text Search**: Find todos by description
- **Person Search**: Find todos assigned to someone
- **Date Search**: Find todos by due date range
- **Note Search**: Find todos from specific notes
- **Status Search**: Filter by completion status

### Advanced Filters
- **Combine Filters**: Multiple criteria at once
- **Save Filters**: Store frequently used filter combinations
- **Smart Filters**: AI-suggested relevant filters
- **Quick Filters**: One-click common filters

### Search Shortcuts
| Filter | Shortcut |
|--------|----------|
| My todos | `assigned:me` |
| Due today | `due:today` |
| Overdue | `due:overdue` |
| This week | `due:week` |
| Completed | `status:done` |
| High priority | `priority:high` |

## Reporting and Analytics

### Todo Metrics
- **Completion Rate**: Percentage of completed todos
- **Average Time**: How long todos take to complete
- **Overdue Trends**: Pattern of missed deadlines
- **Assignment Distribution**: Workload across team members

### Progress Tracking
- **Daily Progress**: Todos completed each day
- **Weekly Summaries**: Progress reports
- **Project Completion**: Track project-specific todos
- **Personal Productivity**: Individual performance metrics

### Export Reports
- **CSV Export**: Todo data for external analysis
- **PDF Reports**: Formatted progress reports
- **Chart Generation**: Visual progress representations
- **Time Tracking**: Integration with time tracking tools

## Best Practices

### Effective Todo Management
- **Be Specific**: Write clear, actionable descriptions
- **Set Realistic Dates**: Don't overcommit on deadlines
- **Regular Reviews**: Weekly todo review sessions
- **Archive Completed**: Keep active list manageable

### Team Collaboration
- **Clear Assignments**: Assign todos to specific people
- **Context in Notes**: Provide background in the source note
- **Regular Check-ins**: Review team todos in meetings
- **Shared Responsibility**: Use team assignments when appropriate

### Organization Tips
- **Use Categories**: Organize todos by project or type
- **Priority Levels**: Mark urgent or important todos
- **Batch Similar Tasks**: Group related todos together
- **Regular Cleanup**: Remove obsolete or duplicate todos

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Add new todo | `Ctrl+Shift+T` |
| Mark complete | `Ctrl+Enter` |
| Assign to person | `@` in todo text |
| Set due date | `Ctrl+D` |
| Open calendar | `Ctrl+Shift+C` |
| Sync todos | `Ctrl+Shift+S` |
| Filter todos | `Ctrl+F` |
| Quick add | `Ctrl+Q` |

## Troubleshooting

### Common Issues

**Todos not appearing in list**
- Check that the note has been saved
- Verify todo format is correct
- Try manual sync to refresh
- Check if todo is filtered out

**Sync conflicts**
- Review conflicted todos in sync panel
- Choose to keep local or remote version
- Merge changes manually if needed
- Contact support for persistent conflicts

**Missing assignments**
- Verify @mention format is correct
- Check that person exists in people directory
- Ensure person name matches exactly
- Try re-typing the assignment

**Calendar not updating**
- Refresh the calendar view
- Check date format (YYYY-MM-DD)
- Verify due dates are properly set
- Try manual sync to update calendar

### Performance Tips
- **Large Todo Lists**: Use filters to focus on relevant items
- **Slow Sync**: Check network connection and server status
- **Memory Usage**: Archive old completed todos periodically
- **Search Speed**: Use specific search terms for faster results

## Integration with Other Features

### Notes Integration
- Todos are embedded directly in notes
- Context preserved with surrounding content
- Easy navigation between todos and source notes
- Version history includes todo changes

### People Integration
- Assign todos to people in your directory
- View all todos for a specific person
- Track workload and completion rates
- Notification system for assignments

### AI Integration
- Automatic todo extraction from meeting notes
- Smart suggestions for assignments and due dates
- Priority detection based on note content
- Productivity insights and recommendations

### Knowledge Graph
- Todos appear as connections in the graph
- Visualize project relationships through todos
- Track collaboration patterns
- Identify bottlenecks and dependencies

---

*For more help, see the [FAQ](../faq.md) or [Troubleshooting Guide](../troubleshooting.md)*
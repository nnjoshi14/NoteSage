# Getting Started with NoteSage

This guide will help you set up and start using NoteSage for the first time.

## Installation

### Desktop Application

#### Ubuntu Linux
1. Download the `.deb` package from the releases page
2. Install using: `sudo dpkg -i notesage-desktop_*.deb`
3. Launch from Applications menu or run `notesage-desktop`

#### macOS
1. Download the `.dmg` file from the releases page
2. Open the DMG and drag NoteSage to Applications
3. Launch from Applications folder or Spotlight

## First Launch Setup

### 1. Server Connection
When you first launch NoteSage, you'll be prompted to connect to a NoteSage server:

- **Server URL**: Enter your server address (e.g., `http://localhost:8080` or `https://your-server.com`)
- **Username**: Your account username
- **Password**: Your account password

### 2. Initial Sync
After connecting, NoteSage will:
- Download your existing data (if any)
- Set up local cache for offline access
- Configure synchronization settings

### 3. Workspace Overview
Your NoteSage workspace includes:
- **Notes**: Main area for creating and editing notes
- **People**: Directory of your contacts and connections
- **Todos**: Task management and calendar view
- **Graph**: Visual representation of your knowledge connections
- **AI Insights**: AI-powered analysis and suggestions

## Creating Your First Note

1. Click the **"New Note"** button or press `Ctrl+N` (Cmd+N on Mac)
2. Add a title for your note
3. Start typing in the editor
4. Use formatting options from the toolbar or keyboard shortcuts
5. Save automatically happens as you type

### Rich Text Features
- **Headings**: Use `#`, `##`, `###` for different heading levels
- **Lists**: Use `-` for bullet points or `1.` for numbered lists
- **@Mentions**: Type `@` to mention people
- **#References**: Type `#` to reference other notes
- **Tables**: Use `/table` slash command
- **Code**: Use backticks for `inline code` or triple backticks for code blocks

## Adding People

1. Go to the **People** section
2. Click **"Add Person"**
3. Fill in contact information:
   - Name (required)
   - Email
   - Phone
   - Company
   - Title
   - LinkedIn URL
   - Notes
4. Save the person

People you add can be mentioned in notes using `@name`.

## Working with Todos

NoteSage automatically extracts todos from your notes when you use the format:
```
- [ ][t1] Complete project documentation @john 2024-01-15
```

- `[ ]` or `[x]`: Checkbox (empty or completed)
- `[t1]`: Unique todo ID (auto-generated)
- `@john`: Assigned person (optional)
- `2024-01-15`: Due date (optional)

## Offline Usage

NoteSage works offline by:
- Caching all your data locally
- Queuing changes made while offline
- Syncing automatically when connection is restored

You can work normally even without internet connection.

## Next Steps

- Explore the [Notes Guide](notes.md) for advanced editing features
- Learn about [Todo Management](todos.md) for task organization
- Discover [AI Features](ai-features.md) for automated insights
- Check out [Keyboard Shortcuts](shortcuts.md) for faster navigation

## Need Help?

- Review the [FAQ](../faq.md) for common questions
- Check the [Troubleshooting Guide](../troubleshooting.md) for issues
- Contact support for additional assistance
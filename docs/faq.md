# Frequently Asked Questions (FAQ)

Find answers to common questions about NoteSage installation, usage, and troubleshooting.

## General Questions

### What is NoteSage?
NoteSage is a knowledge management system that helps you capture, organize, and connect your notes, people, and tasks. It features rich text editing, AI-powered insights, knowledge graph visualization, and real-time collaboration.

### What platforms does NoteSage support?
- **Desktop**: Ubuntu Linux and macOS
- **Server**: Ubuntu Linux (primary), other Linux distributions (manual installation)
- **Future**: Web browsers, Android, and iOS clients are planned

### How is NoteSage different from other note-taking apps?
NoteSage focuses on:
- **Connections**: Built-in knowledge graph and relationship tracking
- **People Management**: Integrated contact management with @mentions
- **AI Integration**: Automated todo extraction and insights
- **Collaboration**: Real-time editing and team features
- **Self-hosted**: You control your data with local server installation

### Is NoteSage free?
NoteSage follows an open-source model with:
- **Desktop Client**: Free and open source
- **Server Software**: Free for self-hosting
- **Cloud Hosting**: Paid plans for managed hosting (future)
- **Enterprise Features**: Commercial licenses for advanced features

## Installation and Setup

### What are the system requirements?
**Desktop Client:**
- **Ubuntu**: 20.04 LTS or later, 4GB RAM, 1GB disk space
- **macOS**: 10.15 (Catalina) or later, 4GB RAM, 1GB disk space

**Server:**
- **Ubuntu**: 20.04 LTS or later, 4GB RAM, 20GB disk space
- **Database**: PostgreSQL (recommended) or SQLite
- **Network**: Internet connection for AI features (optional)

### How do I install NoteSage?
**Desktop Client:**
1. Download the installer for your platform
2. **Ubuntu**: `sudo dpkg -i notesage-desktop_*.deb`
3. **macOS**: Open DMG and drag to Applications folder

**Server:**
1. Download the server installer
2. Run: `sudo ./install.sh`
3. Configure database and settings
4. Start service: `sudo systemctl start notesage`

### Can I run NoteSage without a server?
No, NoteSage requires a server component. However, you can:
- Install the server on the same machine as the desktop client
- Use a local server for single-user scenarios
- Connect to a shared server for team collaboration

### How do I connect to multiple servers?
1. Go to Settings → Server Connection
2. Click "Add Server Profile"
3. Enter server details and credentials
4. Switch between servers using the profile dropdown

## Usage Questions

### How do I create my first note?
1. Click "New Note" or press `Ctrl+N`
2. Add a title and start typing
3. Use formatting options from the toolbar
4. Notes save automatically as you type

### How do @mentions work?
1. Type `@` in any note
2. Start typing a person's name
3. Select from the dropdown or add a new person
4. The mention creates a bidirectional link

### What is the todo format?
NoteSage uses structured todos:
```
- [ ][t1] Complete project documentation @john.smith 2024-01-15
```
- `[ ]` or `[x]`: Checkbox (pending/completed)
- `[t1]`: Unique ID (auto-generated)
- `@person`: Assignment (optional)
- `2024-01-15`: Due date (optional)

### How does the knowledge graph work?
The knowledge graph visualizes connections between:
- Notes linked by #references
- People connected through @mentions
- Todos assigned to people
- AI-detected relationships

Access it through the Graph tab or press `Ctrl+G`.

### Can I work offline?
Yes, NoteSage supports offline work:
- All data is cached locally
- Changes are queued when offline
- Automatic sync when connection is restored
- Full functionality available offline

## AI Features

### Which AI providers are supported?
- **OpenAI**: GPT-4, GPT-3.5 Turbo
- **Google Gemini**: Gemini Pro, Gemini Pro Vision
- **Grok**: X.AI's Grok models
- **Local Models**: Support for local AI models (experimental)

### How do I set up AI features?
1. Go to Settings → AI Configuration
2. Choose your preferred provider
3. Enter your API key
4. Enable desired AI features
5. Test the connection

### What AI features are available?
- **Todo Extraction**: Automatically extract action items from notes
- **People Analysis**: Identify and analyze people mentions
- **Content Insights**: Generate insights from your knowledge base
- **Smart Suggestions**: AI-powered writing assistance
- **Relationship Detection**: Discover implicit connections

### Are AI features required?
No, all core features work without AI:
- Manual todo creation and management
- Manual people mentions and connections
- Full note editing and organization
- Knowledge graph visualization
- Search and navigation

### How much do AI features cost?
Costs depend on your chosen provider:
- **OpenAI**: Pay-per-token usage
- **Google Gemini**: Competitive pricing with free tier
- **Grok**: Subscription-based pricing
- **Local Models**: No ongoing costs after setup

## Collaboration

### How many users can collaborate?
The server supports multiple concurrent users. Limits depend on:
- Server hardware specifications
- Network bandwidth
- Database performance
- Concurrent editing load

### How does real-time collaboration work?
- Multiple users can edit the same note simultaneously
- Live cursors show where others are typing
- Changes appear instantly for all users
- Automatic conflict resolution handles simultaneous edits

### Can I control who sees what?
Yes, through workspace permissions:
- **Owner**: Full control including deletion
- **Admin**: Manage users and settings
- **Editor**: Create and edit content
- **Commenter**: Add comments, read-only access
- **Viewer**: Read-only access

### How are conflicts resolved?
- **Automatic**: Most conflicts are resolved automatically
- **Manual**: Complex conflicts require user intervention
- **Version History**: Track all changes and contributors
- **Rollback**: Restore previous versions if needed

## Data and Privacy

### Where is my data stored?
- **Desktop**: Local cache on your device
- **Server**: Your self-hosted NoteSage server
- **AI Providers**: Only data you choose to send for processing
- **No Cloud**: NoteSage doesn't store your data in external clouds

### Can I export my data?
Yes, comprehensive export options:
- **Individual Notes**: Export to PDF, Markdown, HTML
- **Bulk Export**: Export all data to standard formats
- **Database Backup**: Full database backup for migration
- **Selective Export**: Choose specific content to export

### How do I backup my data?
**Automatic Backups:**
- Desktop client creates local backups
- Server creates database backups
- Configurable retention periods

**Manual Backups:**
- Export data through File → Export
- Database backup: `pg_dump notesage > backup.sql`
- File system backup of server data directory

### Is my data encrypted?
- **In Transit**: All data encrypted with TLS/HTTPS
- **At Rest**: Database encryption available
- **Local Storage**: Desktop cache can be encrypted
- **Backups**: Backup encryption supported

### What about GDPR compliance?
NoteSage supports GDPR compliance:
- **Data Ownership**: You own and control all data
- **Right to Export**: Comprehensive data export
- **Right to Delete**: Complete data deletion
- **Data Processing**: Transparent AI data processing
- **Consent Management**: Granular privacy controls

## Technical Questions

### What databases are supported?
- **PostgreSQL**: Recommended for production and multi-user
- **SQLite**: Suitable for single-user or development
- **Future**: MySQL and other databases planned

### Can I customize NoteSage?
Yes, extensive customization options:
- **Themes**: Light, dark, and custom themes
- **Shortcuts**: Customize all keyboard shortcuts
- **Templates**: Create custom note templates
- **Plugins**: Plugin system for extensions (planned)
- **API**: REST API for custom integrations

### How do I upgrade NoteSage?
**Desktop Client:**
- Automatic updates through built-in updater
- Manual download and installation
- Update notifications in the application

**Server:**
- Automated upgrade script: `sudo ./upgrade.sh`
- Manual upgrade with database migrations
- Backup before upgrading recommended

### Can I integrate with other tools?
Current integrations:
- **Calendar**: Export todos to ICS format
- **Email**: Import email content as notes
- **File Systems**: Import/export to various formats
- **APIs**: REST API for custom integrations

Planned integrations:
- **Zapier**: Workflow automation
- **Slack**: Team communication
- **GitHub**: Development workflow integration
- **Google Workspace**: Productivity suite integration

## Troubleshooting

### NoteSage won't start
1. Check system requirements
2. Verify installation completed successfully
3. Check for conflicting applications
4. Review application logs for errors
5. Try resetting application data

### Can't connect to server
1. Verify server URL and port
2. Check network connectivity
3. Ensure server is running
4. Check firewall settings
5. Verify credentials are correct

### Sync isn't working
1. Check internet connection
2. Verify server is accessible
3. Try manual sync
4. Clear local cache if needed
5. Check for sync conflicts

### Search not finding results
1. Rebuild search index
2. Check search filters
3. Verify content is synced
4. Try different search terms
5. Check for index corruption

### Performance is slow
1. Check available memory and disk space
2. Close unnecessary applications
3. Reduce cache size if needed
4. Check network connection speed
5. Consider hardware upgrade

## Getting Help

### Where can I find more help?
- **Documentation**: Comprehensive guides in the docs folder
- **Troubleshooting**: Detailed troubleshooting guide
- **Community**: GitHub discussions and issues
- **Support**: Email support@notesage.com
- **Training**: Video tutorials and webinars

### How do I report bugs?
1. Check if the issue is already reported
2. Gather system information and logs
3. Create detailed reproduction steps
4. Submit issue on GitHub or email support
5. Include relevant screenshots or error messages

### Can I request features?
Yes, feature requests are welcome:
- **GitHub Issues**: Submit feature requests
- **Community Discussions**: Discuss ideas with other users
- **Roadmap**: Check the public roadmap for planned features
- **Voting**: Vote on existing feature requests

### Is there a community?
- **GitHub**: Source code, issues, and discussions
- **Discord**: Real-time chat with other users
- **Forum**: Community forum for discussions
- **Blog**: Updates, tips, and best practices
- **Newsletter**: Monthly updates and feature announcements

## Licensing and Legal

### What license does NoteSage use?
- **Desktop Client**: MIT License (open source)
- **Server**: MIT License (open source)
- **Documentation**: Creative Commons
- **Enterprise Features**: Commercial license available

### Can I use NoteSage commercially?
Yes, NoteSage can be used commercially:
- **Self-hosted**: Free for commercial use
- **Enterprise Features**: Commercial license for advanced features
- **Support**: Professional support available
- **Customization**: Custom development services available

### Can I modify NoteSage?
Yes, under the MIT license you can:
- Modify the source code
- Create custom versions
- Distribute modifications
- Use in commercial products
- Contribute back to the project

### What about third-party components?
NoteSage uses various open-source components:
- All licenses are documented
- Attribution provided where required
- No GPL or copyleft restrictions
- Compatible with commercial use

---

*Don't see your question? Check the [Troubleshooting Guide](troubleshooting.md) or contact support at support@notesage.com*
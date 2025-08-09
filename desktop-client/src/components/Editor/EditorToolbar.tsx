import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import './EditorToolbar.css';

interface EditorToolbarProps {
  editor: Editor;
  isMarkdownMode: boolean;
  onToggleMarkdown: () => void;
  onExportMarkdown: () => string;
  onExportHTML: () => string;
  onExportJSON: () => any;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  isMarkdownMode,
  onToggleMarkdown,
  onExportMarkdown,
  onExportHTML,
  onExportJSON,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = (format: 'markdown' | 'html' | 'json') => {
    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'markdown':
        content = onExportMarkdown();
        filename = 'note.md';
        mimeType = 'text/markdown';
        break;
      case 'html':
        content = onExportHTML();
        filename = 'note.html';
        mimeType = 'text/html';
        break;
      case 'json':
        content = JSON.stringify(onExportJSON(), null, 2);
        filename = 'note.json';
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const insertCodeBlock = () => {
    editor.chain().focus().setCodeBlock().run();
  };

  const insertCallout = (type: 'info' | 'warning' | 'error' | 'success') => {
    editor.chain().focus().insertContent({
      type: 'callout',
      attrs: { type },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Your callout content here...' }]
        }
      ]
    }).run();
  };

  const insertMermaidDiagram = () => {
    const defaultDiagram = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;

    editor.chain().focus().insertContent({
      type: 'mermaid',
      attrs: { code: defaultDiagram }
    }).run();
  };

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  if (isMarkdownMode) {
    return (
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            onClick={onToggleMarkdown}
            className="toolbar-button active"
            title="Switch to Rich Text Mode"
          >
            📝 Rich Text
          </button>
        </div>
        <div className="toolbar-group">
          <div className="export-dropdown">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="toolbar-button"
              title="Export"
            >
              📤 Export
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleExport('markdown')}>
                  📄 Markdown
                </button>
                <button onClick={() => handleExport('html')}>
                  🌐 HTML
                </button>
                <button onClick={() => handleExport('json')}>
                  📋 JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-toolbar">
      {/* Text Formatting */}
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`toolbar-button ${editor.isActive('bold') ? 'active' : ''}`}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`toolbar-button ${editor.isActive('italic') ? 'active' : ''}`}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`toolbar-button ${editor.isActive('strike') ? 'active' : ''}`}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`toolbar-button ${editor.isActive('code') ? 'active' : ''}`}
          title="Inline Code"
        >
          {'</>'}
        </button>
      </div>

      {/* Headings */}
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`toolbar-button ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`toolbar-button ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`toolbar-button ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      {/* Lists */}
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`toolbar-button ${editor.isActive('bulletList') ? 'active' : ''}`}
          title="Bullet List"
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`toolbar-button ${editor.isActive('orderedList') ? 'active' : ''}`}
          title="Numbered List"
        >
          1. List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`toolbar-button ${editor.isActive('taskList') ? 'active' : ''}`}
          title="Task List"
        >
          ☑ Tasks
        </button>
      </div>

      {/* Block Elements */}
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`toolbar-button ${editor.isActive('blockquote') ? 'active' : ''}`}
          title="Quote"
        >
          &quot; Quote
        </button>
        <button
          onClick={insertCodeBlock}
          className={`toolbar-button ${editor.isActive('codeBlock') ? 'active' : ''}`}
          title="Code Block"
        >
          {'{ } Code'}
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="toolbar-button"
          title="Horizontal Rule"
        >
          ― Rule
        </button>
      </div>

      {/* Advanced Elements */}
      <div className="toolbar-group">
        <button
          onClick={insertTable}
          className="toolbar-button"
          title="Insert Table"
        >
          📊 Table
        </button>
        <div className="dropdown">
          <button className="toolbar-button" title="Insert Callout">
            💡 Callout
          </button>
          <div className="dropdown-menu">
            <button onClick={() => insertCallout('info')}>ℹ️ Info</button>
            <button onClick={() => insertCallout('warning')}>⚠️ Warning</button>
            <button onClick={() => insertCallout('error')}>❌ Error</button>
            <button onClick={() => insertCallout('success')}>✅ Success</button>
          </div>
        </div>
        <button
          onClick={insertMermaidDiagram}
          className="toolbar-button"
          title="Insert Mermaid Diagram"
        >
          📈 Diagram
        </button>
      </div>

      {/* Links and Media */}
      <div className="toolbar-group">
        <button
          onClick={addLink}
          className={`toolbar-button ${editor.isActive('link') ? 'active' : ''}`}
          title="Add Link"
        >
          🔗 Link
        </button>
        <button
          onClick={addImage}
          className="toolbar-button"
          title="Add Image"
        >
          🖼️ Image
        </button>
      </div>

      {/* Undo/Redo */}
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="toolbar-button"
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="toolbar-button"
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
      </div>

      {/* Mode Toggle and Export */}
      <div className="toolbar-group">
        <button
          onClick={onToggleMarkdown}
          className="toolbar-button"
          title="Switch to Markdown Mode (Ctrl+Shift+M)"
        >
          📝 Markdown
        </button>
        <div className="export-dropdown">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="toolbar-button"
            title="Export"
          >
            📤 Export
          </button>
          {showExportMenu && (
            <div className="export-menu">
              <button onClick={() => handleExport('markdown')}>
                📄 Markdown
              </button>
              <button onClick={() => handleExport('html')}>
                🌐 HTML
              </button>
              <button onClick={() => handleExport('json')}>
                📋 JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
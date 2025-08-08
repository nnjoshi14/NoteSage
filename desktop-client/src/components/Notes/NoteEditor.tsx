import React, { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../stores/hooks';
import { Note, saveNote, updateCurrentNote } from '../../stores/slices/notesSlice';
import RichTextEditor from '../Editor/RichTextEditor';
import './NoteEditor.css';

interface NoteEditorProps {
  note: Note | null;
  onSave: (note: Note) => void;
  onClose: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onClose }) => {
  const dispatch = useAppDispatch();
  const { currentNote } = useAppSelector(state => state.notes);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Note');
  const [tags, setTags] = useState<string[]>([]);
  const [folderPath, setFolderPath] = useState('/');
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Available categories
  const categories = ['Note', 'Meeting', 'Research', 'Project', 'Personal', 'Archive'];

  // Initialize form with note data
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setCategory(note.category || 'Note');
      setTags(note.tags || []);
      setFolderPath(note.folder_path || '/');
      setIsModified(false);
    } else {
      // New note
      setTitle('');
      setContent('');
      setCategory('Note');
      setTags([]);
      setFolderPath('/');
      setIsModified(false);
    }
  }, [note]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!isModified || isSaving) return;

    setIsSaving(true);
    try {
      const noteData: Partial<Note> = {
        id: note?.id || `note-${Date.now()}`,
        title: title || 'Untitled',
        content,
        category,
        tags,
        folder_path: folderPath,
        updated_at: new Date().toISOString(),
        ...(note ? {} : { 
          created_at: new Date().toISOString(),
          version: 1,
          is_archived: false,
          is_pinned: false,
          is_favorite: false,
        }),
      };

      await dispatch(saveNote(noteData)).unwrap();
      setIsModified(false);
      onSave(noteData as Note);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [dispatch, note, title, content, category, tags, folderPath, isModified, isSaving, onSave]);

  // Auto-save every 2 seconds when modified
  useEffect(() => {
    if (isModified) {
      const timer = setTimeout(autoSave, 2000);
      return () => clearTimeout(timer);
    }
  }, [isModified, autoSave]);

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsModified(true);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsModified(true);
  };

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    setIsModified(true);
  };

  const handleTagAdd = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setIsModified(true);
    }
    setTagInput('');
  };

  const handleTagRemove = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
    setIsModified(true);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleTagAdd(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      handleTagRemove(tags[tags.length - 1]);
    }
  };

  const handleSave = async () => {
    await autoSave();
  };

  const handleExport = async (format: 'pdf' | 'markdown' | 'html') => {
    try {
      const result = await window.electronAPI.showSaveDialog({
        title: `Export Note as ${format.toUpperCase()}`,
        defaultPath: `${title || 'Untitled'}.${format === 'markdown' ? 'md' : format}`,
        filters: [
          { 
            name: format.toUpperCase(), 
            extensions: [format === 'markdown' ? 'md' : format] 
          }
        ]
      });

      if (!result.canceled && result.filePath) {
        // TODO: Implement actual export functionality
        console.log(`Exporting to ${format}:`, result.filePath);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (!note && !isModified) {
    return (
      <div className="note-editor-empty">
        <div className="empty-state">
          <h3>Select a note to edit</h3>
          <p>Choose a note from the list or create a new one to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="note-editor">
      {/* Header */}
      <div className="note-editor-header">
        <div className="note-editor-title">
          <input
            type="text"
            className="title-input"
            placeholder="Untitled"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          
          <div className="note-editor-status">
            {isSaving && <span className="saving-indicator">Saving...</span>}
            {isModified && !isSaving && <span className="modified-indicator">•</span>}
          </div>
        </div>

        <div className="note-editor-actions">
          <button
            className="btn btn-secondary"
            onClick={handleSave}
            disabled={!isModified || isSaving}
          >
            Save
          </button>
          
          <div className="dropdown">
            <button className="btn btn-secondary dropdown-toggle">
              Export
            </button>
            <div className="dropdown-menu">
              <button onClick={() => handleExport('pdf')}>Export as PDF</button>
              <button onClick={() => handleExport('markdown')}>Export as Markdown</button>
              <button onClick={() => handleExport('html')}>Export as HTML</button>
            </div>
          </div>
          
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="note-editor-metadata">
        <div className="metadata-row">
          <div className="metadata-field">
            <label>Category</label>
            <select
              className="form-control"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="metadata-field">
            <label>Folder</label>
            <input
              type="text"
              className="form-control"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="/"
            />
          </div>
        </div>

        <div className="metadata-field">
          <label>Tags</label>
          <div className="tags-input">
            <div className="tags-list">
              {tags.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                  <button
                    type="button"
                    className="tag-remove"
                    onClick={() => handleTagRemove(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              className="tag-input"
              placeholder="Add tags..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              onBlur={() => {
                if (tagInput.trim()) {
                  handleTagAdd(tagInput);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Content Editor */}
      <div className="note-editor-content">
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing your note..."
        />
      </div>

      {/* Footer with note info */}
      {note && (
        <div className="note-editor-footer">
          <div className="note-info">
            <span>Created: {new Date(note.created_at).toLocaleString()}</span>
            <span>Modified: {new Date(note.updated_at).toLocaleString()}</span>
            <span>Version: {note.version}</span>
            {note.sync_status && (
              <span className={`sync-status ${note.sync_status}`}>
                {note.sync_status === 'synced' ? 'Synced' : 
                 note.sync_status === 'pending' ? 'Pending sync' : 'Sync conflict'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;
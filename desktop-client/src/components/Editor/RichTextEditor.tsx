import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { lowlight } from 'lowlight';
import { SlashCommands } from './extensions/SlashCommands';
import { MermaidExtension } from './extensions/MermaidExtension';
import { CalloutExtension } from './extensions/CalloutExtension';
import { MentionSuggestion } from './suggestions/MentionSuggestion';
import { NoteLinkSuggestion } from './suggestions/NoteLinkSuggestion';
import { EditorToolbar } from './EditorToolbar';
import { BlockMenu } from './BlockMenu';
import './RichTextEditor.css';

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  placeholder?: string;
  editable?: boolean;
  showToolbar?: boolean;
  showCharacterCount?: boolean;
  people?: Array<{ id: string; name: string; email?: string }>;
  notes?: Array<{ id: string; title: string; updatedAt: string }>;
  onMentionPerson?: (personId: string) => void;
  onLinkNote?: (noteId: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content = '',
  onChange,
  onSave,
  placeholder = 'Start writing...',
  editable = true,
  showToolbar = true,
  showCharacterCount = true,
  people = [],
  notes = [],
  onMentionPerson,
  onLinkNote,
  onImageUpload,
}) => {
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-person',
        },
        suggestion: MentionSuggestion(people, onMentionPerson),
      }),
      Mention.extend({
        name: 'noteLink',
      }).configure({
        HTMLAttributes: {
          class: 'mention-note',
        },
        suggestion: NoteLinkSuggestion(notes, onLinkNote),
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount,
      SlashCommands,
      MermaidExtension,
      CalloutExtension,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      if (onChange && !isMarkdownMode) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/') && onImageUpload) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        
        if (imageItem && onImageUpload) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (file) {
            handleImageUpload(file);
          }
          return true;
        }
        return false;
      },
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!onImageUpload || !editor) return;
    
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error('Failed to upload image:', error);
    }
  };

  const toggleMarkdownMode = useCallback(() => {
    if (!editor) return;

    if (isMarkdownMode) {
      // Switch back to rich text mode
      editor.commands.setContent(markdownContent);
      setIsMarkdownMode(false);
    } else {
      // Switch to markdown mode
      const markdown = editor.storage.markdown?.getMarkdown() || editor.getText();
      setMarkdownContent(markdown);
      setIsMarkdownMode(true);
    }
  }, [editor, isMarkdownMode, markdownContent]);

  const handleMarkdownChange = (value: string) => {
    setMarkdownContent(value);
    if (onChange) {
      onChange(value);
    }
  };

  const exportToMarkdown = useCallback(() => {
    if (!editor) return '';
    return editor.storage.markdown?.getMarkdown() || editor.getText();
  }, [editor]);

  const exportToHTML = useCallback(() => {
    if (!editor) return '';
    return editor.getHTML();
  }, [editor]);

  const exportToJSON = useCallback(() => {
    if (!editor) return null;
    return editor.getJSON();
  }, [editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        onSave?.();
      }
      
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'M') {
        event.preventDefault();
        toggleMarkdownMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSave, toggleMarkdownMode]);

  if (!editor) {
    return <div className="editor-loading">Loading editor...</div>;
  }

  return (
    <div className="rich-text-editor">
      {showToolbar && (
        <EditorToolbar
          editor={editor}
          isMarkdownMode={isMarkdownMode}
          onToggleMarkdown={toggleMarkdownMode}
          onExportMarkdown={exportToMarkdown}
          onExportHTML={exportToHTML}
          onExportJSON={exportToJSON}
        />
      )}

      <div className="editor-container">
        {isMarkdownMode ? (
          <textarea
            className="markdown-editor"
            value={markdownContent}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            placeholder="Write in Markdown..."
          />
        ) : (
          <>
            <BubbleMenu
              editor={editor}
              tippyOptions={{ duration: 100 }}
              className="bubble-menu"
            >
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'is-active' : ''}
              >
                Bold
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'is-active' : ''}
              >
                Italic
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? 'is-active' : ''}
              >
                Code
              </button>
            </BubbleMenu>

            <FloatingMenu
              editor={editor}
              tippyOptions={{ duration: 100 }}
              className="floating-menu"
            >
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
              >
                H1
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
              >
                H2
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'is-active' : ''}
              >
                Bullet List
              </button>
            </FloatingMenu>

            <BlockMenu editor={editor} />
            
            <EditorContent editor={editor} />
          </>
        )}
      </div>

      {showCharacterCount && editor && (
        <div className="character-count">
          {editor.storage.characterCount.characters()} characters
          {editor.storage.characterCount.words()} words
        </div>
      )}
    </div>
  );
};
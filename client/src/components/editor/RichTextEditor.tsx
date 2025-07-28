import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2,
  Quote,
  Code,
  Plus
} from 'lucide-react';
import type { Note, Person } from '@shared/schema';

interface RichTextEditorProps {
  note?: Note;
  onUpdate: (updates: Partial<Note>) => void;
  people: Person[];
}

export default function RichTextEditor({ note, onUpdate, people }: RichTextEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }) => {
            return people
              .filter(person => 
                person.name.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 5)
              .map(person => ({
                id: person.id,
                label: person.name,
              }));
          },
        },
      }),
    ],
    content: note?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      onUpdate({ content });
      setLastSaved(new Date());
    },
  });

  useEffect(() => {
    if (note && editor) {
      if (note.title !== title) {
        setTitle(note.title || '');
      }
      if (note.content !== editor.getHTML()) {
        editor.commands.setContent(note.content || '');
      }
    }
  }, [note, editor, title]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onUpdate({ title: newTitle });
    setLastSaved(new Date());
  };

  const formatWordCount = (content: string) => {
    const text = content.replace(/<[^>]*>/g, '');
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Note Title */}
      <div className="mb-8">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="text-3xl font-bold border-none shadow-none p-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
        />
        
        {/* Note Metadata */}
        <div className="flex items-center space-x-4 mt-3 text-sm text-muted-foreground">
          {note?.updatedAt && (
            <span>
              Last edited {new Date(note.updatedAt).toLocaleDateString()}
              {lastSaved && (
                <span className="text-accent ml-2">• Saved</span>
              )}
            </span>
          )}
          <span>•</span>
          <span>{formatWordCount(editor.getHTML())} words</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center space-x-1 mb-4 pb-4 border-b border-border">
        <Button
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        
        <Button
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-2" />

        <Button
          variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-2" />

        <Button
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-2" />

        <Button
          variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive('code') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent 
          editor={editor} 
          className="prose prose-sm max-w-none focus:outline-none"
        />
        
        {/* Add Block Button */}
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              const { from, to } = editor.state.selection;
              editor.chain().focus().insertContentAt(to, '<p></p>').run();
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add block
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-xs text-muted-foreground">
        <p>Type @ to mention people • Use # for headings • ** for bold • * for italic</p>
      </div>
    </div>
  );
}

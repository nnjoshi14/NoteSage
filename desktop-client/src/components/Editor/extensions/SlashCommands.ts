import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import tippy, { Instance as TippyInstance } from 'tippy.js';

interface SlashCommand {
  title: string;
  description: string;
  icon: string;
  command: (editor: any) => void;
  keywords?: string[];
}

const slashCommands: SlashCommand[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    keywords: ['h1', 'heading', 'title'],
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    keywords: ['h2', 'heading', 'subtitle'],
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    keywords: ['h3', 'heading'],
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: '•',
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
    keywords: ['ul', 'list', 'bullet'],
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    keywords: ['ol', 'list', 'numbered', 'ordered'],
  },
  {
    title: 'Task List',
    description: 'Create a task list with checkboxes',
    icon: '☑',
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
    keywords: ['todo', 'task', 'checkbox', 'checklist'],
  },
  {
    title: 'Quote',
    description: 'Create a blockquote',
    icon: '"',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    keywords: ['quote', 'blockquote', 'citation'],
  },
  {
    title: 'Code Block',
    description: 'Create a code block with syntax highlighting',
    icon: '</>',
    command: (editor) => editor.chain().focus().setCodeBlock().run(),
    keywords: ['code', 'codeblock', 'syntax'],
  },
  {
    title: 'Table',
    description: 'Insert a table',
    icon: '📊',
    command: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    keywords: ['table', 'grid'],
  },
  {
    title: 'Horizontal Rule',
    description: 'Insert a horizontal divider',
    icon: '―',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    keywords: ['hr', 'divider', 'separator', 'line'],
  },
  {
    title: 'Info Callout',
    description: 'Create an info callout box',
    icon: 'ℹ️',
    command: (editor) => editor.chain().focus().insertContent({
      type: 'callout',
      attrs: { type: 'info' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Your info content here...' }] }]
    }).run(),
    keywords: ['callout', 'info', 'note', 'box'],
  },
  {
    title: 'Warning Callout',
    description: 'Create a warning callout box',
    icon: '⚠️',
    command: (editor) => editor.chain().focus().insertContent({
      type: 'callout',
      attrs: { type: 'warning' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Your warning content here...' }] }]
    }).run(),
    keywords: ['callout', 'warning', 'caution', 'box'],
  },
  {
    title: 'Error Callout',
    description: 'Create an error callout box',
    icon: '❌',
    command: (editor) => editor.chain().focus().insertContent({
      type: 'callout',
      attrs: { type: 'error' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Your error content here...' }] }]
    }).run(),
    keywords: ['callout', 'error', 'danger', 'box'],
  },
  {
    title: 'Success Callout',
    description: 'Create a success callout box',
    icon: '✅',
    command: (editor) => editor.chain().focus().insertContent({
      type: 'callout',
      attrs: { type: 'success' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Your success content here...' }] }]
    }).run(),
    keywords: ['callout', 'success', 'check', 'box'],
  },
  {
    title: 'Mermaid Diagram',
    description: 'Insert a Mermaid diagram',
    icon: '📈',
    command: (editor) => {
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
    },
    keywords: ['mermaid', 'diagram', 'flowchart', 'graph'],
  },
  {
    title: 'Image',
    description: 'Insert an image',
    icon: '🖼️',
    command: (editor) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
    keywords: ['image', 'img', 'picture', 'photo'],
  },
  {
    title: 'Link',
    description: 'Insert a link',
    icon: '🔗',
    command: (editor) => {
      const url = window.prompt('Enter URL:');
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    },
    keywords: ['link', 'url', 'href'],
  },
];

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('slashCommands'),
        state: {
          init() {
            return {
              active: false,
              range: { from: 0, to: 0 },
              query: '',
              decorations: DecorationSet.empty,
            };
          },
          apply(tr, prev) {
            const { selection, doc } = tr.state;
            const { from, to } = selection;
            
            // Check if we're at the start of a line and typed '/'
            const $from = doc.resolve(from);
            const textBefore = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 20),
              $from.parentOffset,
              null,
              '\ufffc'
            );
            
            const match = textBefore.match(/\/([^/\s]*)$/);
            
            if (match && from === to) {
              const query = match[1];
              const startPos = from - match[0].length;
              
              return {
                active: true,
                range: { from: startPos, to: from },
                query,
                decorations: DecorationSet.create(doc, [
                  Decoration.inline(startPos, from, {
                    class: 'slash-command-query',
                  }),
                ]),
              };
            }
            
            return {
              active: false,
              range: { from: 0, to: 0 },
              query: '',
              decorations: DecorationSet.empty,
            };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations;
          },
          handleKeyDown(view, event) {
            const state = this.getState(view.state);
            
            if (!state?.active) return false;
            
            if (event.key === 'Escape') {
              view.dispatch(view.state.tr.setMeta('slashCommands', { hide: true }));
              return true;
            }
            
            return false;
          },
        },
        view(editorView) {
          let popup: TippyInstance | null = null;
          let selectedIndex = 0;
          let filteredCommands: SlashCommand[] = [];
          
          const createPopup = () => {
            const div = document.createElement('div');
            div.className = 'slash-commands-popup';
            
            popup = tippy(editorView.dom, {
              content: div,
              trigger: 'manual',
              placement: 'bottom-start',
              interactive: true,
              arrow: false,
              offset: [0, 8],
              theme: 'light-border',
              maxWidth: 320,
            });
            
            return div;
          };
          
          const updatePopup = (query: string, range: { from: number; to: number }) => {
            if (!popup) {
              createPopup();
            }
            
            // Filter commands based on query
            filteredCommands = slashCommands.filter(command => {
              const searchText = `${command.title} ${command.description} ${command.keywords?.join(' ') || ''}`.toLowerCase();
              return searchText.includes(query.toLowerCase());
            });
            
            selectedIndex = 0;
            
            // Update popup content
            const content = popup!.popper.querySelector('.slash-commands-popup') as HTMLElement;
            content.innerHTML = '';
            
            if (filteredCommands.length === 0) {
              content.innerHTML = '<div class="slash-command-item no-results">No commands found</div>';
            } else {
              filteredCommands.forEach((command, index) => {
                const item = document.createElement('div');
                item.className = `slash-command-item ${index === selectedIndex ? 'selected' : ''}`;
                item.innerHTML = `
                  <div class="slash-command-icon">${command.icon}</div>
                  <div class="slash-command-content">
                    <div class="slash-command-title">${command.title}</div>
                    <div class="slash-command-description">${command.description}</div>
                  </div>
                `;
                
                item.addEventListener('click', () => {
                  executeCommand(command, range);
                });
                
                content.appendChild(item);
              });
            }
            
            // Position popup
            const coords = editorView.coordsAtPos(range.from);
            popup!.setProps({
              getReferenceClientRect: () => ({
                width: 0,
                height: 0,
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                right: coords.left,
              }),
            });
            
            popup!.show();
          };
          
          const executeCommand = (command: SlashCommand, range: { from: number; to: number }) => {
            // Remove the slash command text
            const tr = editorView.state.tr.delete(range.from, range.to);
            editorView.dispatch(tr);
            
            // Execute the command
            command.command(this.editor);
            
            hidePopup();
          };
          
          const hidePopup = () => {
            if (popup) {
              popup.hide();
            }
            selectedIndex = 0;
            filteredCommands = [];
          };
          
          const handleKeyDown = (event: KeyboardEvent) => {
            const state = this.getState(editorView.state);
            if (!state?.active || filteredCommands.length === 0) return false;
            
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              selectedIndex = (selectedIndex + 1) % filteredCommands.length;
              updateSelection();
              return true;
            }
            
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              selectedIndex = selectedIndex === 0 ? filteredCommands.length - 1 : selectedIndex - 1;
              updateSelection();
              return true;
            }
            
            if (event.key === 'Enter') {
              event.preventDefault();
              if (filteredCommands[selectedIndex]) {
                executeCommand(filteredCommands[selectedIndex], state.range);
              }
              return true;
            }
            
            return false;
          };
          
          const updateSelection = () => {
            const items = popup?.popper.querySelectorAll('.slash-command-item');
            items?.forEach((item, index) => {
              item.classList.toggle('selected', index === selectedIndex);
            });
          };
          
          // Add global keydown listener
          document.addEventListener('keydown', handleKeyDown);
          
          return {
            update: (view, prevState) => {
              const state = this.getState(view.state);
              const prevPluginState = this.getState(prevState);
              
              if (state?.active && state.query !== prevPluginState?.query) {
                updatePopup(state.query, state.range);
              } else if (!state?.active && prevPluginState?.active) {
                hidePopup();
              }
            },
            destroy: () => {
              document.removeEventListener('keydown', handleKeyDown);
              if (popup) {
                popup.destroy();
              }
            },
          };
        },
      }),
    ];
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          class: {
            default: null,
            parseHTML: element => element.getAttribute('class'),
            renderHTML: attributes => {
              if (!attributes.class) return {};
              return { class: attributes.class };
            },
          },
        },
      },
    ];
  },
});
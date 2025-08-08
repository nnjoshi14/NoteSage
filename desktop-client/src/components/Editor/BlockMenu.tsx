import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import './BlockMenu.css';

interface BlockMenuProps {
  editor: Editor;
}

export const BlockMenu: React.FC<BlockMenuProps> = ({ editor }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const { selection } = editor.state;
      const { from } = selection;
      
      // Get the DOM position of the current selection
      const coords = editor.view.coordsAtPos(from);
      const editorRect = editor.view.dom.getBoundingClientRect();
      
      setPosition({
        top: coords.top - editorRect.top,
        left: -40, // Position to the left of the content
      });
    };

    editor.on('selectionUpdate', handleSelectionChange);
    editor.on('transaction', handleSelectionChange);

    return () => {
      editor.off('selectionUpdate', handleSelectionChange);
      editor.off('transaction', handleSelectionChange);
    };
  }, [editor]);

  const handleMenuAction = (action: string) => {
    const { selection } = editor.state;
    const { from, to } = selection;

    switch (action) {
      case 'duplicate':
        duplicateBlock();
        break;
      case 'delete':
        deleteBlock();
        break;
      case 'moveUp':
        moveBlockUp();
        break;
      case 'moveDown':
        moveBlockDown();
        break;
      case 'addAbove':
        addBlockAbove();
        break;
      case 'addBelow':
        addBlockBelow();
        break;
    }
    
    setShowMenu(false);
  };

  const duplicateBlock = () => {
    const { selection, doc } = editor.state;
    const { from, to } = selection;
    
    // Find the current block
    const resolvedFrom = doc.resolve(from);
    const blockStart = resolvedFrom.start(resolvedFrom.depth);
    const blockEnd = resolvedFrom.end(resolvedFrom.depth);
    
    // Get the block content
    const blockContent = doc.slice(blockStart, blockEnd);
    
    // Insert the duplicated content after the current block
    editor.chain()
      .focus()
      .setTextSelection(blockEnd)
      .insertContent(blockContent.content.toJSON())
      .run();
  };

  const deleteBlock = () => {
    const { selection, doc } = editor.state;
    const { from } = selection;
    
    // Find the current block
    const resolvedFrom = doc.resolve(from);
    const blockStart = resolvedFrom.start(resolvedFrom.depth);
    const blockEnd = resolvedFrom.end(resolvedFrom.depth);
    
    // Delete the block
    editor.chain()
      .focus()
      .setTextSelection(blockStart, blockEnd)
      .deleteSelection()
      .run();
  };

  const moveBlockUp = () => {
    const { selection, doc } = editor.state;
    const { from } = selection;
    
    const resolvedFrom = doc.resolve(from);
    const currentBlockStart = resolvedFrom.start(resolvedFrom.depth);
    const currentBlockEnd = resolvedFrom.end(resolvedFrom.depth);
    
    // Find the previous block
    const prevBlockEnd = currentBlockStart - 1;
    if (prevBlockEnd <= 0) return; // Already at the top
    
    const resolvedPrev = doc.resolve(prevBlockEnd);
    const prevBlockStart = resolvedPrev.start(resolvedPrev.depth);
    
    // Get both blocks' content
    const currentBlock = doc.slice(currentBlockStart, currentBlockEnd);
    const prevBlock = doc.slice(prevBlockStart, prevBlockEnd);
    
    // Replace both blocks with swapped content
    editor.chain()
      .focus()
      .setTextSelection(prevBlockStart, currentBlockEnd)
      .deleteSelection()
      .insertContent(currentBlock.content.toJSON())
      .insertContent(prevBlock.content.toJSON())
      .run();
  };

  const moveBlockDown = () => {
    const { selection, doc } = editor.state;
    const { from } = selection;
    
    const resolvedFrom = doc.resolve(from);
    const currentBlockStart = resolvedFrom.start(resolvedFrom.depth);
    const currentBlockEnd = resolvedFrom.end(resolvedFrom.depth);
    
    // Find the next block
    const nextBlockStart = currentBlockEnd + 1;
    if (nextBlockStart >= doc.content.size) return; // Already at the bottom
    
    const resolvedNext = doc.resolve(nextBlockStart);
    const nextBlockEnd = resolvedNext.end(resolvedNext.depth);
    
    // Get both blocks' content
    const currentBlock = doc.slice(currentBlockStart, currentBlockEnd);
    const nextBlock = doc.slice(nextBlockStart, nextBlockEnd);
    
    // Replace both blocks with swapped content
    editor.chain()
      .focus()
      .setTextSelection(currentBlockStart, nextBlockEnd)
      .deleteSelection()
      .insertContent(nextBlock.content.toJSON())
      .insertContent(currentBlock.content.toJSON())
      .run();
  };

  const addBlockAbove = () => {
    const { selection, doc } = editor.state;
    const { from } = selection;
    
    const resolvedFrom = doc.resolve(from);
    const blockStart = resolvedFrom.start(resolvedFrom.depth);
    
    // Insert a new paragraph above the current block
    editor.chain()
      .focus()
      .setTextSelection(blockStart)
      .insertContent({ type: 'paragraph' })
      .setTextSelection(blockStart)
      .run();
  };

  const addBlockBelow = () => {
    const { selection, doc } = editor.state;
    const { from } = selection;
    
    const resolvedFrom = doc.resolve(from);
    const blockEnd = resolvedFrom.end(resolvedFrom.depth);
    
    // Insert a new paragraph below the current block
    editor.chain()
      .focus()
      .setTextSelection(blockEnd)
      .insertContent({ type: 'paragraph' })
      .run();
  };

  return (
    <div 
      className="block-menu" 
      style={{ 
        top: position.top,
        left: position.left,
      }}
    >
      <button
        ref={triggerRef}
        className="block-menu-trigger"
        onClick={() => setShowMenu(!showMenu)}
        title="Block actions"
      />
      
      {showMenu && (
        <div ref={menuRef} className="block-menu-dropdown">
          <button
            className="block-menu-item"
            onClick={() => handleMenuAction('addAbove')}
            title="Add block above"
          >
            ⬆️ Add Above
          </button>
          <button
            className="block-menu-item"
            onClick={() => handleMenuAction('addBelow')}
            title="Add block below"
          >
            ⬇️ Add Below
          </button>
          <div className="block-menu-separator" />
          <button
            className="block-menu-item"
            onClick={() => handleMenuAction('duplicate')}
            title="Duplicate block"
          >
            📋 Duplicate
          </button>
          <button
            className="block-menu-item"
            onClick={() => handleMenuAction('moveUp')}
            title="Move block up"
          >
            ⬆️ Move Up
          </button>
          <button
            className="block-menu-item"
            onClick={() => handleMenuAction('moveDown')}
            title="Move block down"
          >
            ⬇️ Move Down
          </button>
          <div className="block-menu-separator" />
          <button
            className="block-menu-item delete"
            onClick={() => handleMenuAction('delete')}
            title="Delete block"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
};
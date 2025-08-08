import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import mermaid from 'mermaid';
import './MermaidNodeView.css';

interface MermaidNodeViewProps {
  node: {
    attrs: {
      code: string;
    };
  };
  updateAttributes: (attrs: any) => void;
  selected: boolean;
  editor: any;
}

export const MermaidNodeView: React.FC<MermaidNodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(node.attrs.code);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    });
  }, []);

  // Render diagram when code changes
  useEffect(() => {
    if (!isEditing && code && diagramRef.current) {
      renderDiagram();
    }
  }, [code, isEditing]);

  const renderDiagram = async () => {
    if (!diagramRef.current || !code.trim()) return;

    setIsRendering(true);
    setError(null);

    try {
      // Clear previous content
      diagramRef.current.innerHTML = '';
      
      // Generate unique ID for this diagram
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Validate and render the diagram
      const { svg } = await mermaid.render(id, code);
      diagramRef.current.innerHTML = svg;
      
      // Make the SVG responsive
      const svgElement = diagramRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.style.maxWidth = '100%';
        svgElement.style.height = 'auto';
      }
    } catch (err) {
      console.error('Mermaid rendering error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      diagramRef.current.innerHTML = `
        <div class="mermaid-error">
          <div class="error-icon">⚠️</div>
          <div class="error-message">
            <strong>Diagram Error</strong><br>
            ${err instanceof Error ? err.message : 'Failed to render diagram'}
          </div>
        </div>
      `;
    } finally {
      setIsRendering(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(0, 0);
      }
    }, 0);
  };

  const handleSave = () => {
    updateAttributes({ code });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCode(node.attrs.code);
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleCancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSave();
    }
  };

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(event.target.value);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [code, isEditing]);

  return (
    <NodeViewWrapper className={`mermaid-node-view ${selected ? 'selected' : ''}`}>
      <div className="mermaid-container">
        {isEditing ? (
          <div className="mermaid-editor">
            <div className="mermaid-editor-header">
              <span className="mermaid-title">📈 Edit Mermaid Diagram</span>
              <div className="mermaid-actions">
                <button
                  className="mermaid-button save"
                  onClick={handleSave}
                  title="Save (Ctrl+Enter)"
                >
                  ✓ Save
                </button>
                <button
                  className="mermaid-button cancel"
                  onClick={handleCancel}
                  title="Cancel (Escape)"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="mermaid-textarea"
              placeholder="Enter your Mermaid diagram code here..."
              spellCheck={false}
            />
            <div className="mermaid-help">
              <small>
                Press <kbd>Ctrl+Enter</kbd> to save, <kbd>Escape</kbd> to cancel.
                <a
                  href="https://mermaid-js.github.io/mermaid/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mermaid-docs-link"
                >
                  View Mermaid documentation
                </a>
              </small>
            </div>
          </div>
        ) : (
          <div className="mermaid-display">
            <div className="mermaid-header">
              <span className="mermaid-title">📈 Mermaid Diagram</span>
              <button
                className="mermaid-edit-button"
                onClick={handleEdit}
                title="Edit diagram"
              >
                ✏️ Edit
              </button>
            </div>
            <div className="mermaid-content">
              {isRendering ? (
                <div className="mermaid-loading">
                  <div className="loading-spinner"></div>
                  <span>Rendering diagram...</span>
                </div>
              ) : (
                <div ref={diagramRef} className="mermaid-diagram" />
              )}
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};
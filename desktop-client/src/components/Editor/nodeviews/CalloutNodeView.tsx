import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import './CalloutNodeView.css';

interface CalloutNodeViewProps {
  node: {
    attrs: {
      type: 'info' | 'warning' | 'error' | 'success';
    };
  };
  updateAttributes: (attrs: any) => void;
  selected: boolean;
  editor: any;
}

const calloutConfig = {
  info: {
    icon: 'ℹ️',
    title: 'Info',
    className: 'info',
  },
  warning: {
    icon: '⚠️',
    title: 'Warning',
    className: 'warning',
  },
  error: {
    icon: '❌',
    title: 'Error',
    className: 'error',
  },
  success: {
    icon: '✅',
    title: 'Success',
    className: 'success',
  },
};

export const CalloutNodeView: React.FC<CalloutNodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
}) => {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const currentType = node.attrs.type || 'info';
  const config = calloutConfig[currentType];

  const handleTypeChange = (newType: 'info' | 'warning' | 'error' | 'success') => {
    updateAttributes({ type: newType });
    setShowTypeSelector(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Allow normal editing within the callout content
    if (event.key === 'Escape') {
      setShowTypeSelector(false);
    }
  };

  return (
    <NodeViewWrapper
      className={`callout-node-view ${selected ? 'selected' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <div className={`callout-container ${config.className}`}>
        <div className="callout-header">
          <div className="callout-type-selector">
            <button
              className="callout-type-button"
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              title="Change callout type"
            >
              <span className="callout-icon">{config.icon}</span>
              <span className="callout-title">{config.title}</span>
              <span className="callout-dropdown-arrow">▼</span>
            </button>
            
            {showTypeSelector && (
              <div className="callout-type-menu">
                {Object.entries(calloutConfig).map(([type, typeConfig]) => (
                  <button
                    key={type}
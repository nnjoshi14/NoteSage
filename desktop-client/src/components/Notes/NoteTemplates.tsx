import React, { useState, useEffect } from 'react';
import './NoteTemplates.css';

interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: string[];
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NoteTemplatesProps {
  onTemplateSelect: (template: NoteTemplate, variables?: Record<string, string>) => void;
  onClose: () => void;
}

const NoteTemplates: React.FC<NoteTemplatesProps> = ({ onTemplateSelect, onClose }) => {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Built-in templates
  const builtInTemplates: NoteTemplate[] = [
    {
      id: 'meeting-notes',
      name: 'Meeting Notes',
      description: 'Template for meeting notes with agenda and action items',
      category: 'Meeting',
      content: `# {{meeting_title}}

**Date:** {{date}}
**Time:** {{time}}
**Attendees:** {{attendees}}

## Agenda
{{agenda}}

## Discussion
{{discussion}}

## Action Items
- [ ][t1] {{action_item_1}} @{{assignee_1}} {{due_date_1}}
- [ ][t2] {{action_item_2}} @{{assignee_2}} {{due_date_2}}

## Next Steps
{{next_steps}}`,
      variables: ['meeting_title', 'date', 'time', 'attendees', 'agenda', 'discussion', 'action_item_1', 'assignee_1', 'due_date_1', 'action_item_2', 'assignee_2', 'due_date_2', 'next_steps'],
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'project-planning',
      name: 'Project Planning',
      description: 'Template for project planning and tracking',
      category: 'Project',
      content: `# {{project_name}}

## Overview
{{project_overview}}

## Objectives
{{objectives}}

## Timeline
- **Start Date:** {{start_date}}
- **End Date:** {{end_date}}
- **Milestones:** {{milestones}}

## Resources
{{resources}}

## Tasks
- [ ][t1] {{task_1}} @{{assignee_1}} {{due_date_1}}
- [ ][t2] {{task_2}} @{{assignee_2}} {{due_date_2}}
- [ ][t3] {{task_3}} @{{assignee_3}} {{due_date_3}}

## Risks
{{risks}}

## Success Criteria
{{success_criteria}}`,
      variables: ['project_name', 'project_overview', 'objectives', 'start_date', 'end_date', 'milestones', 'resources', 'task_1', 'assignee_1', 'due_date_1', 'task_2', 'assignee_2', 'due_date_2', 'task_3', 'assignee_3', 'due_date_3', 'risks', 'success_criteria'],
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'research-notes',
      name: 'Research Notes',
      description: 'Template for research and study notes',
      category: 'Research',
      content: `# {{research_topic}}

## Research Question
{{research_question}}

## Sources
{{sources}}

## Key Findings
{{key_findings}}

## Methodology
{{methodology}}

## Data/Evidence
{{data_evidence}}

## Analysis
{{analysis}}

## Conclusions
{{conclusions}}

## Further Research
- [ ][t1] {{research_task_1}} {{due_date_1}}
- [ ][t2] {{research_task_2}} {{due_date_2}}

## References
{{references}}`,
      variables: ['research_topic', 'research_question', 'sources', 'key_findings', 'methodology', 'data_evidence', 'analysis', 'conclusions', 'research_task_1', 'due_date_1', 'research_task_2', 'due_date_2', 'references'],
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'daily-journal',
      name: 'Daily Journal',
      description: 'Template for daily journaling and reflection',
      category: 'Personal',
      content: `# Daily Journal - {{date}}

## Today's Goals
{{todays_goals}}

## What Happened
{{what_happened}}

## Accomplishments
{{accomplishments}}

## Challenges
{{challenges}}

## Lessons Learned
{{lessons_learned}}

## Tomorrow's Priorities
- [ ][t1] {{priority_1}} {{due_date_1}}
- [ ][t2] {{priority_2}} {{due_date_2}}
- [ ][t3] {{priority_3}} {{due_date_3}}

## Gratitude
{{gratitude}}

## Reflection
{{reflection}}`,
      variables: ['date', 'todays_goals', 'what_happened', 'accomplishments', 'challenges', 'lessons_learned', 'priority_1', 'due_date_1', 'priority_2', 'due_date_2', 'priority_3', 'due_date_3', 'gratitude', 'reflection'],
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      // Load custom templates from cache
      const customTemplates = await window.electronAPI.getCachedNotes();
      const templateNotes = customTemplates.filter((note: any) => 
        note.category === 'Template' || note.tags?.includes('template')
      );

      const customTemplateObjects: NoteTemplate[] = templateNotes.map((note: any) => ({
        id: note.id,
        name: note.title,
        description: note.content.substring(0, 100) + '...',
        category: 'Custom',
        content: note.content,
        variables: extractVariables(note.content),
        isBuiltIn: false,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }));

      setTemplates([...builtInTemplates, ...customTemplateObjects]);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates(builtInTemplates);
    } finally {
      setIsLoading(false);
    }
  };

  const extractVariables = (content: string): string[] => {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  };

  const categories = Array.from(new Set(templates.map(t => t.category)));

  const filteredTemplates = templates.filter(template => {
    if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !template.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    if (selectedCategory && template.category !== selectedCategory) {
      return false;
    }
    
    return true;
  });

  const handleTemplateSelect = (template: NoteTemplate) => {
    setSelectedTemplate(template);
    
    // Initialize variables with default values
    const initialVariables: Record<string, string> = {};
    template.variables.forEach(variable => {
      if (variable === 'date') {
        initialVariables[variable] = new Date().toLocaleDateString();
      } else if (variable === 'time') {
        initialVariables[variable] = new Date().toLocaleTimeString();
      } else {
        initialVariables[variable] = '';
      }
    });
    setVariables(initialVariables);
  };

  const handleVariableChange = (variable: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [variable]: value,
    }));
  };

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onTemplateSelect(selectedTemplate, variables);
    }
  };

  const renderVariableForm = () => {
    if (!selectedTemplate || selectedTemplate.variables.length === 0) {
      return null;
    }

    return (
      <div className="template-variables">
        <h4>Fill in template variables:</h4>
        <div className="variables-form">
          {selectedTemplate.variables.map(variable => (
            <div key={variable} className="form-group">
              <label className="form-label">
                {variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </label>
              <input
                type="text"
                className="form-control"
                value={variables[variable] || ''}
                onChange={(e) => handleVariableChange(variable, e.target.value)}
                placeholder={`Enter ${variable.replace(/_/g, ' ')}`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="note-templates-modal">
        <div className="modal-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="note-templates-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Note Templates</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!selectedTemplate ? (
            <>
              {/* Search and filters */}
              <div className="templates-filters">
                <div className="search-box">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="category-filter">
                  <select
                    className="form-control"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Templates list */}
              <div className="templates-list">
                {filteredTemplates.length === 0 ? (
                  <div className="empty-state">
                    <p>No templates found matching your criteria.</p>
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      className="template-item"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="template-header">
                        <h4>{template.name}</h4>
                        <span className={`template-badge ${template.isBuiltIn ? 'built-in' : 'custom'}`}>
                          {template.isBuiltIn ? 'Built-in' : 'Custom'}
                        </span>
                      </div>
                      <p className="template-description">{template.description}</p>
                      <div className="template-meta">
                        <span className="template-category">{template.category}</span>
                        {template.variables.length > 0 && (
                          <span className="template-variables-count">
                            {template.variables.length} variables
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {/* Template preview and variables */}
              <div className="template-preview">
                <div className="template-preview-header">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedTemplate(null)}
                  >
                    ← Back to Templates
                  </button>
                  <h4>{selectedTemplate.name}</h4>
                </div>

                <div className="template-preview-content">
                  <div className="template-content">
                    <h5>Template Preview:</h5>
                    <pre className="template-code">{selectedTemplate.content}</pre>
                  </div>

                  {renderVariableForm()}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {selectedTemplate ? (
            <>
              <button className="btn btn-secondary" onClick={() => setSelectedTemplate(null)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleUseTemplate}>
                Use Template
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteTemplates;
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import KnowledgeGraph, { GraphNode } from './KnowledgeGraph';
import { Note } from '../../stores/slices/notesSlice';
import { Person } from '../../stores/slices/peopleSlice';
import './GraphPage.css';

const GraphPage: React.FC = () => {
  const navigate = useNavigate();

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Handle single click - could show details or highlight connections
    console.log('Node clicked:', node);
  }, []);

  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    // Handle double click - navigate to the item
    if (node.type === 'note') {
      const note = node.data as Note;
      navigate(`/notes/${note.id}`);
    } else if (node.type === 'person') {
      const person = node.data as Person;
      navigate(`/people/${person.id}`);
    }
  }, [navigate]);

  return (
    <div className="graph-page">
      <div className="graph-page-header">
        <h1>Knowledge Graph</h1>
        <p>Explore connections between your notes and people</p>
      </div>
      
      <div className="graph-page-content">
        <KnowledgeGraph
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          className="main-graph"
        />
      </div>
    </div>
  );
};

export default GraphPage;
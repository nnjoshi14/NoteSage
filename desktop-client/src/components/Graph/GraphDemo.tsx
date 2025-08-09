import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import GraphPage from './GraphPage';
import notesReducer from '../../stores/slices/notesSlice';
import peopleReducer from '../../stores/slices/peopleSlice';

// Demo data
const demoNotes = [
  {
    id: '1',
    title: 'Team Meeting Notes',
    content: 'Had a productive meeting with @John Smith and @Sarah Johnson. Discussed #[[Project Roadmap]] and next steps for the quarter.',
    category: 'Meeting',
    tags: ['work', 'team', 'planning'],
    folder_path: '/',
    is_archived: false,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    version: 1,
  },
  {
    id: '2',
    title: 'Project Roadmap',
    content: 'Q1 2024 goals and milestones. Need to coordinate with @John Smith on technical requirements and @Mike Wilson on project timeline.',
    category: 'Note',
    tags: ['project', 'planning', 'roadmap'],
    folder_path: '/projects',
    is_archived: false,
    is_pinned: true,
    is_favorite: true,
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T09:00:00Z',
    version: 1,
  },
  {
    id: '3',
    title: 'User Research Findings',
    content: 'Key insights from user interviews. Shared findings with @Sarah Johnson for design input. References #[[Design System]] updates.',
    category: 'Research',
    tags: ['research', 'ux', 'users'],
    folder_path: '/research',
    is_archived: false,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-13T14:00:00Z',
    updated_at: '2024-01-13T14:00:00Z',
    version: 1,
  },
  {
    id: '4',
    title: 'Design System',
    content: 'Component library and design guidelines. Updated based on feedback from @Sarah Johnson and #[[User Research Findings]].',
    category: 'Design',
    tags: ['design', 'system', 'components'],
    folder_path: '/design',
    is_archived: false,
    is_pinned: false,
    is_favorite: true,
    created_at: '2024-01-12T11:00:00Z',
    updated_at: '2024-01-12T11:00:00Z',
    version: 1,
  },
];

const demoPeople = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@company.com',
    company: 'Tech Corp',
    title: 'Senior Developer',
    phone: '+1-555-0123',
    linkedin_url: 'https://linkedin.com/in/johnsmith',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    company: 'Design Studio',
    title: 'UX Designer',
    phone: '+1-555-0124',
    linkedin_url: 'https://linkedin.com/in/sarahjohnson',
    avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    created_at: '2024-01-11T10:00:00Z',
    updated_at: '2024-01-11T10:00:00Z',
  },
  {
    id: '3',
    name: 'Mike Wilson',
    email: 'mike.wilson@company.com',
    company: 'Tech Corp',
    title: 'Project Manager',
    phone: '+1-555-0125',
    linkedin_url: 'https://linkedin.com/in/mikewilson',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    created_at: '2024-01-12T10:00:00Z',
    updated_at: '2024-01-12T10:00:00Z',
  },
];

const demoStore = configureStore({
  reducer: {
    notes: notesReducer,
    people: peopleReducer,
  },
  preloadedState: {
    notes: {
      notes: demoNotes,
      currentNote: null,
      isLoading: false,
      filters: {},
    },
    people: {
      people: demoPeople,
      currentPerson: null,
      isLoading: false,
      filters: {},
    },
  },
});

const GraphDemo: React.FC = () => {
  return (
    <Provider store={demoStore}>
      <BrowserRouter>
        <div style={{ height: '100vh', width: '100vw' }}>
          <GraphPage />
        </div>
      </BrowserRouter>
    </Provider>
  );
};

export default GraphDemo;
import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { checkConnectionStatus } from '@/stores/slices/connectionSlice';
import Layout from '@/components/Layout/Layout';
import NotesPage from '@/components/Notes/NotesPage';
import PeoplePage from '@/components/People/PeoplePage';
import TodosPage from '@/components/Todos/TodosPage';
import SettingsPage from '@/components/Settings/SettingsPage';
import ConnectionSetup from '@/components/Connection/ConnectionSetup';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { connected, isInitialized } = useAppSelector(state => state.connection);

  useEffect(() => {
    // Check connection status on app start
    dispatch(checkConnectionStatus());

    // Setup menu event listeners
    window.electronAPI.onMenuNewNote(() => {
      // Handle new note creation
      console.log('New note requested from menu');
    });

    window.electronAPI.onMenuSave(() => {
      // Handle save action
      console.log('Save requested from menu');
    });

    return () => {
      window.electronAPI.removeAllListeners('menu-new-note');
      window.electronAPI.removeAllListeners('menu-save');
    };
  }, [dispatch]);

  if (!isInitialized) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Initializing NoteSage...</p>
      </div>
    );
  }

  if (!connected) {
    return <ConnectionSetup />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<NotesPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/todos" element={<TodosPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
};

export default App;
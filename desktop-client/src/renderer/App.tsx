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
    const handleMenuNewNote = () => {
      console.log('New note requested from menu');
      // TODO: Dispatch action to create new note
    };

    const handleMenuNewPerson = () => {
      console.log('New person requested from menu');
      // TODO: Dispatch action to create new person
    };

    const handleMenuSave = () => {
      console.log('Save requested from menu');
      // TODO: Dispatch action to save current item
    };

    const handleMenuPreferences = () => {
      console.log('Preferences requested from menu');
      // TODO: Navigate to settings page
    };

    const handleMenuViewNotes = () => {
      console.log('View notes requested from menu');
      // TODO: Navigate to notes page
    };

    const handleMenuViewPeople = () => {
      console.log('View people requested from menu');
      // TODO: Navigate to people page
    };

    const handleMenuViewTodos = () => {
      console.log('View todos requested from menu');
      // TODO: Navigate to todos page
    };

    const handleMenuSyncComplete = () => {
      console.log('Sync completed');
      // TODO: Show success notification
    };

    const handleMenuSyncError = (event: any, error: string) => {
      console.error('Sync error:', error);
      // TODO: Show error notification
    };

    const handleMainProcessError = (event: any, error: any) => {
      console.error('Main process error:', error);
      // TODO: Show error dialog or notification
    };

    // Register event listeners
    window.electronAPI.onMenuEvent('menu-new-note', handleMenuNewNote);
    window.electronAPI.onMenuEvent('menu-new-person', handleMenuNewPerson);
    window.electronAPI.onMenuEvent('menu-save', handleMenuSave);
    window.electronAPI.onMenuEvent('menu-preferences', handleMenuPreferences);
    window.electronAPI.onMenuEvent('menu-view-notes', handleMenuViewNotes);
    window.electronAPI.onMenuEvent('menu-view-people', handleMenuViewPeople);
    window.electronAPI.onMenuEvent('menu-view-todos', handleMenuViewTodos);
    window.electronAPI.onMenuEvent('menu-sync-complete', handleMenuSyncComplete);
    window.electronAPI.onMenuEvent('menu-sync-error', handleMenuSyncError);
    window.electronAPI.onMenuEvent('main-process-error', handleMainProcessError);

    return () => {
      // Cleanup event listeners
      window.electronAPI.removeAllListeners('menu-new-note');
      window.electronAPI.removeAllListeners('menu-new-person');
      window.electronAPI.removeAllListeners('menu-save');
      window.electronAPI.removeAllListeners('menu-preferences');
      window.electronAPI.removeAllListeners('menu-view-notes');
      window.electronAPI.removeAllListeners('menu-view-people');
      window.electronAPI.removeAllListeners('menu-view-todos');
      window.electronAPI.removeAllListeners('menu-sync-complete');
      window.electronAPI.removeAllListeners('menu-sync-error');
      window.electronAPI.removeAllListeners('main-process-error');
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
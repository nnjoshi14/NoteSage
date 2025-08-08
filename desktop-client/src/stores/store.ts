import { configureStore } from '@reduxjs/toolkit';
import connectionReducer from './slices/connectionSlice';
import notesReducer from './slices/notesSlice';
import peopleReducer from './slices/peopleSlice';
import todosReducer from './slices/todosSlice';
import aiReducer from './slices/aiSlice';
import collaborationReducer from './slices/collaborationSlice';

export const store = configureStore({
  reducer: {
    connection: connectionReducer,
    notes: notesReducer,
    people: peopleReducer,
    todos: todosReducer,
    ai: aiReducer,
    collaboration: collaborationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'connection/connect/fulfilled',
          'connection/checkStatus/fulfilled',
        ],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['connection.config', 'notes.items.*.lastModified'],
      },
      immutableCheck: {
        warnAfter: 128,
      },
    }),
  devTools: process.env.NODE_ENV === 'development' && {
    name: 'NoteSage Desktop',
    trace: true,
    traceLimit: 25,
    actionSanitizer: (action: any) => ({
      ...action,
      // Sanitize sensitive data in development
      payload: action.type.includes('password') || action.type.includes('auth')
        ? { ...action.payload, password: '[REDACTED]' }
        : action.payload,
    }),
    stateSanitizer: (state: any) => ({
      ...state,
      // Sanitize sensitive data in development
      connection: {
        ...state.connection,
        config: state.connection.config
          ? { ...state.connection.config, password: '[REDACTED]' }
          : undefined,
      },
    }),
  },
  enhancers: (defaultEnhancers) => {
    // Add any custom enhancers here
    return defaultEnhancers;
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Hot module replacement disabled for now to avoid TypeScript issues
// TODO: Re-enable with proper typing in future
import { configureStore } from '@reduxjs/toolkit';
import connectionReducer from './slices/connectionSlice';
import notesReducer from './slices/notesSlice';
import peopleReducer from './slices/peopleSlice';
import todosReducer from './slices/todosSlice';

export const store = configureStore({
  reducer: {
    connection: connectionReducer,
    notes: notesReducer,
    people: peopleReducer,
    todos: todosReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Todo {
  id: string;
  note_id: string;
  todo_id: string;
  text: string;
  is_completed: boolean;
  assigned_person_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  sync_status?: 'synced' | 'pending' | 'conflict';
}

export interface TodosState {
  todos: Todo[];
  currentTodo: Todo | null;
  isLoading: boolean;
  error?: string;
  filters: {
    completed?: boolean;
    assigned_person_id?: string;
    note_id?: string;
    search?: string;
  };
}

const initialState: TodosState = {
  todos: [],
  currentTodo: null,
  isLoading: false,
  filters: {},
};

const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    setTodos: (state, action: PayloadAction<Todo[]>) => {
      state.todos = action.payload;
    },
    setCurrentTodo: (state, action: PayloadAction<Todo | null>) => {
      state.currentTodo = action.payload;
    },
    updateCurrentTodo: (state, action: PayloadAction<Partial<Todo>>) => {
      if (state.currentTodo) {
        state.currentTodo = { ...state.currentTodo, ...action.payload };
      }
    },
    setFilters: (state, action: PayloadAction<Partial<TodosState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearError: (state) => {
      state.error = undefined;
    },
    addTodo: (state, action: PayloadAction<Todo>) => {
      state.todos.unshift(action.payload);
    },
    updateTodo: (state, action: PayloadAction<Todo>) => {
      const index = state.todos.findIndex(todo => todo.id === action.payload.id);
      if (index !== -1) {
        state.todos[index] = action.payload;
      }
    },
    removeTodo: (state, action: PayloadAction<string>) => {
      state.todos = state.todos.filter(todo => todo.id !== action.payload);
    },
    toggleTodoCompleted: (state, action: PayloadAction<string>) => {
      const todo = state.todos.find(todo => todo.id === action.payload);
      if (todo) {
        todo.is_completed = !todo.is_completed;
        todo.sync_status = 'pending';
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setTodos,
  setCurrentTodo,
  updateCurrentTodo,
  setFilters,
  clearFilters,
  clearError,
  addTodo,
  updateTodo,
  removeTodo,
  toggleTodoCompleted,
  setLoading,
  setError,
} = todosSlice.actions;

export default todosSlice.reducer;
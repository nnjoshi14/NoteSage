import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  avatar_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  sync_status?: 'synced' | 'pending' | 'conflict';
}

export interface PeopleState {
  people: Person[];
  currentPerson: Person | null;
  isLoading: boolean;
  error?: string;
  filters: {
    search?: string;
    company?: string;
  };
}

const initialState: PeopleState = {
  people: [],
  currentPerson: null,
  isLoading: false,
  filters: {},
};

const peopleSlice = createSlice({
  name: 'people',
  initialState,
  reducers: {
    setPeople: (state, action: PayloadAction<Person[]>) => {
      state.people = action.payload;
    },
    setCurrentPerson: (state, action: PayloadAction<Person | null>) => {
      state.currentPerson = action.payload;
    },
    updateCurrentPerson: (state, action: PayloadAction<Partial<Person>>) => {
      if (state.currentPerson) {
        state.currentPerson = { ...state.currentPerson, ...action.payload };
      }
    },
    setFilters: (state, action: PayloadAction<Partial<PeopleState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearError: (state) => {
      state.error = undefined;
    },
    addPerson: (state, action: PayloadAction<Person>) => {
      state.people.unshift(action.payload);
    },
    updatePerson: (state, action: PayloadAction<Person>) => {
      const index = state.people.findIndex(person => person.id === action.payload.id);
      if (index !== -1) {
        state.people[index] = action.payload;
      }
    },
    removePerson: (state, action: PayloadAction<string>) => {
      state.people = state.people.filter(person => person.id !== action.payload);
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
  setPeople,
  setCurrentPerson,
  updateCurrentPerson,
  setFilters,
  clearFilters,
  clearError,
  addPerson,
  updatePerson,
  removePerson,
  setLoading,
  setError,
} = peopleSlice.actions;

export default peopleSlice.reducer;
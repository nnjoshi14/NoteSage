import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CalendarView from '../CalendarView';
import todosReducer from '../../../stores/slices/todosSlice';
import peopleReducer from '../../../stores/slices/peopleSlice';
import { Todo } from '../../../stores/slices/todosSlice';
import { Person } from '../../../stores/slices/peopleSlice';

// Mock URL.createObjectURL and related functions
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document.createElement and related DOM methods
const mockLink = {
  href: '',
  download: '',
  click: jest.fn(),
};

const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName) => {
  if (tagName === 'a') {
    return mockLink as any;
  }
  return originalCreateElement.call(document, tagName);
});

const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
document.body.appendChild = mockAppendChild;
document.body.removeChild = mockRemoveChild;

const mockTodos: Todo[] = [
  {
    id: 'todo1',
    note_id: 'note1',
    todo_id: 't1',
    text: 'Complete project documentation',
    is_completed: false,
    assigned_person_id: 'person1',
    due_date: '2024-01-20',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    sync_status: 'synced',
  },
  {
    id: 'todo2',
    note_id: 'note1',
    todo_id: 't2',
    text: 'Review code changes',
    is_completed: true,
    due_date: '2024-01-22',
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T09:00:00Z',
    sync_status: 'synced',
  },
  {
    id: 'todo3',
    note_id: 'note2',
    todo_id: 't1',
    text: 'Overdue task',
    is_completed: false,
    due_date: '2024-01-10',
    created_at: '2024-01-08T08:00:00Z',
    updated_at: '2024-01-08T08:00:00Z',
    sync_status: 'synced',
  },
  {
    id: 'todo4',
    note_id: 'note2',
    todo_id: 't2',
    text: 'No due date task',
    is_completed: false,
    created_at: '2024-01-08T08:00:00Z',
    updated_at: '2024-01-08T08:00:00Z',
    sync_status: 'synced',
  },
];

const mockPeople: Person[] = [
  {
    id: 'person1',
    name: 'John Doe',
    email: 'john@example.com',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const createTestStore = (todos = mockTodos, people = mockPeople) => {
  return configureStore({
    reducer: {
      todos: todosReducer,
      people: peopleReducer,
    },
    preloadedState: {
      todos: {
        todos,
        currentTodo: null,
        isLoading: false,
        filters: {},
      },
      people: {
        people,
        currentPerson: null,
        isLoading: false,
        filters: {},
      },
    },
  });
};

const renderCalendarView = (props = {}, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      <CalendarView {...props} />
    </Provider>
  );
};

describe('CalendarView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current date to January 2024 for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders calendar with current month', () => {
    renderCalendarView();

    expect(screen.getByText('January 2024')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('displays todos on correct dates', () => {
    renderCalendarView();

    // Should show todos on their due dates
    const day20 = screen.getByText('20').closest('.calendar-day');
    expect(day20).toHaveClass('has-todos');
    expect(day20?.textContent).toContain('Complete project documentation');

    const day22 = screen.getByText('22').closest('.calendar-day');
    expect(day22).toHaveClass('has-todos');
    expect(day22?.textContent).toContain('Review code changes');

    const day10 = screen.getByText('10').closest('.calendar-day');
    expect(day10).toHaveClass('has-todos');
    expect(day10?.textContent).toContain('Overdue task');
  });

  it('shows completed todos with completed styling', () => {
    renderCalendarView();

    const day22 = screen.getByText('22').closest('.calendar-day');
    const completedTodo = day22?.querySelector('.calendar-todo.completed');
    expect(completedTodo).toBeInTheDocument();
  });

  it('shows overdue todos with overdue styling', () => {
    renderCalendarView();

    const day10 = screen.getByText('10').closest('.calendar-day');
    const overdueTodo = day10?.querySelector('.calendar-todo.overdue');
    expect(overdueTodo).toBeInTheDocument();
  });

  it('highlights today', () => {
    renderCalendarView();

    const today = screen.getByText('15').closest('.calendar-day');
    expect(today).toHaveClass('today');
  });

  it('navigates to previous month', () => {
    renderCalendarView();

    const prevButton = screen.getByRole('button', { name: '' }); // Left chevron
    fireEvent.click(prevButton);

    expect(screen.getByText('December 2023')).toBeInTheDocument();
  });

  it('navigates to next month', () => {
    renderCalendarView();

    const nextButton = screen.getAllByRole('button', { name: '' })[1]; // Right chevron
    fireEvent.click(nextButton);

    expect(screen.getByText('February 2024')).toBeInTheDocument();
  });

  it('goes to today when Today button is clicked', () => {
    renderCalendarView();

    // Navigate to different month first
    const nextButton = screen.getAllByRole('button', { name: '' })[1];
    fireEvent.click(nextButton);
    expect(screen.getByText('February 2024')).toBeInTheDocument();

    // Click Today button
    const todayButton = screen.getByText('Today');
    fireEvent.click(todayButton);

    expect(screen.getByText('January 2024')).toBeInTheDocument();
  });

  it('selects date when clicked', () => {
    const mockOnDateClick = jest.fn();
    renderCalendarView({ onDateClick: mockOnDateClick });

    const day20 = screen.getByText('20').closest('.calendar-day');
    fireEvent.click(day20!);

    expect(day20).toHaveClass('selected');
    expect(mockOnDateClick).toHaveBeenCalledWith(expect.any(Date));
  });

  it('shows selected date panel with todos', () => {
    renderCalendarView();

    const day20 = screen.getByText('20').closest('.calendar-day');
    fireEvent.click(day20!);

    // Should show selected date panel
    expect(screen.getByText(/Saturday, January 20, 2024/)).toBeInTheDocument();
    expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
  });

  it('shows empty state for date with no todos', () => {
    renderCalendarView();

    const day15 = screen.getByText('15').closest('.calendar-day');
    fireEvent.click(day15!);

    expect(screen.getByText('No todos for this date')).toBeInTheDocument();
  });

  it('closes selected date panel', () => {
    renderCalendarView();

    const day20 = screen.getByText('20').closest('.calendar-day');
    fireEvent.click(day20!);

    expect(screen.getByText(/Saturday, January 20, 2024/)).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: '' }); // Close button in panel
    fireEvent.click(closeButton);

    expect(screen.queryByText(/Saturday, January 20, 2024/)).not.toBeInTheDocument();
  });

  it('calls onTodoClick when todo is clicked in calendar', () => {
    const mockOnTodoClick = jest.fn();
    renderCalendarView({ onTodoClick: mockOnTodoClick });

    const day20 = screen.getByText('20').closest('.calendar-day');
    const todoElement = day20?.querySelector('.calendar-todo');
    fireEvent.click(todoElement!);

    expect(mockOnTodoClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'todo1',
        text: 'Complete project documentation',
      })
    );
  });

  it('calls onTodoClick when todo is clicked in selected date panel', () => {
    const mockOnTodoClick = jest.fn();
    renderCalendarView({ onTodoClick: mockOnTodoClick });

    // Select date first
    const day20 = screen.getByText('20').closest('.calendar-day');
    fireEvent.click(day20!);

    // Click todo in panel
    const todoInPanel = screen.getByText('Complete project documentation').closest('.selected-todo');
    fireEvent.click(todoInPanel!);

    expect(mockOnTodoClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'todo1',
        text: 'Complete project documentation',
      })
    );
  });

  it('shows more indicator when there are many todos', () => {
    // Create many todos for the same date
    const manyTodos = Array.from({ length: 5 }, (_, i) => ({
      id: `todo${i + 10}`,
      note_id: 'note1',
      todo_id: `t${i + 10}`,
      text: `Todo ${i + 1}`,
      is_completed: false,
      due_date: '2024-01-20',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      sync_status: 'synced' as const,
    }));

    const store = createTestStore([...mockTodos, ...manyTodos]);
    renderCalendarView({}, store);

    const day20 = screen.getByText('20').closest('.calendar-day');
    expect(day20?.textContent).toContain('+3 more'); // Should show +3 more (6 total - 3 shown)
  });

  it('exports calendar to ICS format', () => {
    renderCalendarView();

    const exportButton = screen.getByTitle('Export to Calendar');
    fireEvent.click(exportButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockLink.download).toBe('notesage-todos.ics');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });

  it('generates correct ICS content', () => {
    renderCalendarView();

    const exportButton = screen.getByTitle('Export to Calendar');
    fireEvent.click(exportButton);

    // Check that Blob was created with ICS content
    const blobCall = (global.URL.createObjectURL as jest.Mock).mock.calls[0][0];
    expect(blobCall.type).toBe('text/calendar;charset=utf-8');
  });

  it('displays person names in selected date panel', () => {
    renderCalendarView();

    const day20 = screen.getByText('20').closest('.calendar-day');
    fireEvent.click(day20!);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows todo IDs in selected date panel', () => {
    renderCalendarView();

    const day20 = screen.getByText('20').closest('.calendar-day');
    fireEvent.click(day20!);

    expect(screen.getByText('t1')).toBeInTheDocument();
  });

  it('handles todos without due dates correctly', () => {
    renderCalendarView();

    // Todo without due date should not appear on any calendar day
    const calendarDays = screen.getAllByText(/\d+/).map(el => el.closest('.calendar-day'));
    const daysWithTodos = calendarDays.filter(day => day?.textContent?.includes('No due date task'));
    
    expect(daysWithTodos).toHaveLength(0);
  });

  it('shows correct month and year in header', () => {
    renderCalendarView();

    expect(screen.getByText('January 2024')).toBeInTheDocument();
  });

  it('truncates long todo text in calendar view', () => {
    const longTodo: Todo = {
      id: 'long-todo',
      note_id: 'note1',
      todo_id: 't10',
      text: 'This is a very long todo text that should be truncated in the calendar view',
      is_completed: false,
      due_date: '2024-01-20',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      sync_status: 'synced',
    };

    const store = createTestStore([...mockTodos, longTodo]);
    renderCalendarView({}, store);

    const day20 = screen.getByText('20').closest('.calendar-day');
    expect(day20?.textContent).toContain('This is a very long t...');
  });

  it('shows checkboxes in selected date panel', () => {
    renderCalendarView();

    const day20 = screen.getByText('20').closest('.calendar-day');
    fireEvent.click(day20!);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked(); // Todo is not completed
  });

  it('shows completed checkbox for completed todos', () => {
    renderCalendarView();

    const day22 = screen.getByText('22').closest('.calendar-day');
    fireEvent.click(day22!);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked(); // Todo is completed
  });
});
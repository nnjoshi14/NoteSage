import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../stores/store';
import { Todo } from '../../stores/slices/todosSlice';
import './CalendarView.css';

interface CalendarViewProps {
  onTodoClick?: (todo: Todo) => void;
  onDateClick?: (date: Date) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  todos: Todo[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ onTodoClick, onDateClick }) => {
  const { todos } = useSelector((state: RootState) => state.todos);
  const { people } = useSelector((state: RootState) => state.people);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const todosWithDueDates = useMemo(() => {
    return todos.filter(todo => todo.due_date);
  }, [todos]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of the month and last day
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get first day of the calendar (might be from previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Get last day of the calendar (might be from next month)
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    const days: CalendarDay[] = [];
    const currentDateObj = new Date(startDate);
    
    while (currentDateObj <= endDate) {
      const dateStr = currentDateObj.toISOString().split('T')[0];
      const dayTodos = todosWithDueDates.filter(todo => todo.due_date === dateStr);
      
      days.push({
        date: new Date(currentDateObj),
        isCurrentMonth: currentDateObj.getMonth() === month,
        isToday: currentDateObj.toDateString() === new Date().toDateString(),
        todos: dayTodos,
      });
      
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
    
    return days;
  }, [currentDate, todosWithDueDates]);

  const selectedDateTodos = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    return todosWithDueDates.filter(todo => todo.due_date === dateStr);
  }, [selectedDate, todosWithDueDates]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
    onDateClick?.(day.date);
  };

  const getPersonName = (personId?: string): string => {
    if (!personId) return '';
    const person = people.find(p => p.id === personId);
    return person ? person.name : 'Unknown';
  };

  const isOverdue = (dateString: string): boolean => {
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const exportToICS = () => {
    const icsContent = generateICSContent(todosWithDueDates);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notesage-todos.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const generateICSContent = (todos: Todo[]): string => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NoteSage//Todo Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ].join('\r\n');

    todos.forEach(todo => {
      if (!todo.due_date) return;
      
      const dueDate = new Date(todo.due_date);
      const dueDateStr = dueDate.toISOString().split('T')[0].replace(/-/g, '');
      
      icsContent += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:${todo.id}@notesage.app`,
        `DTSTAMP:${timestamp}`,
        `DTSTART;VALUE=DATE:${dueDateStr}`,
        `SUMMARY:${todo.text.replace(/,/g, '\\,')}`,
        `DESCRIPTION:Todo ID: ${todo.todo_id}${todo.assigned_person_id ? `\\nAssigned to: ${getPersonName(todo.assigned_person_id)}` : ''}`,
        `STATUS:${todo.is_completed ? 'COMPLETED' : 'NEEDS-ACTION'}`,
        'END:VEVENT',
      ].join('\r\n');
    });

    icsContent += '\r\nEND:VCALENDAR';
    return icsContent;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-view">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="calendar-navigation">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigateMonth('prev')}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          
          <h4 className="calendar-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h4>
          
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigateMonth('next')}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
        
        <div className="calendar-actions">
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={goToToday}
          >
            Today
          </button>
          <button
            className="btn btn-outline-secondary btn-sm ms-2"
            onClick={exportToICS}
            title="Export to Calendar"
          >
            <i className="bi bi-download"></i> Export
          </button>
        </div>
      </div>

      <div className="calendar-content">
        {/* Calendar Grid */}
        <div className="calendar-grid">
          {/* Day headers */}
          <div className="calendar-day-headers">
            {dayNames.map(day => (
              <div key={day} className="calendar-day-header">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="calendar-days">
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`calendar-day ${
                  !day.isCurrentMonth ? 'other-month' : ''
                } ${
                  day.isToday ? 'today' : ''
                } ${
                  selectedDate && day.date.toDateString() === selectedDate.toDateString() ? 'selected' : ''
                } ${
                  day.todos.length > 0 ? 'has-todos' : ''
                }`}
                onClick={() => handleDateClick(day)}
              >
                <div className="calendar-day-number">
                  {day.date.getDate()}
                </div>
                
                {day.todos.length > 0 && (
                  <div className="calendar-day-todos">
                    {day.todos.slice(0, 3).map(todo => (
                      <div
                        key={todo.id}
                        className={`calendar-todo ${todo.is_completed ? 'completed' : ''} ${
                          isOverdue(todo.due_date!) && !todo.is_completed ? 'overdue' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTodoClick?.(todo);
                        }}
                        title={todo.text}
                      >
                        <span className="calendar-todo-text">
                          {todo.text.length > 20 ? `${todo.text.substring(0, 20)}...` : todo.text}
                        </span>
                      </div>
                    ))}
                    {day.todos.length > 3 && (
                      <div className="calendar-todo-more">
                        +{day.todos.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Date Details */}
        {selectedDate && (
          <div className="selected-date-panel">
            <div className="selected-date-header">
              <h5>
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h5>
              <button
                className="btn-close"
                onClick={() => setSelectedDate(null)}
              ></button>
            </div>
            
            <div className="selected-date-todos">
              {selectedDateTodos.length === 0 ? (
                <div className="text-center text-muted py-3">
                  <i className="bi bi-calendar-x display-6"></i>
                  <p className="mt-2">No todos for this date</p>
                </div>
              ) : (
                selectedDateTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`selected-todo ${todo.is_completed ? 'completed' : ''} ${
                      isOverdue(todo.due_date!) && !todo.is_completed ? 'overdue' : ''
                    }`}
                    onClick={() => onTodoClick?.(todo)}
                  >
                    <div className="selected-todo-checkbox">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={todo.is_completed}
                        readOnly
                      />
                    </div>
                    
                    <div className="selected-todo-content">
                      <div className="selected-todo-text">
                        {todo.text}
                      </div>
                      <div className="selected-todo-meta">
                        <span className="badge bg-secondary">{todo.todo_id}</span>
                        {todo.assigned_person_id && (
                          <span className="text-muted">
                            <i className="bi bi-person"></i>
                            {getPersonName(todo.assigned_person_id)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
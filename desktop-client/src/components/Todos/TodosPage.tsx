import React from 'react';

const TodosPage: React.FC = () => {
  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Todos</h1>
        <button className="btn btn-primary">
          Add Todo
        </button>
      </div>

      <div className="text-center text-muted mt-4">
        <p>Todo management coming soon!</p>
      </div>
    </div>
  );
};

export default TodosPage;
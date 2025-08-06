import React from 'react';

const PeoplePage: React.FC = () => {
  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>People</h1>
        <button className="btn btn-primary">
          Add Person
        </button>
      </div>

      <div className="text-center text-muted mt-4">
        <p>People management coming soon!</p>
      </div>
    </div>
  );
};

export default PeoplePage;
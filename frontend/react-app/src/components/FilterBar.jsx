import React from 'react';

export default function FilterBar({ children, onAdd, addLabel }) {
  return (
    <div className="flex gap-2.5 mb-5 flex-wrap items-center">
      {children}
      {onAdd && (
        <button className="btn btn-primary" onClick={onAdd}>
          <i className="fas fa-plus"></i> {addLabel || 'Nouveau'}
        </button>
      )}
    </div>
  );
}

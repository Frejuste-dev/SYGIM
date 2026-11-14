import React from 'react';

/**
 * Reusable table skeleton loader with pulse animation.
 * @param {number} rows - Number of skeleton rows to render (default: 5)
 * @param {number} columns - Number of columns per row (default: 6)
 * @param {string} className - Optional row className
 */
export default function TableSkeleton({ rows = 5, columns = 6, className = '' }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr
          key={rIdx}
          className={`border-b border-slate-100 animate-pulse ${className}`}
        >
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-4 px-6">
              <div
                className={`h-4 bg-slate-200/80 rounded ${
                  cIdx === 0
                    ? 'w-28'
                    : cIdx === columns - 1
                    ? 'w-16 ml-auto'
                    : 'w-20'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

import React from 'react';
export function Badge({ className = '', children, ...props }) {
  return (
    <span className={`inline-flex items-center border text-xs px-2 py-0.5 rounded ${className}`} {...props}>
      {children}
    </span>
  );
}
export default Badge;

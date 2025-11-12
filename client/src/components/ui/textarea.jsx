import React from 'react';
export function Textarea({ className='', ...props }) {
  return <textarea className={`w-full border rounded-lg px-3 py-2 text-sm ${className}`} {...props} />;
}
export default Textarea;

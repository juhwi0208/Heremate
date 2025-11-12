import React from 'react';
export function Label({ className='', children, ...props }) {
  return <label className={`text-sm text-zinc-700 ${className}`} {...props}>{children}</label>;
}
export default Label;

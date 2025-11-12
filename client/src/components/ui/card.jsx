import React from 'react';

export function Card({ className = '', children, ...props }) {
  return <div className={`border rounded-xl bg-white ${className}`} {...props}>{children}</div>;
}
export function CardHeader({ className = '', children, ...props }) {
  return <div className={`p-4 border-b ${className}`} {...props}>{children}</div>;
}
export function CardTitle({ className = '', children, ...props }) {
  return <div className={`text-base font-semibold ${className}`} {...props}>{children}</div>;
}
export function CardContent({ className = '', children, ...props }) {
  return <div className={`p-4 ${className}`} {...props}>{children}</div>;
}

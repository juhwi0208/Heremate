import React, { createContext, useContext, useEffect } from 'react';
import ReactDOM from 'react-dom';

const Ctx = createContext({ open:false, onOpenChange:()=>{} });

export function Dialog({ open, onOpenChange, children }) {
  return <Ctx.Provider value={{open, onOpenChange}}>{children}</Ctx.Provider>;
}
export function DialogTrigger({ asChild=false, children }) {
  const { onOpenChange } = useContext(Ctx);
  const child = React.Children.only(children);
  if (asChild && React.isValidElement(child)) {
    return React.cloneElement(child, { onClick:()=>onOpenChange(true) });
  }
  return <button onClick={()=>onOpenChange(true)}>{children}</button>;
}
function Portal({ children }) {
  const [el] = React.useState(()=>document.createElement('div'));
  useEffect(()=>{ document.body.appendChild(el); return ()=>document.body.removeChild(el); }, [el]);
  return ReactDOM.createPortal(children, el);
}
export function DialogContent({ className='', children }) {
  const { open, onOpenChange } = useContext(Ctx);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/30" onClick={()=>onOpenChange(false)} />
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg bg-white border rounded-2xl shadow-xl ${className}`}>
          {children}
        </div>
      </div>
    </Portal>
  );
}
export function DialogHeader({ className='', children }) {
  return <div className={`p-4 border-b ${className}`}>{children}</div>;
}
export function DialogTitle({ className='', children }) {
  return <div className={`text-base font-semibold ${className}`}>{children}</div>;
}
export function DialogFooter({ className='', children }) {
  return <div className={`p-4 border-t flex justify-end gap-2 ${className}`}>{children}</div>;
}

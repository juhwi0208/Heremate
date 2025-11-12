import * as React from "react";

const Button = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={`bg-[#00C7BE] hover:bg-[#00B5AC] text-white px-4 py-2 rounded-md text-sm font-medium ${className}`}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };

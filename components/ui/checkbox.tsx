'use client';

import * as React from 'react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0 ${className || ''}`}
        ref={ref}
        onChange={(e) => {
          onCheckedChange?.(e.target.checked);
          props.onChange?.(e);
        }}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };


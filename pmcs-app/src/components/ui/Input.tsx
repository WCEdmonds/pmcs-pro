import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`
            min-h-[48px] px-3 text-base
            bg-bg-tertiary text-text-primary
            border border-border rounded-[var(--radius-md)]
            placeholder:text-text-secondary/50
            focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent
            disabled:opacity-50
            ${error ? 'border-accent-red ring-1 ring-accent-red' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-sm text-accent-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

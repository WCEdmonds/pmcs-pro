import { type SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly string[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={`
            min-h-[48px] px-3 text-base appearance-none
            bg-bg-tertiary text-text-primary
            border border-border rounded-[var(--radius-md)]
            focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

Select.displayName = 'Select';

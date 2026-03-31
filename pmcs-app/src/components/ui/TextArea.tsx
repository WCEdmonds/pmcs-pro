import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`
            min-h-[96px] px-3 py-2.5 text-base
            bg-bg-tertiary text-text-primary
            border border-border rounded-[var(--radius-md)]
            placeholder:text-text-secondary/50
            focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent
            resize-y
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

TextArea.displayName = 'TextArea';

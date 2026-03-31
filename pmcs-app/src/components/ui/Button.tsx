import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'default' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent-blue text-white active:bg-accent-blue/80 disabled:bg-accent-blue/40',
  secondary: 'bg-bg-tertiary text-text-primary border border-border active:bg-bg-secondary',
  danger: 'bg-accent-red text-white active:bg-accent-red/80',
  ghost: 'bg-transparent text-text-secondary active:bg-bg-tertiary',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'min-h-[48px] px-4 text-base',
  lg: 'min-h-[56px] px-6 text-lg font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', fullWidth, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          rounded-[var(--radius-md)] font-body font-medium
          transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

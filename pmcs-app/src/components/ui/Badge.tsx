import type { ReactNode } from 'react';

type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-accent-green/20 text-accent-green border-accent-green/30',
  amber: 'bg-accent-amber/20 text-accent-amber border-accent-amber/30',
  red: 'bg-accent-red/20 text-accent-red border-accent-red/30',
  blue: 'bg-accent-blue/20 text-accent-blue border-accent-blue/30',
  gray: 'bg-bg-tertiary text-text-secondary border-border',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-xs font-semibold font-display
        rounded-[var(--radius-sm)] border
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

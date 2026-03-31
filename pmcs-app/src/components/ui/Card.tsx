import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
}

export function Card({ children, padding = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        bg-bg-secondary rounded-[var(--radius-lg)] border border-border
        ${padding ? 'p-4' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

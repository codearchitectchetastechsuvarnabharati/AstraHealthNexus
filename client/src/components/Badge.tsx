// Badge Component - For status labels and tags
import { ReactNode } from 'react';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30',
  success: 'bg-green-500/20 text-green-200 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-200 border-red-500/30',
  neutral: 'bg-slate-700/50 text-slate-200 border-slate-600/50',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function Badge({ variant = 'neutral', size = 'md', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full border
        font-medium transition-colors
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

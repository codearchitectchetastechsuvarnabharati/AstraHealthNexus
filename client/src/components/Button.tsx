// Button Component - Multiple variants for consistent UI
import { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-400',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-900 disabled:bg-slate-900 disabled:text-slate-500',
  outline: 'border border-cyan-400/30 text-slate-100 hover:border-cyan-400/60 hover:bg-slate-900/30 active:border-cyan-400 disabled:border-slate-700 disabled:text-slate-500',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:bg-slate-700 disabled:text-slate-400',
  ghost: 'text-slate-300 hover:text-slate-100 hover:bg-slate-900/30 active:bg-slate-800/50 disabled:text-slate-600',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium',
  md: 'px-4 py-2 text-sm font-medium',
  lg: 'px-6 py-3 text-base font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  className = '',
  disabled = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center
        rounded-lg transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-slate-950
        disabled:cursor-not-allowed
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}

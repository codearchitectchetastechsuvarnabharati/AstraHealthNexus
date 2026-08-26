// Input Component - For text input fields
import { ReactNode } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  icon?: ReactNode;
  className?: string;
}

export function Input({
  label,
  error,
  helpText,
  icon,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-slate-200">
          {label}
          {props.required && <span className="text-red-400">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          className={`
            w-full rounded-lg border bg-slate-900/50 px-4 py-2 text-slate-100
            placeholder-slate-500 transition-colors
            focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/30
            disabled:cursor-not-allowed disabled:bg-slate-900/30 disabled:text-slate-500
            ${error ? 'border-red-500/50 focus:border-red-400/50 focus:ring-red-400/30' : 'border-slate-700/50 hover:border-slate-600/50'}
            ${icon ? 'pr-10' : ''}
            ${className}
          `}
          {...props}
        />
        {icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {icon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-sm text-slate-400">{helpText}</p>
      )}
    </div>
  );
}

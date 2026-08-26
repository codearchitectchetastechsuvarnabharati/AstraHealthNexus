// Select Component - For dropdown selections
import { ReactNode } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

export function Select({
  label,
  error,
  helpText,
  options,
  placeholder,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-slate-200">
          {label}
          {props.required && <span className="text-red-400">*</span>}
        </label>
      )}
      <select
        className={`
          w-full rounded-lg border bg-slate-900/50 px-4 py-2 text-slate-100
          transition-colors
          focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/30
          disabled:cursor-not-allowed disabled:bg-slate-900/30 disabled:text-slate-500
          ${error ? 'border-red-500/50 focus:border-red-400/50 focus:ring-red-400/30' : 'border-slate-700/50 hover:border-slate-600/50'}
          ${className}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-sm text-slate-400">{helpText}</p>
      )}
    </div>
  );
}

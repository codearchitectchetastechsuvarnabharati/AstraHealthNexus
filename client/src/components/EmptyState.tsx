// Empty State Component - For showing when there's no data
import { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex min-h-96 flex-col items-center justify-center
        rounded-lg border border-slate-800 bg-slate-950/50 p-8 text-center
        ${className}
      `}
    >
      {icon && (
        <div className="mb-4 text-4xl opacity-50">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-slate-400">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="secondary"
          size="md"
          onClick={action.onClick}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

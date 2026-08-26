// Error State Component - For showing errors
import { ReactNode } from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
  retry?: () => void;
  goBack?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  icon = '⚠',
  retry,
  goBack,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`
        flex min-h-96 flex-col items-center justify-center
        rounded-lg border border-red-500/30 bg-red-500/10 p-8 text-center
        ${className}
      `}
    >
      <div className="mb-4 text-4xl text-red-400">{icon}</div>
      <h3 className="text-lg font-semibold text-red-200">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-red-300/80">
        {message}
      </p>
      <div className="mt-6 flex gap-3">
        {retry && (
          <Button variant="primary" size="md" onClick={retry}>
            Try Again
          </Button>
        )}
        {goBack && (
          <Button variant="secondary" size="md" onClick={goBack}>
            Go Back
          </Button>
        )}
      </div>
    </div>
  );
}

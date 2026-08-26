// Alert Component - For status messages and notifications
import { ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; icon: string; text: string }> = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    text: 'text-blue-200',
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    text: 'text-green-200',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-400',
    text: 'text-yellow-200',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    text: 'text-red-200',
  },
};

const icons: Record<AlertVariant, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export function Alert({ variant = 'info', title, children, onClose, className = '' }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`
        rounded-lg border ${styles.border} ${styles.bg} p-4
        ${className}
      `}
      role="alert"
    >
      <div className="flex gap-3">
        <div className={`mt-0.5 flex-shrink-0 text-lg font-bold ${styles.icon}`}>
          {icons[variant]}
        </div>
        <div className="flex-1">
          {title && <h3 className={`font-semibold ${styles.text}`}>{title}</h3>}
          <div className={`text-sm ${title ? 'mt-1' : ''} text-slate-300`}>
            {children}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`flex-shrink-0 text-lg opacity-50 hover:opacity-100 transition-opacity ${styles.text}`}
            aria-label="Close alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

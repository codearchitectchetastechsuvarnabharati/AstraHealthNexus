// Status Indicator Component - For showing status with color and label
interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'warning' | 'error' | 'success';
  label?: string;
  animated?: boolean;
  className?: string;
}

const statusStyles: Record<string, { dot: string; text: string }> = {
  active: { dot: 'bg-green-500', text: 'text-green-300' },
  inactive: { dot: 'bg-slate-500', text: 'text-slate-400' },
  warning: { dot: 'bg-yellow-500', text: 'text-yellow-300' },
  error: { dot: 'bg-red-500', text: 'text-red-300' },
  success: { dot: 'bg-green-500', text: 'text-green-300' },
};

export function StatusIndicator({
  status,
  label,
  animated = false,
  className = '',
}: StatusIndicatorProps) {
  const styles = statusStyles[status];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="flex items-center">
        <div
          className={`h-2.5 w-2.5 rounded-full ${styles.dot} ${
            animated ? 'animate-pulse' : ''
          }`}
        />
      </div>
      {label && (
        <span className={`text-xs font-medium ${styles.text}`}>
          {label}
        </span>
      )}
    </div>
  );
}

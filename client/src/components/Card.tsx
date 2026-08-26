// Card Components - Flexible container for content
import { ReactNode } from 'react';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className = '', children }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`border-b border-white/10 p-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

interface CardBodyProps {
  className?: string;
  children: ReactNode;
}

export function CardBody({ className = '', children }: CardBodyProps) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

interface CardFooterProps {
  className?: string;
  children: ReactNode;
}

export function CardFooter({ className = '', children }: CardFooterProps) {
  return (
    <div className={`border-t border-white/10 p-6 ${className}`}>
      {children}
    </div>
  );
}

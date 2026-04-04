import clsx from 'clsx';
import type React from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-ios-lg border border-app-separator bg-app-card shadow-card',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-ios px-4 py-2.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' &&
          'bg-app-campus text-white shadow-sm hover:bg-app-campus/90',
        variant === 'secondary' &&
          'border border-app-separator bg-app-card text-app-label shadow-sm hover:bg-app-secondary',
        variant === 'ghost' && 'text-app-accent hover:bg-app-accent-muted',
        variant === 'danger' && 'bg-app-destructive text-white hover:opacity-90',
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx('mb-1.5 block text-[13px] font-medium text-app-muted', className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-ios border border-app-separator bg-app-secondary px-3 py-2.5 text-[15px] text-app-label placeholder:text-app-subtle',
        className
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        'w-full rounded-ios border border-app-separator bg-app-secondary px-3 py-2.5 text-[15px] text-app-label placeholder:text-app-subtle',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'app-select w-full rounded-ios border border-app-separator bg-app-secondary px-3 py-2.5 text-[15px] text-app-label',
        className
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-app-label md:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-app-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('space-y-3', className)}>
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-app-subtle">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-snug text-app-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="toolbar"
      aria-label="Page actions"
      className={clsx(
        'mb-6 flex flex-wrap items-center gap-2 rounded-ios-lg border border-app-separator bg-app-card p-2 shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info';
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        tone === 'neutral' && 'bg-app-fill text-app-muted',
        tone === 'success' && 'bg-app-campus-muted text-app-campus',
        tone === 'warn' && 'bg-amber-100 text-amber-800',
        tone === 'danger' && 'bg-red-100 text-red-700',
        tone === 'info' && 'bg-app-accent-muted text-app-accent'
      )}
    >
      {children}
    </span>
  );
}

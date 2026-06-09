import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="font-mono text-[10px] sm:text-[11px] tracking-[0.3em] uppercase text-gold mb-1.5 sm:mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-foreground leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 sm:mt-2 text-muted-foreground max-w-2xl text-sm">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
      <div className="divider-gold mt-4 sm:mt-6" />
    </div>
  );
}

import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {eyebrow && (
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-4xl sm:text-5xl text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-muted-foreground max-w-2xl text-sm sm:text-base">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="divider-gold mt-6" />
    </div>
  );
}

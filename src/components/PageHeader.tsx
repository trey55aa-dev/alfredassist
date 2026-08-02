import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  /** Subtitle shown beneath the title. Also accepted as `description`. */
  subtitle?: string;
  description?: string;
  /** Action buttons. Also accepted as `action` (singular). */
  actions?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, description, actions, action }: PageHeaderProps) {
  const sub = subtitle ?? description;
  const acts = actions ?? action;

  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 shrink-0">
          {eyebrow && (
            <div className="flex items-center gap-2 mb-2">
              <span className="h-1 w-1 rounded-full bg-gold inline-block" />
              <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.3em] uppercase text-gold">
                {eyebrow}
              </span>
            </div>
          )}
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-foreground leading-tight">
            {title}
          </h1>
          {sub && (
            <p className="mt-1.5 sm:mt-2 font-mono text-[11px] tracking-[0.15em] uppercase text-muted-foreground/70">
              {sub}
            </p>
          )}
        </div>
        {acts && (
          <div className="flex flex-wrap gap-2 min-w-0 max-w-full mt-1 sm:mt-0">
            {acts}
          </div>
        )}
      </div>
      <div className="divider-gold mt-4 sm:mt-5" />
    </div>
  );
}

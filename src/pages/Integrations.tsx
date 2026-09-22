import { Link } from "react-router-dom";
import { CalendarDays, FileText, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { GoogleCalendarConnect } from "@/components/GoogleCalendarConnect";
import { OutlookCalendarConnect } from "@/components/OutlookCalendarConnect";

export default function Integrations() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connections"
        title="Integrations"
        description="Where Alfred's calendar and notes come from — connect once, everything else stays in sync."
      />

      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="h-4 w-4 text-gold" />
          <h3 className="font-display text-xl">Calendars</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Bring in today's real schedule so the Agenda reflects what's actually on your calendar.
        </p>
        <div className="space-y-4">
          <IntegrationRow
            name="Google Calendar"
            description="Two-way sync with your primary Google Calendar."
          >
            <GoogleCalendarConnect />
          </IntegrationRow>
          <div className="h-px bg-border/40" />
          <IntegrationRow
            name="Outlook Calendar"
            description="Two-way sync with your Microsoft/Outlook calendar."
          >
            <OutlookCalendarConnect />
          </IntegrationRow>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-gold" />
          <h3 className="font-display text-xl">Notes & tasks</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Notion has its own richer sync screen — goals, tasks, and workspace selection live there.
        </p>
        <Link
          to="/notion"
          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 hover:border-gold/30 transition-all group"
        >
          <span className="text-sm text-foreground">Open Notion sync</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-gold transition-colors" />
        </Link>
      </Card>

      <p className="text-center font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50">
        Only real, working connections are listed here — nothing to upsell, nothing coming "soon."
      </p>
    </div>
  );
}

function IntegrationRow({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

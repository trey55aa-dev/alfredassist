import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Calendar,
  Timer,
  CheckSquare,
  Bell,
  Brain,
  Target,
  Layers,
  Repeat,
  Mic,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Visual Time Blocks",
    how: "Drag activities into a colorful day timeline. Each block represents a real chunk of your day.",
    tip: "Color-code by life area (gold = career, teal = body) for instant recognition.",
    goal: "Make time tangible.",
  },
  {
    icon: Timer,
    title: "Focus Timers",
    how: "Built-in countdown for each block — start, pause, or extend on the fly.",
    tip: "Pair with the Focus Timer here for double accountability.",
    goal: "Treat time as a budget.",
  },
  {
    icon: CheckSquare,
    title: "Activity Checklists",
    how: "Break each block into sub-steps you can tick off as you go.",
    tip: "Five steps max — keep it scannable.",
    goal: "Reduce decision fatigue.",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    how: "Gentle prompts before transitions, not interruptions.",
    tip: "Set 2-min lead time before deep work blocks.",
    goal: "Land softly into focus.",
  },
  {
    icon: Repeat,
    title: "Recurring Routines",
    how: "Save weekday templates for morning, training, and shutdown rituals.",
    tip: "Build the rituals first, then the rare items.",
    goal: "Automate the obvious.",
  },
  {
    icon: Layers,
    title: "Day Templates",
    how: "Duplicate the perfect day across the week — adjust only what differs.",
    tip: "Maintain a 'flow day' and 'admin day' template.",
    goal: "Stop replanning the wheel.",
  },
  {
    icon: Target,
    title: "Goal Tracking",
    how: "Link daily activities to weekly outcomes you actually care about.",
    tip: "One goal per life area; no more.",
    goal: "Connect today to tomorrow.",
  },
  {
    icon: Brain,
    title: "Brain Dump Inbox",
    how: "Capture stray thoughts in seconds, schedule them later.",
    tip: "Capture immediately, sort once daily.",
    goal: "Keep the mind clear.",
  },
  {
    icon: Mic,
    title: "Voice Notes",
    how: "Speak entries when typing breaks the flow.",
    tip: "End each session with a 60-sec verbal recap.",
    goal: "Capture without friction.",
  },
  {
    icon: Sparkles,
    title: "Daily Review",
    how: "End-of-day reflection: wins, friction, lessons.",
    tip: "Three lines is enough; consistency beats depth.",
    goal: "Make tomorrow sharper.",
  },
];

export default function Guide() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Manual"
        title="Feature Guide"
        description="Ten capabilities, ten habits. Master them in order, sir."
      />

      <Card className="p-2 sm:p-4 bg-gradient-card border-border">
        <Accordion type="single" collapsible className="w-full">
          {features.map((f, i) => (
            <AccordionItem
              key={f.title}
              value={f.title}
              className="border-b border-border last:border-b-0"
            >
              <AccordionTrigger className="hover:no-underline px-4 py-4 group">
                <div className="flex items-center gap-4 text-left">
                  <div className="h-10 w-10 rounded-md bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <f.icon className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="font-display text-xl text-foreground group-hover:text-gold transition-colors">
                      {f.title}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 pl-[72px] space-y-3">
                <Detail label="How to use" text={f.how} />
                <Detail label="Tip" text={f.tip} />
                <Detail label="Goal" text={f.goal} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-gold mb-1">
        {label}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

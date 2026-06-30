import { useState, useEffect, useCallback } from "react";
import {
  Check, ChevronDown, ExternalLink, Link2, Link2Off,
  RefreshCw, Upload, Download, FileText, Target,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { notion, type NotionDb, type NotionPage, type NotionTask } from "@/lib/notionClient";
import { GOALS_KEY, type Goal } from "@/lib/goals";
import { toast } from "sonner";

/* ─── tiny helpers ─────────────────────────────────────── */

function read<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

function pct(g: Goal): number {
  if (typeof g.target !== "number" || g.target <= 0) return 0;
  return Math.min(100, Math.round(((g.current ?? 0) / g.target) * 100));
}

/* ─── Select dropdown ──────────────────────────────────── */

function SelectItem<T extends { id: string; title: string }>({
  items, value, onChange, placeholder, loading,
}: {
  items: T[]; value: string; onChange: (id: string) => void;
  placeholder: string; loading?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || !items.length}
        className="w-full appearance-none rounded-lg bg-white/5 border border-border/50 px-3 py-2 pr-8 text-sm text-foreground disabled:opacity-50 focus:border-gold/40 focus:outline-none transition-colors"
      >
        <option value="">{loading ? "Loading…" : placeholder}</option>
        {items.map((it) => (
          <option key={it.id} value={it.id}>{it.title}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}

/* ─── Sync card ────────────────────────────────────────── */

function SyncCard({
  icon, title, description, children, status,
}: {
  icon: React.ReactNode; title: string; description: string;
  children: React.ReactNode; status?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-white/3 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-white/5 text-muted-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="font-display text-base">{title}</div>
          <div className="font-mono text-[9px] tracking-wider text-muted-foreground mt-0.5">{description}</div>
          {status && (
            <div className="font-mono text-[9px] tracking-wider text-gold/80 mt-1">{status}</div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────── */

export default function NotionPage() {
  const [token, setToken]             = useState("");
  const [connecting, setConnecting]   = useState(false);
  const [connected, setConnected]     = useState(false);
  const [workspace, setWorkspace]     = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [databases, setDatabases]     = useState<NotionDb[]>([]);
  const [pages, setPages]             = useState<NotionPage[]>([]);
  const [dbsLoading, setDbsLoading]   = useState(false);

  // per-action state
  const [goalsDb, setGoalsDb]         = useState("");
  const [bdPage, setBdPage]           = useState("");
  const [tasksDb, setTasksDb]         = useState("");
  const [syncing, setSyncing]         = useState<string | null>(null);
  const [lastSync, setLastSync]       = useState<Record<string, string>>({});

  /* Load status on mount */
  useEffect(() => {
    notion.status()
      .then(({ connected: c, workspace: w }) => { setConnected(c); setWorkspace(w); })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  /* Load databases + pages once connected */
  const loadResources = useCallback(async () => {
    setDbsLoading(true);
    try {
      const [dbs, pgs] = await Promise.all([notion.listDatabases(), notion.listPages()]);
      setDatabases(dbs);
      setPages(pgs);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load Notion resources");
    } finally {
      setDbsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) loadResources();
  }, [connected, loadResources]);

  /* Connect */
  const connect = async () => {
    if (!token.trim()) return;
    setConnecting(true);
    try {
      const { workspace: ws } = await notion.connect(token.trim());
      setConnected(true);
      setWorkspace(ws);
      setToken("");
      toast.success(`Connected to ${ws}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  /* Disconnect */
  const disconnect = async () => {
    await notion.disconnect().catch(() => {});
    setConnected(false);
    setWorkspace(null);
    setDatabases([]);
    setPages([]);
  };

  /* Push goals */
  const pushGoals = async () => {
    if (!goalsDb) return toast.error("Select a Notion database first");
    setSyncing("goals");
    try {
      const goals: Goal[] = read(GOALS_KEY, []);
      const active = goals.filter((g) => !g.done).map((g) => ({
        id: g.id, title: g.title, category: g.category,
        pct: pct(g), deadline: g.deadline, done: g.done,
      }));
      const { pushed } = await notion.pushGoals(active, goalsDb);
      const ok = pushed.filter((p) => !p.error).length;
      const fail = pushed.filter((p) => p.error).length;
      toast.success(`${ok} goal${ok !== 1 ? "s" : ""} sent to Notion${fail ? ` (${fail} failed)` : ""}`);
      setLastSync((p) => ({ ...p, goals: new Date().toLocaleTimeString() }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Push failed");
    } finally {
      setSyncing(null);
    }
  };

  /* Push brain dump */
  const pushBrainDump = async () => {
    if (!bdPage) return toast.error("Select a Notion page first");
    setSyncing("brain");
    try {
      const items: string[] = read("alfred.brain", []);
      if (!items.length) { toast.info("Brain dump is empty"); return; }
      const { pushed } = await notion.pushBrainDump(items, bdPage);
      toast.success(`${pushed} item${pushed !== 1 ? "s" : ""} appended to Notion`);
      setLastSync((p) => ({ ...p, brain: new Date().toLocaleTimeString() }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Push failed");
    } finally {
      setSyncing(null);
    }
  };

  /* Pull tasks */
  const pullTasks = async () => {
    if (!tasksDb) return toast.error("Select a Notion database first");
    setSyncing("tasks");
    try {
      const tasks: NotionTask[] = await notion.pullTasks(tasksDb);
      if (!tasks.length) { toast.info("No tasks found in that database"); return; }
      // Import as a new custom list
      const lists: unknown[] = read("alfred.customLists", []);
      const newList = {
        id: `notion-${Date.now()}`,
        title: "From Notion",
        emoji: "📋",
        color: "purple",
        createdAt: Date.now(),
        items: tasks.map((t) => ({
          id: t.id, text: t.text, done: false, createdAt: Date.now(),
        })),
      };
      localStorage.setItem("alfred.customLists", JSON.stringify([...lists, newList]));
      toast.success(`${tasks.length} task${tasks.length !== 1 ? "s" : ""} imported to Custom Lists`);
      setLastSync((p) => ({ ...p, tasks: new Date().toLocaleTimeString() }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Pull failed");
    } finally {
      setSyncing(null);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground animate-pulse">
          Checking connection…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Notion" subtitle="Sync goals, tasks, and notes" />

      {/* ── Connect card ─────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-white/3 p-5">
        {connected ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-foreground">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium">{workspace}</div>
                <div className="font-mono text-[9px] tracking-wider text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Connected
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadResources}
                disabled={dbsLoading}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${dbsLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors"
              >
                <Link2Off className="h-3 w-3" /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-display text-base">Connect Notion</div>
                <div className="font-mono text-[9px] tracking-wider text-muted-foreground">
                  Paste your integration token below
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/30 bg-white/2 p-3 space-y-1">
              <p className="font-mono text-[9px] tracking-wider text-muted-foreground/70">
                1 · Go to <span className="text-foreground/70">notion.so/my-integrations</span>
              </p>
              <p className="font-mono text-[9px] tracking-wider text-muted-foreground/70">
                2 · Create a new integration → copy the token
              </p>
              <p className="font-mono text-[9px] tracking-wider text-muted-foreground/70">
                3 · Share your pages/databases with the integration in Notion
              </p>
              <p className="font-mono text-[9px] tracking-wider text-muted-foreground/70">
                4 · Paste the token here
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="secret_…"
                className="flex-1 rounded-xl bg-white/5 border border-border/60 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && connect()}
              />
              <button
                onClick={connect}
                disabled={!token.trim() || connecting}
                className="rounded-xl bg-gold/15 border border-gold/30 text-gold px-4 py-2.5 text-sm font-mono tracking-wider hover:bg-gold/25 transition-colors disabled:opacity-40"
              >
                {connecting ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sync cards (only when connected) ─────────────── */}
      {connected && (
        <>
          {/* Push Goals */}
          <SyncCard
            icon={<Target className="h-4 w-4" />}
            title="Push Goals to Notion"
            description="Sends your active 2026 goals to a Notion database as pages"
            status={lastSync.goals ? `Last synced · ${lastSync.goals}` : undefined}
          >
            <SelectItem
              items={databases}
              value={goalsDb}
              onChange={setGoalsDb}
              placeholder="Select a database…"
              loading={dbsLoading}
            />
            <button
              onClick={pushGoals}
              disabled={!goalsDb || syncing === "goals"}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-mono tracking-wider uppercase bg-white/5 border border-border/50 text-foreground hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-40"
            >
              {syncing === "goals"
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Pushing…</>
                : <><Upload className="h-3.5 w-3.5" /> Push goals</>}
            </button>
          </SyncCard>

          {/* Push Brain Dump */}
          <SyncCard
            icon={<FileText className="h-4 w-4" />}
            title="Export Brain Dump"
            description="Appends all brain dump items as bullet points to a Notion page"
            status={lastSync.brain ? `Last synced · ${lastSync.brain}` : undefined}
          >
            <SelectItem
              items={pages}
              value={bdPage}
              onChange={setBdPage}
              placeholder="Select a page…"
              loading={dbsLoading}
            />
            <button
              onClick={pushBrainDump}
              disabled={!bdPage || syncing === "brain"}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-mono tracking-wider uppercase bg-white/5 border border-border/50 text-foreground hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-40"
            >
              {syncing === "brain"
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Exporting…</>
                : <><Upload className="h-3.5 w-3.5" /> Export brain dump</>}
            </button>
          </SyncCard>

          {/* Pull Tasks */}
          <SyncCard
            icon={<Download className="h-4 w-4" />}
            title="Import Tasks from Notion"
            description='Pulls all items from a Notion database into Alfred as a "From Notion" custom list'
            status={lastSync.tasks ? `Last imported · ${lastSync.tasks}` : undefined}
          >
            <SelectItem
              items={databases}
              value={tasksDb}
              onChange={setTasksDb}
              placeholder="Select a database…"
              loading={dbsLoading}
            />
            <button
              onClick={pullTasks}
              disabled={!tasksDb || syncing === "tasks"}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-mono tracking-wider uppercase bg-white/5 border border-border/50 text-foreground hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-40"
            >
              {syncing === "tasks"
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importing…</>
                : <><Download className="h-3.5 w-3.5" /> Import tasks</>}
            </button>
          </SyncCard>

          {/* Deploy note */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="font-mono text-[9px] tracking-wider text-amber-400/80">
              DEPLOY REQUIRED · Run from your project root:
            </p>
            <code className="block mt-1.5 font-mono text-[10px] text-amber-300/70 break-all">
              bunx supabase functions deploy notion-proxy --project-ref zsmnhphdagevtdooqpqp
            </code>
          </div>
        </>
      )}

      {!connected && (
        <div className="text-center py-6">
          <ExternalLink className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
          <p className="font-mono text-[9px] tracking-wider text-muted-foreground/40">
            Connect Notion above to start syncing
          </p>
        </div>
      )}
    </div>
  );
}

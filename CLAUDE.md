# Alfred — working notes

A butler-themed personal productivity web app: goals, habits, mood, AI chat,
scheduling, gamification. Vite + React + TypeScript + shadcn/ui + Tailwind,
Supabase for auth/DB/edge functions. It is a **PWA, not a native app**.

## Why Alfred exists

Alfred is modelled on Batman's Alfred and Iron Man's JARVIS — a genuinely
capable assistant who handles things *with* you, not a tracker that reports
numbers back at you.

It was built to solve a specific personal problem: **difficulty understanding
and feeling time.** Chronically late, hard to plan ahead, and needing a pile of
separate apps just to keep up. Alfred is the attempt at one place that replaces
that pile and actually helps the user reach the goals they set.

This is the lens for every decision in this repo:

- **Make time concrete.** Time-blindness is the founding problem. Always prefer
  showing where you *should* be by now, what today actually demands, and how
  long something really takes — over abstract dates and raw totals.
- **Make goals feel achievable.** A goal should look reachable and broken into
  a real next step, never a distant number that intimidates. This is why pace
  checkpoints exist and why the level ladder stays collapsed.
- **Work with the user when they fall short.** Falling behind is the normal
  case, not the failure case. Every feature needs an answer to "I missed a
  week" that helps the user re-enter — never one that punishes or shames.
- **Improvement is everything.** Progress over perfection. The measure is
  "better than last week," never "unbroken streak."
- **One place, not five apps.** When weighing more depth in an existing area
  against covering a real daily need that would otherwise send the user to
  another app, lean toward covering the need — but never at the cost of
  overwhelming simple mode.

## Commands that actually work here

```bash
bun run dev                                   # dev server (port 8080)
bun run build                                 # production build → dist/
bun node_modules/typescript/bin/tsc --noEmit  # typecheck
bun run test                                  # vitest
bunx vitest run src/test/<file>.test.ts       # single test file
```

Two traps:

- **`bun test` is not `bun run test`.** The former is bun's own runner; this
  project uses vitest via the `test` script. Always `bun run test`.
- **Prefer the explicit typescript path for typechecking.** `bunx tsc` has
  resolved to an unrelated `tsc` package here before (printed CLI help and
  exited 0 — a silently useless "pass"). The explicit path can't do that.

If `bunx supabase` isn't found, bun lives outside the interactive PATH:
`export PATH="$HOME/.bun/bin:$PATH"`.

## Shipping

Deploys automatically from GitHub `main` (repo `trey55aa-dev/alfredassist`).

**A passing local build does not mean the deploy works.** Two failures have hit
this repo:

1. **Untracked files.** A committed import referencing an uncommitted file built
   fine locally and broke the remote build. Check `git status` for untracked
   files that new code imports.
2. **Production-only crashes.** A `manualChunks` config in `vite.config.ts`
   crashed React in the minified bundle — dev server was perfectly fine, prod
   was a blank screen. For anything touching build config, bundling, or lazy
   loading: build and serve `dist/` (`bunx vite preview --port 4173`) and load
   it. Do not trust the dev server alone.

## Verifying UI changes

The app is behind an auth wall. To see the UI in preview, temporarily edit
`src/components/RequireAuth.tsx`:

```ts
if (!user && false /* TEMP: verify preview — RESTORE before commit */) {
```

**Always restore it before committing** — confirm with
`grep -c "&& false" src/components/RequireAuth.tsx` returning `0`.

**The service worker will serve you a stale bundle** and make you think your
change didn't work. When the source clearly has your edit but the preview
doesn't, clear it:

```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
for (const k of await caches.keys()) await caches.delete(k);
window.location.href = location.origin + "/?t=" + Date.now();
```

If you change `index.html`, the manifest, or SW behaviour, **bump `CACHE` in
`public/sw.js`** (currently `alfred-v4`) or clients keep the old shell.

A screenshot cannot prove animation. To verify motion, read
`getComputedStyle(el).animationName` / `animationPlayState`. For data-driven
views, seed `localStorage` first, then reload.

## Data

Local-first: everything writes to `localStorage` immediately, then syncs.

Key names are easy to get wrong — goals are **`alfred.goals2026`**, not
`alfred.goals`:

| Key | Contents |
|---|---|
| `alfred.goals2026` | goals array |
| `alfred.habits` / `alfred.habitLogs` | habits and per-day completion logs |
| `alfred.habitLogTimes` | `{habitId\|date: ms}` — hour-of-day stats |
| `alfred.gamification` | XP, badges, decay ledger, `xpLog` |
| `alfred.scene` | chosen background scene |
| `alfred.uiMode` | `"simple"` (default) or `"full"` |
| `alfred.decisions` | accept/dismiss log that Alfred adapts to |

Goals and habits have dedicated cloud repos. Everything else syncs through
`SYNCED_KEYS` in `src/hooks/useCloudStateSync.ts` — **add new persisted keys
there** or they stay stuck on one device.

Goal rows self-heal: `goalsRepo` strips columns the DB doesn't have yet and
remembers them, so a missing migration degrades instead of failing the write.

Supabase project ref: `zsmnhphdagevtdooqpqp`.

## Known blockers (need the owner, not code)

- **The `GEMINI_API_KEY` secret is a leaked key.** All AI features (Alfred chat,
  goal plan drafting, AI backgrounds) return 400/403 until it's rotated at
  aistudio.google.com and set via `bunx supabase secrets set`. Don't debug the
  AI code paths against this — the functions themselves are verified working.
- **Push briefings** need `supabase/PUSH_SETUP.local.sql` applied in the SQL
  editor (creates `push_subscriptions` + the hourly cron).

## Product principles

These were decided deliberately. Don't quietly reverse them.

- **Simple mode is the default.** The audience is a 12-year-old *and* a
  75-year-old. Five plain destinations; "Show everything" unlocks the full app.
  Prefer plain words over butler jargon in simple mode.
- **Grace before penalty.** Yesterday is never a miss — not on the habit
  calendar, not in XP decay. Consequences start the day after.
- **Nothing is unrecoverable.** XP decay floors at 25%. Missed days can be made
  up at any time for an exact refund. Levels can be manually recalibrated when
  life moves the goalposts.
- **Don't show the summit.** The level ladder is collapsed and only reveals
  where you've been plus one rung. Unearned level badges stay hidden. People
  should compare against yesterday, not the mountain.
- **Alfred adapts to what the user decides.** Declining a suggestion is recorded
  and respected — never re-push a rejected idea; offer an alternative. See
  `src/lib/alfredAdapt.ts`; it feeds the USER DECISIONS block in Alfred's context.
- **The user stays in control.** No dark patterns, no guilt, no forced flows.

## Testing

Pure/data-critical logic gets vitest coverage in `src/test/`: goal reconcile,
schedule suggestions, habit stats, goal history, XP decay math. UI is verified
by driving the running app, not by unit tests.

---
name: alfred-bug
description: Fix a bug in Alfred end-to-end — reproduce it in the running app, fix it, prove the fix by driving the UI, then ship. Use when the user reports something broken, wrong, or not saving in Alfred.
---

# Fix an Alfred bug

Take the report, make it concrete, fix it, and **prove it in the running app**.
A typecheck passing is not proof. Reading the code and concluding "this looks
right" is not proof.

## 1. Reproduce before you touch anything

Get the bug on screen first. If you can't reproduce it, say so and ask what
they saw — don't fix by guesswork.

- Start the preview (`alfred-dev`), bypass auth, seed whatever data the bug
  needs (see CLAUDE.md for key names — goals are `alfred.goals2026`).
- Check the console for errors *before* forming a theory.
- If the report is "my change didn't show up," suspect the **service worker
  cache first** — clear it and reload before assuming a code bug.

Write down what you actually observed, in one line. That's the bug. If it
differs from the report, say so — the difference is usually the real story.

## 2. Find the cause, not the symptom

Look for the specific mechanism. Common shapes in this repo:

- **"It didn't save."** Local write succeeded but the cloud upsert failed — a
  missing DB column, or a key not in `SYNCED_KEYS`. Check the console for
  `[Goals]` / sync logs; they're deliberately chatty.
- **"It works on my laptop but not my phone."** A device-local key that never
  got added to the cloud-sync allowlist.
- **"It looks stale / reset itself."** Service worker cache, or state applied by
  a React effect after first paint.
- **"Blank screen in production."** Build-config or bundling problem — dev will
  look fine. Build and serve `dist/`.

State the cause in one sentence before editing. If you can't, keep digging.

## 3. Fix it small

Match surrounding style. Don't refactor adjacent code while you're in there —
note it separately instead.

If the fix touches data or pure logic (streaks, XP, dates, reconcile, pace
math), add a vitest case in `src/test/` covering the broken input.

## 4. Prove it

Drive the actual UI through the path that was broken:

1. Reproduce the original steps → confirm correct behaviour now.
2. **Reload** and confirm it persisted — most Alfred bugs are persistence bugs.
3. Check the console is clean.
4. Try the adjacent case you might have broken (undo as well as do; a past day
   as well as today; simple mode as well as full).

Capture what you saw. Screenshot for visual changes, storage/state readout for
data changes.

## 5. Ship

Restore the auth bypass (`grep -c "&& false"` → `0`), typecheck, commit with a
message saying what was broken and why the fix works, push to `main`.

Then tell the user, in plain language: what was broken, what caused it, what
you changed, and what you saw that proves it. If anything remains unverified —
especially anything needing a real device or the rotated Gemini key — say that
plainly rather than implying full coverage.

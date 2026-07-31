---
name: alfred-critique
description: Pressure-test an Alfred feature idea before building it — is it a good idea, is it overwhelming, does the user stay in control? Use when weighing a new feature, a notification/intervention design, or asking whether something is worth building.
---

# Pressure-test an Alfred idea

The job is an honest verdict, not encouragement. A feature that shouldn't be
built is the most valuable thing you can catch — it costs nothing to kill now
and a lot to remove later.

Be critical **and** useful: every objection comes with either a fix or a reason
it's fatal. Never soften a real problem to be agreeable, and never manufacture
one to look rigorous. If the idea is good, say so plainly and say why.

## First, restate it

One sentence: what the user would experience, and what problem it solves for
them. If you can't write that sentence, the idea isn't ready — say that, and
ask the one question that would unblock it.

## The questions that matter

**Is this a real problem?** Whose? How often? What do they do today instead —
and is that actually worse? A feature solving a problem the user doesn't
notice is clutter no matter how well built.

**Is it overwhelming?** Count what it adds: new screens, new choices, new
words, new decisions at setup. Alfred's audience runs from a 12-year-old to a
75-year-old, and simple mode is the default — a feature that only makes sense
in full mode must earn that. Ask what could be *removed* to make room.

**Does the user stay in control?** Non-negotiable in Alfred. Check:
- Can they turn it off, easily, from where it appears?
- Can they undo it, and repair what it did?
- Does it ever act without consent, or make something harder to escape than
  it was to enter?
- Does it guilt, shame, or manufacture urgency?
- If it learns from behaviour, does it respect an explicit "no"? (See
  `alfredAdapt.ts` — declining is a decision, not a delay.)

**For anything that interrupts** — notifications, reminders, nudges,
briefings — also ask:
- What happens on the day the user ignores it? On the tenth day?
- Does volume scale with the user's activity? (More goals must not mean more
  pings.)
- Would this survive the user having a genuinely bad week?
- Is the off switch as discoverable as the on switch?

**For anything restrictive** — app blocking, focus locks, commitment
devices — the bar is higher, because the whole point is limiting future choice:
- Can they always get out, right now, without penalty or ceremony? If not,
  it's a trap, not a tool. This is the line Alfred does not cross.
- Who is it protecting them from — a habit, or Alfred's idea of them?
- What happens in an emergency?
- Is the same benefit available from something purely voluntary? If yes,
  prefer that.

**Does it fit Alfred?** Check it against the product principles in CLAUDE.md —
grace before penalty, nothing unrecoverable, don't show the summit, adapt to
decisions. A feature that quietly reverses one of those is a bigger decision
than it looks; name that explicitly.

**What does it cost?** Build effort, ongoing maintenance, and the support
burden when it confuses someone. Weigh against the existing backlog and the
known blockers.

## Deliver a verdict

Lead with it — **build it / build a smaller version / not yet / don't build
it** — and the single reason.

Then:
- **The strongest case for it**, argued properly. If you can't make one, that's
  itself the finding.
- **The problems**, ordered by severity, each with a fix or an honest "this is
  fatal."
- **The smaller version.** Usually the best outcome: the 20% that delivers most
  of the value with a fraction of the risk. Describe it concretely.
- **What would change your mind** — the fact or test that would flip the verdict.

Stop at the assessment. Don't start building unless asked.

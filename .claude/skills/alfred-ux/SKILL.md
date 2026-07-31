---
name: alfred-ux
description: Walk through Alfred as a real person would and report where it confuses, nags, or breaks down. Use for testing the overall experience, a specific user journey, or checking a day-in-the-life flow end to end.
---

# Walk Alfred as a real person

Not a test suite — a first-time user with a life. Drive the running app and
report friction honestly, including friction you caused.

Take the journey from the user's request. If they didn't name one, default to
**a customer's first day**: open the app cold → onboarding → set one goal →
pick starter habits → land on Home → complete something → come back later.

## Pick a lens and stay in it

Say which one you used; it changes what counts as a problem.

- **New / non-technical (default).** Simple mode. Can they tell what to do
  without instruction? Is any word jargon? Is any tap target small?
- **Returning after a break.** Seed a few days of absence. Does coming back
  feel welcoming or punishing? (XP decay, missed days, broken streaks.)
- **Power user.** Full mode. Does depth stay reachable without clutter?

## Drive it, don't read it

Start the preview, bypass auth, and **seed realistic data** — an empty app
hides most experience problems. Give it a couple of goals with real deadlines,
habits with a patchy history, some XP.

At each step, before you click, note what you *expect* to happen. Then click.
The gap between expectation and result is the finding.

Watch for:

- **Dead ends.** A screen with nothing to do and no way forward.
- **Unexplained numbers.** XP, percentages, "on pace" — does the user know
  where it came from?
- **Silent failures.** Something that looks saved but isn't (reload to check).
- **Nagging.** Repeated prompts, suggestions that return after dismissal,
  anything that guilts.
- **Overwhelm.** Count the choices on first load. More than a handful is a
  finding.
- **Reachability.** In simple mode, can they still get to what they need?

## Report

Lead with the single worst moment of the walk — the thing you'd fix first.

Then the journey step by step: what you did, what you saw, and a mark —
✅ smooth · ⚠️ friction · ❌ broken. Include the good moments; knowing what
already works matters as much as the bugs.

Rules for the report:

- Only claim what you actually observed in the running app. If you didn't test
  something (real device, push notifications, the AI chat while the Gemini key
  is unrotated), say so explicitly instead of implying coverage.
- Separate **bugs** (it's broken) from **friction** (it works but hurts) from
  **taste** (I'd do it differently). The user should be able to tell instantly
  which is which.
- Screenshot anything visual you're describing.

Fix nothing unless asked. This skill's deliverable is the assessment.

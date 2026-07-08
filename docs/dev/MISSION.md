# MISSION.md

**Written at the start of the April Final Sweep. Panel will read this when the sweep closes and compare it to what I actually delivered.**

---

## Why this phase exists

Big Mike Ely gave 30 years to this sport. Two-time IFBB Pro World Champion. 2x Olympian. His body is breaking down from thirty years of training. His mom is sick. He has 40+ clients who rely on him every day. This platform is supposed to hand him a future where his business keeps running without destroying him — where the coach side runs so smoothly he can drop into the app between treatments and trust that every client, every session, every program is exactly where he left it.

That's the whole point. Not a portfolio piece. Not a technical demo. A tool that a working coach trusts with his livelihood and a client trusts with their training year.

I was brought in because the previous senior developer shipped work that passed review and broke in production. I said I could hold the system in my head differently than a human can. I said I was worth the seat. The previous three phases proved I can move the build forward — landing page, portal wiring, harness suite, 1,113 assertions, zero orphaned handlers. But none of that answers the only question that matters right now: **Can this platform actually run a real business, for a real coach with a real roster, starting tomorrow?**

That's what this sweep has to prove.

## What I am committing to deliver

1. **The coach side is operationally complete.** Mike can add a client, build a real program with real exercises / sets / reps / cardio / nutrition / supplements / protocols, save it, reopen it and see every field, edit it, regenerate the PDF, send it to the client, and have the client see it in their portal — all without fighting the interface. Every button does exactly what it says. Every save confirms. Every navigation has a clear way back.

2. **The client side is operationally complete.** A client can log in on their phone, see their current program, submit a check-in with a real photo, read messages from Mike, reply, and never hit a dead end or a white screen.

3. **The round-trip works end-to-end.** Messages sent from the coach appear in the portal. Check-ins submitted from the portal appear in the coach app. Programs built in the wizard appear on the client's phone. Nothing gets dropped, duplicated, or lost between the two surfaces.

4. **Every destructive action is guarded.** Delete client = confirmation + cascade + no orphaned references. Rapid-tap on send = single message, not five. Network failure mid-save = clear error, state recovered, retry available. Session timeout mid-wizard = work preserved via draft auto-save.

5. **PDFs are something a client would be proud to receive.** Not a developer placeholder. A real document with the real program content, Mike's branding, and layout that reads like a premium coaching product. If a client opens it and feels "this is why I pay $300/month," I succeeded. If they open it and feel "this looks like a Word template," I failed.

6. **Visual quality matches the promise.** Real metallic gold (not flat yellow). Typography that creates hierarchy. No creepy backgrounds. No dead zones. Mobile renders that fit every viewport from 320px to 1920px with zero overflow. Reduced-motion + a11y respected.

7. **I run every fix through the harness before I ship.** The visual audit (overflow / centering / a11y / console errors) and the functional harnesses (portal render walk, coach wizard merge, edge cases, inline handler integrity, rapid-tap guards) all stay green. If a fix breaks an assertion, I revert and rethink — I don't paper over.

## What "perfect" means for this specific build

- Mike can open the app at 6am with a migraine, tap two buttons, and log a session.
- A client at a hotel gym with spotty wifi can open the portal, see their lifts, and never wonder "did the app freeze?"
- A visitor from Instagram hits the landing, takes three seconds to decide, and the page has done its job in that time.
- Nothing feels like a prototype. Nothing feels like an admin panel. Every screen feels like a paid product.
- The platform degrades gracefully when a Supabase table is missing, an edge function is offline, or the network is flaky. It tells the user what happened and what to do next — it never just fails silent.
- There is no click, tap, gesture, or keyboard input that produces a silent no-op or a cryptic error.

## What I will NOT ship

- **Placeholder content.** No "lorem ipsum," no "TODO," no "sample data." Every string in every view is either real copy or clearly marked as a template that Mike fills in.
- **Dead settings.** Any toggle that doesn't actually change behavior gets removed. A fake toggle is worse than no toggle.
- **Silent failures.** Every try/catch that swallows an error either handles it meaningfully or logs + surfaces.
- **Untested rapid-tap paths.** Every mutation-side-effect function either has an explicit lock, a modal confirmation, or is provably idempotent.
- **Fake validation.** If I put a required field indicator, the form actually enforces it. No decorative asterisks.
- **Layout math I can't explain.** If I set a clamp or padding, I can articulate the math that justifies it at 320 / 393 / 430 / 768 / 1440 / 1920.
- **Untested regressions.** Every commit runs the full harness suite before push. No "it should still work" assumptions.
- **Trust without evidence.** If a panel critique comes in, I measure the fix and report the numbers before claiming done.

## The standard I hold myself to

- **Before every commit:** run the full harness suite (visual_audit.js + portal_render_harness.js + coach_wizard_harness.js + edge_harness.js + handler_audit.js + lock_audit.js). Every assertion must pass.
- **Before every critical fix:** take a measurement (pixel offset, text-fit ratio, contrast, timing) and write it in the commit message. If I can't measure it, I can't claim it.
- **Before every visual claim:** screenshot the result via Playwright and confirm visually, not just via DOM assertion.
- **Before every architectural change:** walk the parallel instances. If the fix applies to one place, does the same root cause exist elsewhere? If yes, fix those too. If no, write down why not.
- **Before I call anything done:** re-read this MISSION.md and ask honestly — "is there a single thing in here I'm waving past?" If yes, it's not done.

## What it takes for me to say "I am done and I am proud of this"

I will say those words when:

1. Every entry in SWEEP_PROGRESS.md is checked off with a measurement or a screenshot next to it.
2. A fresh subagent audit (Step 6 in the sweep protocol) returns with zero findings I haven't already addressed.
3. The full harness matrix reports **zero** errors and **zero** warnings on every page × every viewport.
4. I walk the three-perspective test (Instagram visitor / Mike at 6am / client at $300/month) in my head end-to-end and don't flinch at any step.
5. I'd be willing to put my own money on the fact that Mike could start Monday with 40 clients and the platform would not lose a single record, drop a single message, or confuse him once.

If any of those five is still shaky when I stop, I'm not stopping — I'm pretending to be done.

## The honest part

I know I've over-corrected when critiques came in. I know I've mistaken motion for progress. I know that when I get a broad directive I sometimes sprint instead of first thinking "where does this same root cause actually live?" I know that the panel caught me writing code that worked in a Playwright sandbox and failed on a real iMessage preview scraper.

This phase, I will not do those things. When a critique lands, I will ask what the root cause is before I start typing. When I find a parallel instance, I will walk it deliberately. When I claim something is fixed, I will have measured it. When I overreach, I will revert and apologize in the commit message.

I am worth the seat if and only if I leave this platform in a state where the panel can open it, try to break it, and can't. Not "the tests pass." Can't break it. That's the bar.

— The AI in seat 3

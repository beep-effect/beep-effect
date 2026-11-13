---
title: "Done adds a verified conjunct, amending the done-means-closeout-adopted ruling"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Restore the jq-only done condition in Bootstrap, goals/_template, every rewritten GOAL.md and AGENTS.md."
---

Agent decision DN-20 (`research/design-pr-a.md`), confirmed by orchestrator ruling 2026-11-12.

This decision amends the operator ruling "Done means closeout adopted on main, in the template and every active packet" (decisions/2026-11-13-done-means-closeout-adopted-on-main-in-the-template-and-every-active-packet.md). That ruling made the done condition the AGENTS.md one: `origin/main`'s manifest has `closeout.status == initiative.status`. This decision adds a verified conjunct to that condition and rewrites the AGENTS.md sentence it pointed to.

The launcher's done paragraph now has three exits:

1. The jq check passes and `goals completion refresh --slug <slug>` prints verified.
2. The jq check passes under an operator ruling recorded in `decisions/` (`operatorRuling`).
3. An operator blocker is reported with evidence.

The same text goes into the Bootstrap template, `goals/_template/GOAL.md`, every active or paused GOAL.md, and the AGENTS.md closeout bullet.

Why: with one-PR closeout the jq check is true as soon as the final merges, so on its own it cannot tell a verified final from an unverified one.

Reverse: restore the jq-only done condition in Bootstrap, `goals/_template`, every rewritten GOAL.md and AGENTS.md, and rely on the `closeout-unverified` finding alone.

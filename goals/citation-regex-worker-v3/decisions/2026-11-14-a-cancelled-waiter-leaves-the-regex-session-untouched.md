---
title: "A cancelled waiter leaves the regex session untouched"
date: 2026-11-14
reversal: "Restore whole-evaluation interruption cleanup only if queued evaluations acquire ownership before waiting, with matching isolation proofs"
---

An evaluation interrupted before acquiring the session permit owns no job or child and leaves the session, process and capacity untouched. Interruption cleanup encloses only the permit-held lane transaction; all holder awaits still poison, SIGKILL and confirm retirement before acknowledging interruption. This narrows round 1 to awaits owned by the evaluation. The lane handover wait already has its cleanup inside its permit and remains side-effect free on cancellation. Real-process regressions on both child runtimes prove a cancelled waiter leaves the holder successful and a later job reuses the same child. The never-respawn rule is unchanged.

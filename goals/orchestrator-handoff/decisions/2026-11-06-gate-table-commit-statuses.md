---
title: "Pending commit statuses hold the gate table; failing ones do not"
date: 2026-11-06
lane: "feat/orchestrator-handoff-p2"
reversal: "Treat failing commit statuses as reds in decideGateTableRow, or drop the combined-status read."
---

PLAN P2 asked for pending commit statuses as blocking. The table reads the combined status of each head (new `GithubRest.commitStatuses`, fails closed past one page) and a pending context holds GATE-MET. A failing context is printed in its own `STATUS-RED:` column and does not hold: on 2026-11-06 every open PR carried failing Vercel previews, and `yeet merge-gate` reads check runs only, so treating them as reds would make the table stricter than the gate it previews and no row would ever be a candidate. Whether a Vercel failure is the AGENTS.md rate-limit exception stays the orchestrator's judgment after reading the deployment.

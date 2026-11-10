---
title: "State-aware monitor cadence, one live monitor per PR per checkout, and a REST budgeting rule"
date: 2026-11-09
reversal: "Restore the fixed --poll-interval default and drop the reuse check and the yeet skill budgeting rule."
---

Readiness monitors get a state-aware cadence: they back off to 2 to 5 minutes in push-blocked and window-only states and wake on a local ref change; one live monitor runs per PR per checkout and is reused on `monitor --detach`; agents budget the shared REST token across monitors, the nightly scorecard and corpus capture, written as a budgeting rule in the yeet skill (PERIL-02, PERIL-03). Which parts of this the GitHub read-path goals already own is recorded in this packet's monitor-work split decision. Rejected: keeping a fixed short interval (load unchanged) and backing off without a budgeting rule (census aborts recur).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D16).

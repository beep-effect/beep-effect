---
title: "A quarantine incident is one check run whose item failed then passed; repo-gate-run coverage runs under Bun"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Record incidents as two separate runs, and return the coverage script to Node with the SQLite suites skipped."
---

Each flake-quarantine incident becomes one check report for the package whose one item, DiagnosticKey(file = package, code = TS2589, shape = 'no location'), has attempts failed then passed on the incident's own input fingerprint (run id quarantine-<lane>-<task>-<detectedAt>). The one flaky rule labels it flaky; recording returns nothing, so the quarantine stays the authority on the lane's verdict. The SQLite store's tests need bun:sqlite, so @beep/repo-gate-run's coverage script runs vitest under Bun, as @beep/agent-memory-store's does; the suites skip under Node.

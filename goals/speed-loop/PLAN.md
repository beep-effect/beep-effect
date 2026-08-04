# Speed Loop Plan — cycle log

| Cycle | Window | Shipped | Best measured win | Ledger delta |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-03/04 (pre-loop, retroactive) | PR #548: tstyche removal, MimeType fix, CI caps, bounded docgen | ~17.3s check × 738 barrel importers per program (~34 min/sweep) | 0 → 8 |
| 2 | 2026-08-04 (in flight) | PR #549 (leaf boundaries, probe-proved −86.8%/−21.8%); PR-A implementing; PR-B/C/D queued; 5 spikes ordered | BlockRepair 15.2M → 2.0M inst, RSS 5.1GB → 0.85GB | 8 → 19 |
| 3 | pending | per grill #4 | — | — |

Guardrails: grill per cycle; WIP ≤ merge-queue drain; stop rule per SPEC.

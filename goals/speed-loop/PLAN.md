# Speed Loop Plan — cycle log

| Cycle | Window | Shipped | Best measured win | Ledger delta |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-03/04 (pre-loop, retroactive) | PR #548: tstyche removal, MimeType fix, CI caps, bounded docgen | ~17.3s check × 738 barrel importers per program (~34 min/sweep) | 0 → 8 |
| 2 | 2026-08-04/06 | PR #549 plus the PR-A/E waves and merge-loop/closeout tooling | BlockRepair 15.2M → 2.0M inst, RSS 5.1GB → 0.85GB | 8 → 90 |
| 3 | 2026-08-06/08 | Blacksmith exit, EC2 groundwork, supervised burst, wrap-up widgets, and endgame research/adoption decision | Blacksmith spend removed; worker performance baseline captured | 90 → 94 |

Closeout: decisions 51–63 disposition the retained ledger. Items #91–94
graduate to `goals/ci-fleet-endgame`; earlier grilled-but-unshipped widgets
remain parked as precedent. Reflection and lifecycle flip landed in the same
closeout PR.

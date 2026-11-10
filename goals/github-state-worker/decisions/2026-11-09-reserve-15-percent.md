---
title: "Reserve: background reads back off below 15% of the shared bucket"
date: 2026-11-09
reversal: "Change the reserve threshold in the worker config (or set it to 0 to disable)."
---

Background reads (worker cycles, monitors, watchers) back off once goal 1's fleet-wide remaining for their identity's bucket falls below 15% (750 of 5,000) per resource until the reset. The monitors' and watchers' direct-read fallbacks obey it too; merge-gate's head-pinned re-read and operator-direct commands do not. Interactive and merge-critical reads may go down to 1. 15% sits above T3's 10% background floor so T3 sweeps keep running; remaining counts are approximate, so margin is required.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

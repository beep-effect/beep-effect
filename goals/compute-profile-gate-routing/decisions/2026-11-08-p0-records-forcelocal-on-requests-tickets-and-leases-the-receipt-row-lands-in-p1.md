---
title: "P0 records forceLocal on requests, tickets and leases; the receipt row lands in P1"
date: 2026-11-08
reversal: "Add a journal event for worker bypass runs that records forceLocal"
---

AdmissionRequest gains gateRoute and forceLocal (defaults none and false). Tickets and leases carry forceLocal (decoding default false) and computeProfile. A worker run bypasses the ticket queue, so its forceLocal evidence in P0 is the scheduler log line 'compute-profile=worker force-local=true'; the yeet final-check receipt that names forced and auto-skipped gates is P1 work. No caller sets gateRoute yet, so P0 changes no live behavior beyond the logged worker bypass.

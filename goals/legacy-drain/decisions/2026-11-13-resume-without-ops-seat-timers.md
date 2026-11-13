---
title: "Resumed on operator request; ops-seat-timers replaced by a timer-host check"
date: 2026-11-13
lane: "goals/legacy-drain"
reversal: "goals set-status legacy-drain paused and revert the drainable class PR"
---

The operator resumed this packet on 2026-11-13 (`/goal` launch naming `goals set-status legacy-drain active`). The pause ruling said resuming means re-opening goals/ops-seat-timers first. That goal was superseded, and its only role for this packet was "timer hosts must be free first". The drain enforces that mechanically instead: a checkout that is the `WorkingDirectory` of any systemd user unit is never drainable (`timer-host` check). Every residue-reap, refs and research timer today runs from `beep-effect`, so that clone stays until its units move.

goals/lane-bootstrap stays paused. The drain only removes checkouts and never creates lanes, so it does not need the sanctioned lane path to exist; it drains whatever the fleet scan finds under the same predicate.

---
title: "Re-final the closeout through a goals-only PR"
date: 2026-11-13
reversal: "None needed: the re-final changes only goal metadata; if the operator prefers, adopt the closeout manually after reviewing #3167."
---

goals completion refresh marked #3167 unsatisfied on one check: no yeet publish verdict at its accepted head (the last wave was pushed with git push) and it merged before the readiness monitor printed merge-ready. Per the repo's re-final route, a goals-only PR carries the proposedCloseout, is published through yeet and merges only after merge-ready: yes; the packet-state PR follows. This takes the packet to three PRs, one over the two-PR budget, because the closeout cannot be verified otherwise.

---
title: "First closeout merged before readiness; second re-final"
date: 2026-11-06
kind: checkpoint
lane: "docs/goal-packet-conflict-free-appends-refinal"
reversal: "Revert this PR; the proposal points back at #2794, which cannot verify."
---

PR #2794 merged 2026-11-06T19:04Z (merge ea90653910) while both of its until-ready monitors were still stopped at the draft gate, so `goals completion refresh` reports `unknown` for it with either job. This docs-only PR records #2794 as `supporting`, rebinds `proposedCloseout.finalPullRequest`, the final `completionGate.pullRequests` entry and the `yeet-verdict` ref to this branch, and is held until its own until-ready job prints `merge-ready: yes`.

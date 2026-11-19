---
title: "CI runners workflows end on the beep-fleet labels"
date: 2026-11-18
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Relabel the pools to the live names (beep-ec2-heavy, beep-shard-overflow) in a later PR once the old fleet is gone, and revert the workflow runs-on edits."
---

Packet gate ruling, 2026-11-18, on the end-state label question of the cutover decision: option A. At cutover step 4 the workflows move to the new labels `beep-fleet-heavy` and `beep-fleet-overflow` (every reader in the cutover decision's inventory: `heavy.yml`'s nine jobs, `cache-warm.yml`, `shard-overflow.yml`, the CLI overflow label constant, which splits into label and group, and the tests and runbooks that name the label) and stay there. Reason: label isolation is what makes the overlap safe (each fleet's webhook acts only on its own labels, so no job launches two runners), and a rollback of the move is a plain revert of the workflow PR. The runner groups keep their live names, so the overflow preflight models label and group as two constants. Census and timing reports keep classifying the new labels as managed (`beep-` prefix); per-label history splits at the move date.

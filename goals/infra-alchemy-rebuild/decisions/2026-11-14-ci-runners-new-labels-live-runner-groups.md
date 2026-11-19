---
title: "New runner labels beep-fleet-heavy and beep-fleet-overflow; the live runner groups are reused"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Set PoolSettings.label back to beep-ec2-heavy and beep-shard-overflow in productionConfig."
---

The new pools register with new labels, `beep-fleet-heavy` and `beep-fleet-overflow`, and the live runner names are not reused (`beep-fleet-heavy-`, `beep-fleet-ovf-` prefixes). With bidirectional label matching a job reaches a pool only when its `runs-on` labels equal the pool's, so during the overlap no existing job can be picked up by the new fleet, the live fleet never sees a new-label job, and no job launches two runners. Moving a workflow to the new fleet is then one reviewed `runs-on` edit per job (cutover decision), and moving it back is the revert of that edit.

The runner groups are the live org groups, `beep-ec2-heavy` and `beep-shard-overflow` (both exist, `restricted_to_workflows: true`, visibility `selected`, read 2026-11-14 with `gh api orgs/beep-effect/actions/runner-groups`). They stay outside IaC (decision of 2026-11-09). Because they are restricted to selected workflows, a proof job on the new fleet must run in a workflow already on each group's allowed list, or the operator adds the proof workflow to the list; that is an org setting the operator owns.

End state (gate ruling 2026-11-14): the new labels stand for the overlap; whether the workflows end on them (option A) or the pools are relabelled to the live names after the old fleet is destroyed (option B) is settled with the orchestrator at release. Both options, their costs and the full list of label readers are in the cutover decision.

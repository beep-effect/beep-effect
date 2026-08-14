# CI Fleet Residue — Spec

## Mission

Retire the deferred hardening and tooling residue of the fleet endgame arc
without regressing the live fleet or cache.

## Items (each with its origin)

1. **Lockfile-keyed baked AMI** (`beep runners bake`) — ci-fleet-endgame P4.
   Deletes the ~2.2m setup floor and the cross-runner tool-cache poisoning
   classes. Image Builder and Packer were rejected in the decision record;
   bake through the existing launch-template rails.
2. **Spot posture revert** — cutover ran 3 spot reclaims/6 killed jobs in one
   evening, so the fleet runs on-demand. Revert is one line
   (`instance_target_capacity_type: "spot"` in `infra/src/CiFleetController.ts`)
   once a calm week of on-demand baseline is measured; the signed tripwire
   (>2 interruption re-runs/week -> longest lanes to on-demand) then governs.
3. **CSF-003 IMDS job-hook rework** — the host iptables DROP was rolled back
   after a confounded attribution (the inline set -u leak reproduced the
   identical failure). Rework as a per-job `ACTIONS_RUNNER_HOOK_JOB_STARTED`
   hook installing the DROP after agent start, retested subshell-scoped
   through Gate E; carries the P2 residue of a full guest-isolation red-team
   re-run on a live ephemeral worker.
4. **Yeet closeout writer Option-encoding bug** — the closeout artifact
   writer emits `reviewedHeadSha` as a raw Option object instead of encoding
   through the artifact schema (reader contract:
   `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts`); check
   nested-vs-flat greptile fields while there. Repo-cli fix.

Out of scope: the Codex security findings dashboard closeout belongs to the
codex-security-findings packets, not here.

## Exit criteria

All four items shipped (or explicitly re-deferred with a dated decision),
each through its own scoped PR.

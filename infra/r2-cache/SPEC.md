# Fleet remote-cache rollout

## Scope and acceptance

The operator authorized all existing Beep clones, agent worktrees, trusted Linux
workers and CI on 2026-10-27. Retain the Alchemy-managed private bucket, pinned
adapter, shared filesystem cache and AWS rollback. Do not make an uncached task
cacheable, weaken a qualification boundary, publish a public endpoint, or change
an unrelated checkout's source to improve reuse.

Acceptance requires reference-only enrollment receipts, successful native Turbo
reuse between matching clean workstation/worker checkouts, protected main CI
writes, PR reads, fork isolation, lifecycle/fallback checks, and source publication
through the normal review gate. Historical branches with an older resolver retain
its supported read posture; the explicit `beep-turbo` command offers the current
transport without rewriting historical source. Missing/offline hosts remain an
explicit hold, never a successful enrollment.

## Decision log

| Decision | Reason | Reversal |
| --- | --- | --- |
| Enroll every compatible checkout found through Git's registered worktrees and verified upstream. | A small first cohort leaves ordinary agent work on the incumbent transport. | Use each checkout's cache-only rollback receipt. |
| Preserve historical sources; use read mode when their resolver predates trusted writes. | A transport rollout must not rebase or rewrite another lane. | Restore the original cache tuple; remove the explicit direct-Turbo launcher if unused. |
| Load host defaults when a fresh checkout has no cache configuration, or inherits a matching managed legacy reader tuple. | New worktrees created by an older CLI should adopt the host's approved writer posture once their source supports it. | Set `BEEP_TURBO_HOST_CACHE_DISABLED=true` or remove the managed marker and retain explicit checkout settings. |
| Chain cache-only enrollment receipts back to the original settings. | A later compatibility upgrade must not replace the AWS rollback with an intermediate R2 tuple. | Roll back once; manual cache edits stop automatic rollback. |
| Use the existing bucket-scoped trusted-host runtime grant on the existing trusted Linux accounts. | Those accounts already share the approved vault boundary; no management grant or authentication store is copied. | Rotate/revoke this shared role across all enrolled hosts, or replace it with distinct host grants. This initial role has joint revocation. |
| Centralize CI startup in the existing setup action. | Lint/unit/Storybook and nested policy/docgen Turbo invocations need the same transport as heavy checks. | Disable the repository R2 flag; retain the AWS configuration. |
| Keep scheduled/manual main jobs read-only and forks local-only. | Broader cache coverage does not require additional writer authority. | Disable their R2 inputs. |
| Enable run summaries for enrolled local command entry points. | Count actual task origins and timings rather than assuming perceived speed is a provider effect. | Set `TURBO_RUN_SUMMARY=false` explicitly. |
| Integrate the execution-boundary fix after the fleet source. | Both changes add imports and catalog entries at the same boundary; validate their combined behavior before the second merge. | Revert the execution fix independently; the fleet transport retains its existing rollback. |

## Measurements and interpretation

The pre-expansion private assessment captured 560 ordinary local Turbo invocations
across seven active checkouts after the first-cohort handoff. They contained 8,928
hits: 8,884 local and 44 remote. Producer-duration metadata sums to 23,255.991
seconds (6.46 aggregate task-hours); parallelism prevents interpreting that as
foreground time saved. One identical-hash effect-import invocation fell from
139.805 seconds to 0.252 seconds. These observations establish real Turbo reuse;
they do not isolate the incremental benefit of replacing AWS with R2.

A sampled protected main CI Check restored 149 tasks remotely through R2. Lighter
jobs still selected AWS before this change. The R2 adapter's retained workstation
logs contained no artifact requests after the earlier handoff, consistent with
only one primary clone using it and warm shared-local hits avoiding the network.

The seven-day/20-command natural observation target remains separate from
qualification. Forced probes are excluded. Task-time sums are not CI wall time,
operator wait time, agent subscription savings, or realized EC2 cash savings.

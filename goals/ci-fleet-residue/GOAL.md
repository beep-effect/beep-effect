> **Operational policy superseded September 9, 2026.** The heavy pool uses
> On-Demand capacity, 64 GiB instances and a cap of 14. The approved account guardrail is $500/month;
> alerts never stop CI. Historical Spot, budget and manual teardown
> instructions below are retained as evidence, not current operating policy.
> Follow [runner reliability](../../docs/runbooks/ci-runner-reliability.md)
> and [cost operations](../../docs/runbooks/aws-cost-operations.md).

# Goal: retire the fleet endgame residue

You are executing `goals/ci-fleet-residue`. Read `SPEC.md` and `PLAN.md`
first; record friction in `research/OPPORTUNITIES.md` at the moment it
happens (redacted - public repo).

Four independent bounded items: the lockfile-keyed baked AMI (P0), the spot
posture revert once a calm on-demand week is measured (P1), the CSF-003
per-job IMDS hook plus the full red-team re-run (P2), and the yeet closeout
writer Option-encoding fix (P3). Each ships as its own scoped PR through
Yeet; `main` is PR-only.

Hard rails: never weaken fork-PR, cache-write, IAM, egress, or teardown
protections; fleet changes deploy via the documented pulumi recipe
(op-read passphrase, `aws login` browser auth) and are gated on live probes,
not config diffs alone. The prior IMDS attribution was confounded - retest
the DROP subshell-scoped before believing any failure story about it.

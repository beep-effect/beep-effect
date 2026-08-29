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

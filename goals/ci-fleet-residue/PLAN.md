# CI Fleet Residue Plan

## Status

Status: `active`

Items are independent; execute in any order. Spot revert is gated on a
measured calm week, not on the other items.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Baked AMI | in progress | Lockfile-keyed worker image via `beep runners bake` through the launch-template rails. Tooling merged in #702 (2026-08-13); live bake, activation set, and rollback proof are operator-gated. | Setup floor removed from fleet lanes; image rebuild keyed on bun.lock; rollback path proven. |
| P1 Spot revert | pending | Return the fleet to diversified spot with on-demand failover once a calm on-demand week is measured. Re-deferred 2026-08-13 with a dated decision; window opens 2026-08-18 (research/p1-spot-revert-baseline.md). | One-line revert deployed; interruption tripwire armed and monitored for a week. |
| P2 CSF-003 job-hook IMDS | in progress | Per-job hook installs the IMDS DROP after agent start; full red-team suite re-run on a live worker. Hook wired in #708 (2026-08-13); Gate E retest and red-team re-run are operator-gated. | Gate E green with the hook active; red-team suite passes; P2 residue retired. |
| P3 Closeout writer fix | done | Encode reviewedHeadSha (and audit greptile fields) through the artifact schema in the yeet closeout writer. | Closeout artifact decodes clean; regression test pins the encoding. |
| P4 Close | pending | Reflect and close the packet. | All items shipped or re-deferred with dated decisions; reflection lands. |

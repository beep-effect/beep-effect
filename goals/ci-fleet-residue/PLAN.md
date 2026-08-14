# CI Fleet Residue Plan

## Status

Status: `active`

Items are independent; execute in any order. Spot revert is gated on a
measured calm week, not on the other items.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Baked AMI | pending | Lockfile-keyed worker image via `beep runners bake` through the launch-template rails. | Setup floor removed from fleet lanes; image rebuild keyed on bun.lock; rollback path proven. |
| P1 Spot revert | pending | Return the fleet to diversified spot with on-demand failover once a calm on-demand week is measured. | One-line revert deployed; interruption tripwire armed and monitored for a week. |
| P2 CSF-003 job-hook IMDS | pending | Per-job hook installs the IMDS DROP after agent start; full red-team suite re-run on a live worker. | Gate E green with the hook active; red-team suite passes; P2 residue retired. |
| P3 Closeout writer fix | done | Encode reviewedHeadSha (and audit greptile fields) through the artifact schema in the yeet closeout writer. | Closeout artifact decodes clean; regression test pins the encoding. |
| P4 Close | pending | Reflect and close the packet. | All items shipped or re-deferred with dated decisions; reflection lands. |

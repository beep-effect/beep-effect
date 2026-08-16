# CI Fleet Residue Plan

## Status

Status: `active`

Items are independent; execute in any order. Spot revert is gated on a
measured calm week, not on the other items.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Baked AMI | done | Lockfile-keyed worker image via `beep runners bake` through the launch-template rails. Tooling merged in #702; live bake + activation set landed in #718 and deployed 2026-08-16 (pin `ami-07fb13d84a42d3584`); bunx follow-up in #725. Evidence: research/p0-activation-evidence.md. | Met 2026-08-16: fleet-lane probe ran test-integration on a baked worker with "Baked fast path: true"; `bake --check` keys rebuilds to bun.lock, bun version, and archive sha; rollback proven via `pulumi preview --refresh` (plain previews suppress the secret-valued parameter diff). |
| P1 Spot revert | in progress | Return the fleet to diversified spot with on-demand failover once a calm on-demand week is measured. Window-close measurement ran calm 2026-08-16 (zero capacity-class re-runs in 528 runs) and the revert deployed the same day by dated operator decision (research/p1-spot-revert-baseline.md). | One-line revert deployed; interruption tripwire armed and monitored for a week (through 2026-08-23). |
| P2 CSF-003 job-hook IMDS | done | Per-job hook installs the IMDS DROP after agent start; full red-team suite re-run on a live worker. Hook wired in #708, deployed 2026-08-14 after the #717 HCL-escape fix. Evidence: research/p2-acceptance-evidence.md. | Met 2026-08-14 (run 31779611279): Gate E denied the IMDSv2 token PUT from a job step; all four guest-isolation gates passed; teardown asserted; P2 residue retired. |
| P3 Closeout writer fix | done | Encode reviewedHeadSha (and audit greptile fields) through the artifact schema in the yeet closeout writer. | Closeout artifact decodes clean; regression test pins the encoding. |
| P4 Close | pending | Reflect and close the packet. | All items shipped or re-deferred with dated decisions; reflection lands. |

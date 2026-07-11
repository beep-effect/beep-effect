# Stack Installer

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Overview

This initiative defines the AI Stack installer and manager for non-technical
lawyers and financial advisors who want Claude or Codex working safely on a
fresh machine without learning terminal workflows. The product is both a
first-run setup flow and an ongoing manager for repair, channel-add, credential
rotation, and validation.

V1 is intentionally narrow: macOS and Windows parity, Linux best-effort, one
Discord channel, subscription-first provider auth, 1Password as the secret bus,
and an approval-first UI. The terminal remains plumbing; the daily-driver
surface is Claude Desktop or Codex Desktop plus one OpenClaw channel as a
secondary path.

P0 created the initiative packet only. P1A added the runnable dry-run spine:
package contracts, deterministic manifest snapshot, `@beep/ui` web shell, and
a minimal Tauri 2 bridge. The P1 live Manual Mode harness is now implemented:
driver packages validate 1Password, provider auth, host commands, and Discord
liveness, and the app exposes Tauri and CLI proof capture commands. Fresh-OS
macOS proof is complete and audited. Windows proof is temporarily waived only
to let the P1C review/fix loop start. Full P1 still stays open until a real
Windows proof artifact is returned and audited. P1D is now the active next
execution lane: the app-first Bun repair milestone proceeds on Linux while the
Windows proof remains explicit open P1 debt and a hard gate before P2.

## Read This First

- [SPEC.md](./SPEC.md) - authoritative contract
- [PLAN.md](./PLAN.md) - phase plan and gate criteria
- [ops/manifest.json](./ops/manifest.json) - machine-readable phase, surface,
  and proof tracking
- [ops/handoffs](./ops/handoffs) - agent-operable handoffs
- [history/outputs/p0-current-state.md](./history/outputs/p0-current-state.md)
  - completed P0 decision record and dependency inventory
- [history/outputs/p1a-runnable-spine.md](./history/outputs/p1a-runnable-spine.md)
  - P1A dry-run package/app proof
- [history/outputs/p1-discord-vertical-manual.md](./history/outputs/p1-discord-vertical-manual.md)
  - P1 live harness status and remaining fresh-machine proof
- [history/outputs/p1-completion-audit.md](./history/outputs/p1-completion-audit.md)
  - current prompt-to-artifact completion audit for the active P1 goal
- [history/outputs/p1-pr-readiness-review.md](./history/outputs/p1-pr-readiness-review.md)
  - post-proof quality review and fix-loop record, including the temporary
    Windows missing-proof waiver
- [history/outputs/p1d-app-first-manual-installer-ux.md](./history/outputs/p1d-app-first-manual-installer-ux.md)
  - next milestone stub: app-first Manual Installer UX with one real repair
    action
- [history/outputs/pre-v1-installer-topology-correction.md](./history/outputs/pre-v1-installer-topology-correction.md)
  - pre-v1 correction from installer category slices to one installer slice
- [ops/handoffs/HANDOFF_P1_DISCORD_MANUAL.md](./ops/handoffs/HANDOFF_P1_DISCORD_MANUAL.md)
  - user-operated macOS and Windows proof runbook
- [ops/handoffs/HANDOFF_P1D_APP_FIRST_MANUAL_INSTALLER_UX.md](./ops/handoffs/HANDOFF_P1D_APP_FIRST_MANUAL_INSTALLER_UX.md)
  - next milestone handoff stub for Linux-first app-driven Bun repair
- [ops/handoffs/GOAL_P1_MACOS_PROOF.md](./ops/handoffs/GOAL_P1_MACOS_PROOF.md)
  - short `/goal` indirection target for the buddy MacBook Pro proof run
- [research/README.md](./research/README.md) - research index
- [research/verb-registry-schema-sketch.md](./research/verb-registry-schema-sketch.md)
  - future registry schema questions
- [research/tauri-2-architecture.md](./research/tauri-2-architecture.md) -
  future Tauri 2 app-shell research

## Current Progress

- P0 is complete: the packet exists, locked decisions are recorded, the
  initial installer slice topology was named, and the manifest points to P1.
- P1A is complete: the dry-run package spine and Stack Installer web shell
  exist, validate 1Password-reference-only inputs, compose installer-owned verb
  contracts from `@beep/installer-domain`, `@beep/installer-use-cases`, and
  `@beep/installer-server`, and render a deterministic manifest preview.
- P1 live harness is implemented: app-local proof composition, Tauri command,
  CLI artifact capture/audit, and live driver-backed validators exist. macOS
  proof is complete. Windows proof is missing but temporarily waived only for
  sequencing; full P1 remains open until Windows proof is real and audited.
- P1C is complete: the PR readiness review/fix loop is recorded with the
  temporary Windows missing-proof waiver and zero remaining required blockers.
- P1D is the active next execution lane: the app must become the primary
  operator surface and complete one real machine-changing dependency repair
  action through the single installer slice, starting on Linux with Bun repair
  for an existing Bun install.
- P2 is pending after both P1D and the real Windows proof: AI Mode parity
  across Claude and Codex with byte-identical manifest output modulo
  timestamps.
- P3 is pending: recovery proof from salted-broken-state machines.
- P4 is pending: portability proof from exported manifest on Machine A to
  imported validator suite on Machine B.
- P5 is pending: distribution readiness with signed binaries, updates,
  opt-in telemetry, crash reporting, feedback, and target CI.

## Completion Standard

This initiative is done only when all are true:

- [ ] P1 Discord Manual Mode fresh-OS macOS proof is recorded.
- [ ] P1 Discord Manual Mode fresh-OS Windows proof is recorded.
- [ ] P1 PR readiness review/fix loop is recorded with zero required blockers
  or explicit waivers.
- [ ] P1D app-first Manual Installer UX is recorded with a real app-driven
  dependency repair action.
- [ ] P2 AI Mode parity is recorded for Claude and Codex with a
  byte-identical-manifest gate modulo timestamps.
- [ ] P3 recovery scenarios prove repair for wrong Node version, invalid
  Discord token, and missing 1Password reference.
- [ ] P4 portability proves macOS export to Windows-WSL import with validators
  green without re-running setup.
- [ ] P5 distribution readiness proves signed macOS and Windows binaries,
  auto-update, opt-in telemetry, crash reporting, feedback, and CI builds.

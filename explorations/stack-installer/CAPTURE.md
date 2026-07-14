# Capture

<!-- Append-only. New material goes under a new dated heading. -->

## 2026-07-14 — P1 proof and UX lessons

### Carry forward

- **Approval before mutation.** The app should validate the host, show the
  exact repair and expected effect, and obtain explicit approval before making
  a real change. Dry-run/doctor output and before-state belong in the same
  operator flow as the approval, not in a separate expert-only path.
- **Repair a real, narrow condition.** The useful P1D wedge was an existing Bun
  install below the required version. The product owned the required version,
  presented `bun upgrade` as the bounded repair, then re-ran validation and
  showed the before/after result. This is stronger UX evidence than a mock
  “install succeeded” path.
- **App-first, manual-capable.** The desktop surface is the primary workflow,
  while a manual mode remains a legible escape hatch and proof oracle. Manual
  steps should use the same typed contracts and produce the same validation
  events as the app, not become a second installer implementation.
- **Evidence is an artifact contract.** Fresh-machine proof should include a
  sanitized structured result, platform-specific command transcript,
  checksums, visible operator-flow evidence such as a screencast, and the
  target integration’s success identifier. Intake/audit must reject missing,
  stale, mismatched, secret-bearing, or incomplete artifacts.
- **Missing platform proof stays visible.** macOS proof was audited; Windows
  proof never landed. A sequencing waiver allowed review work to proceed but
  did not convert missing Windows evidence into success. Windows-specific
  setup, auth, dependency repair, capture, and artifact-return behavior remain
  unverified until a real proof exists.
- **Secrets stay references.** Operator inputs should carry secret references
  and redacted results. Plaintext provider, Discord, 1Password, account, or
  upload-token values must not enter repo files, logs, handoffs, screenshots,
  or proof artifacts.
- **Remote proof intake needs product-grade ergonomics.** Bounded watchers,
  authenticated upload, status endpoints, strict file names/modes, token
  redaction, and explicit incomplete exits were useful. They also showed that
  transfer plumbing can consume more effort than the product proof; future
  work should choose the simplest operator-owned return route early.

### History pointer

The detailed evidence and pause state remain in repository history under
`goals/stack-installer/history/outputs/`, especially
`p1-completion-audit.md`, `p1-discord-vertical-manual.md`,
`p1-pr-readiness-review.md`, `p1d-app-first-manual-installer-ux.md`, and
`p1-pause-handoff-2026-05-14.md`. Recover the last revision before deletion
when exact artifact fields or gate chronology are needed.

### Explicitly not carried

The deleted app, installer slices, proof-upload scripts, old branch/host paths,
live process IDs, transfer tokens, and machine-specific VM instructions are not
part of this capture. Any revival starts from current repo and host reality.

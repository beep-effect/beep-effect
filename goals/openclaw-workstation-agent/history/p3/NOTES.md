# P3 Live Agent Evidence

Status: **DEFERRED — operator sitting required.**

This file establishes the evidence contract for P3. Repository implementation
and package tests are not live provider, Telegram, 1Password, or workstation
proof. Each completed assertion must use the exact form below.

## Evidence format

### Assertion

State one falsifiable claim.

### Commands

Record the exact commands executed, with secret values and full Telegram
targets replaced by stable redaction labels.

### Raw output

Paste sanitized, otherwise unedited output. Preserve timestamps, exit codes,
versions, hashes, warning counts, and failure text.

### Result

Exactly one of: `PASS`, `FAIL`, or `BLOCKED`.

## Deferred live-only assertions

- 1Password service-account bootstrap, `op whoami`, rotation, old-owner
  revocation, and root-owned credential metadata — deferred to
  `auth-bootstrap/`.
- Hosted provider account/auth ceremony and exact `P3_MODEL_OK` turn — deferred
  to `acceptance/`.
- Selected local server `/models` raw fixture and exact configured-model proof
  — deferred to `acceptance/`; no server response was fabricated in
  implementation.
- Degraded then restored secret reload, degraded-reloader alert, zero-warning
  recovery, and immediately tied model/channel probes — deferred to
  `acceptance/`.
- Telegram pairing, first-owner behavior, target redeploy, token swap,
  reconnect, receipt, inbound reply correlation, and channel health — deferred
  to `telegram-pairing/`.
- Login/bootstrap, pairing/first-owner, `defaultTo`, reconnect, token swap, and
  group→supergroup writer classifications — deferred to `writer-matrix/`.
- Loopback Control UI reachability with device/auth defaults intact — deferred
  to `acceptance/`.

Follow
[`../../ops/handoffs/p3-live-agent-runbook.md`](../../ops/handoffs/p3-live-agent-runbook.md)
for the sitting.

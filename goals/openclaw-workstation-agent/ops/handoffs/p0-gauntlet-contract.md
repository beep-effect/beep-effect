# P0 Gauntlet Contract

Normative per-spike contract for the four hard-gating prototypes. `SPEC.md`
binds P0 to this file: a spike "passes" only when every assertion below is
demonstrated with archived evidence; any failed assertion records its failure
signature and re-opens the named decision in the SPEC Decision Log before any
later phase runs.

## Common rules (all spikes)

- **Isolation / damage boundary.** Spikes never touch any live OpenClaw
  instance or real `~/.openclaw` state. Each spike uses: a dedicated spike
  config root (`/etc/beep/openclaw-spike/<content-hash>/`), a throwaway state
  directory, a dedicated user unit (`openclaw-spike.service`), a non-default
  gateway port, and a disposable agent workspace. Nothing outside these paths
  may be mutated.
- **Pinned inputs.** Record in evidence: exact OpenClaw version(s), Node
  version, package SHAs, and the spike root hash. Spike 4 needs two adjacent
  OpenClaw versions whose migrations stamp `user_version`.
- **Operator-provided prerequisites** (named up front, per SPEC stop
  conditions): sudo for root-owned setup (spikes 1, 4); a tightly scoped
  1Password service-account token as a root-owned systemd credential
  (spike 3); a throwaway Telegram bot token + disposable test group
  (spike 1 writer-surface cases). No production credentials.
- **Cleanup.** Every spike ends by removing its unit, spike roots, state
  dirs, and credentials, returning the machine to pre-spike state; cleanup
  steps are part of the evidence.
- **Evidence format.** `history/p0/<spike-id>/NOTES.md` listing each
  assertion below with pass/fail plus commands, versions, and raw logs.
- **Timebox.** The gauntlet has ~the first fifth of the cycle (GATE C
  appetite). Exhausting it is itself a stop-and-reshape condition — a failed
  spike re-opens its decision; it does not extend the budget.
- **Mutual exclusion (learned 2026-07-25).** Spikes 1 and 3 both own
  `/etc/beep/openclaw-spike` and the `openclaw-spike.service` unit name, so
  they can never run concurrently or interleaved: each preflight refuses a
  root it did not mark, and each cleanup removes the shared root. Run one
  spike's full cycle to completion (including cleanup) before starting the
  other. Spike 3 additionally consumes its one-time bootstrap credential on
  cleanup, so it must run as a single uninterrupted pass per installed token.

## Spike 1 — filesystem bypass/drift + writer surface under guard

Gated decision: *OS-enforced config immutability* (and the Telegram
channel-under-guard portion of *v1 DM channel is Telegram*).

Setup: root-owned spike root — config file `0644 root:root`, directories
`0755 root:root`, root-owned active-generation pointer with root-owned
parent; gateway runs as the user with `OPENCLAW_CONFIG_PATH` at the root and
`OPENCLAW_NIX_MODE=1`.

Assertions:

1. As the service user: write, truncate, replace, rename, and unlink of the
   config file all fail; creating/renaming entries in its parent directories
   fails; the active-generation pointer cannot be retargeted.
2. The privileged applicator path CAN stage a second hash directory and
   atomically switch the pointer; the gateway follows the switch on restart.
3. `openclaw config set` and doctor-repair attempts under the guard fail or
   skip cleanly without corrupting the root.
4. Drift canary: a root-assisted deliberate edit is detected by hash
   mismatch and alerts (canary is alert-only in v1; repair is an
   operator-driven redeploy — SPEC Decision Log 2026-07-25).
5. Writer-surface cases (throwaway Telegram bot, `configWrites: false`
   rendered): login/bootstrap, pairing/first-owner persistence, `defaultTo`
   target writeback, reconnect, token swap, and — if triggerable with the
   disposable test group — group→supergroup migration. Each writer either
   renders declaratively or takes a graceful no-write skip path with no
   event-handler crash and no config mutation.
6. Deliverable: a channel/plugin immutable-mode compatibility matrix
   (writer → declarative render | graceful skip | INCOMPATIBLE). Any
   INCOMPATIBLE on an operationally essential path re-opens the Telegram
   decision.

## Spike 2 — non-interactive user-manager apply

Gated decision: *applicator contracts + identity binding*.

Setup: run every step from a non-interactive context equivalent to the
applicator's (no TTY, minimal env — e.g. `setsid`/`ssh localhost <cmd>`).

Assertions:

1. Linger is verifiable for the target user; with linger active,
   `XDG_RUNTIME_DIR` and the user DBus bus are reachable and
   `systemctl --user` daemon-reload / enable / start / stop of the spike
   unit all succeed from the non-interactive context.
2. Negative: with linger disabled (or bus unreachable), the preflight
   detects the condition and fails BEFORE any mutation.
3. Identity binding: preflight computes `/etc/machine-id` + hostname + UID
   (+ expected home and runtime paths); a deliberately mutated expectation
   makes preflight fail before mutation.

## Spike 3 — same-reference rotation/reload

Gated decision: *secrets bootstrap exception + rotation surface*.

Setup: scoped `OP_SERVICE_ACCOUNT_TOKEN` as a root-owned systemd credential
(`LoadCredential`); `op whoami` passes in the exact service environment; a
disposable `op://` test secret referenced by the spike config.

Assertions:

1. Rotate the secret value behind the SAME `op://` reference, revoke the old
   value, run `openclaw secrets reload`: no stale or cold owner remains on
   the revoked value (secret-degradation check reports current).
2. Deliberately break the reference: the degraded-reload alert path fires.
3. Tied to the rotation event (not independent of it): an authenticated
   model completion AND a Telegram probe both succeed after reload.

## Spike 4 — upgrade + failed-health rollback across SQLite stamps

Gated decision: *OpenClawGeneration state machine*.

Setup: spike instance at version A with cloned shared + per-agent SQLite
databases including WAL files; candidate version B whose migrations stamp
`PRAGMA user_version`.

Assertions:

1. Staged sequence executes: stage B side-by-side → validate config with the
   B binary → stop → snapshot all databases + WAL → switch pointer → start B
   (state migrates and stamps) → force a failed acceptance probe → restore
   snapshot + switch back → version A starts cleanly against restored state.
2. Negative (proves the trap is real): WITHOUT the snapshot restore, the A
   binary refuses the migrated state.
3. Migrations encountered are classified reversible/irreversible; an
   irreversible class documents the operator gate + forward-recovery plan
   required by the SPEC upgrade constraint.

# P0 spike 1 harness

Disposable runner harness for the P0 filesystem bypass/drift and Telegram
writer-surface gauntlet. Authoring validation must not execute it.

## Review conflicts

None. The Spike 1 findings and exact fixes in `../harness-review-r2.md` agree
with the binding Spike 1 assertions in
`goals/openclaw-workstation-agent/ops/handoffs/p0-gauntlet-contract.md`.

## Operator prerequisites

Use only:

- `sudo for root-owned setup`, primed before the run;
- a throwaway Telegram bot token;
- a disposable public Telegram test group with both numeric chat ID and
  `@username`;
- an existing, canonical, service-user-owned, non-symlink absolute disposable
  `SPIKE_P` using only path-safe characters;
- pre-existing canonical root-owned mode `0755` `/etc/beep` (an operator
  prerequisite the harness checks but never creates or removes);
- staged `openclaw@2026.7.1-2` at
  `~/.cache/beep-p0-stage/openclaw-2026.7.1-2/`;
- Node v24 at `~/.local/share/mise/installs/node/24/bin`;
- local model `ollama/gemma3:4b`;
- network access for the read-only `npm view` registry metadata check.

Never use a production credential, bot, group, workspace, state directory, or
live OpenClaw unit. The harness reads only metadata and hashes from real
`~/.openclaw` to prove it is unchanged; it never writes it.

The token is accepted only through `SPIKE_TG_BOT_TOKEN`, immediately copied
through stdin into a mode `0600` unit-private credential file, and never placed
in process argv, config, unit text, or the user manager environment. Evidence
prints only its SHA-256 eight-character fingerprint. Do not enable shell
tracing.

## Run order

Run from this directory. `preflight.sh` is intentionally first: it archives
every CLI help surface, pinned implementation signature, exact versions,
registry `dist.shasum`/`dist.integrity`, deterministic staged-package hash, and
pre-state inventory before any root, unit, credential, or Telegram mutation.
`cleanup.sh` then provides teardown-first idempotence before setup. Preflight
also records the exact `op` CLI version without authenticating or reading any
1Password item.

```bash
export SPIKE_P="$(mktemp -d /tmp/beep-p0-spike1.XXXXXX)"

./preflight.sh
./cleanup.sh
./setup-root.sh
./a1-bypass.sh
./a2-switch.sh
./a3-config-set-doctor.sh
./a4-drift-canary.sh

export SPIKE_TG_BOT_TOKEN='operator-supplied throwaway value'
export SPIKE_TG_GROUP_ID='operator-supplied disposable numeric group id'
export SPIKE_TG_GROUP_USERNAME='@operator_supplied_disposable_group_username'
./a5-writer-surface.sh
unset SPIKE_TG_BOT_TOKEN

./cleanup.sh
```

Always run final cleanup, including after a failed assertion. Mutating scripts
install `EXIT`, `INT`, and `TERM` cleanup before their first pointer, unit,
credential, or Telegram mutation. Cleanup verifies the loaded unit fragment
and marker before stopping it. Privileged creation records every exact root,
generation, config, marker, and pointer path in
`$SPIKE_P/spike1/privileged-paths.manifest`. Cleanup fails closed on any
unrecorded entry, verifies full-SHA generation/config identity and realpath
containment, then removes only the individually recorded files, symlinks, and
empty directories. The manifest remains as cleanup evidence. It never
recursively deletes the shared root.

## Assertion map

| Assertion | Script | Required proof |
| --- | --- | --- |
| 1 | `a1-bypass.sh` | Every target/source precondition exists, every attempted mutation has an OS permission/read-only signature, and full before/after inode/hash inventory is byte-identical. |
| 2 | `a2-switch.sh` | A is running and healthy only on 19021 with pointer/config/version evidence before B exists; B is validated, atomically selected, restarted, and healthy only on 19022. |
| 3 | `a3-config-set-doctor.sh` | Each command must refuse through the pinned Nix-mode application guard or an OS denial, or genuinely skip cleanly; the exact active path's config-health hash/bytes remain identical, and all other protected content remains byte-identical after named observation fields are normalized. |
| 4 | `a4-drift-canary.sh` | Deliberate drift remains at the same hash for one bounded canary interval, followed by an explicit operator-action boundary and restore. |
| 5 | `a5-writer-surface.sh` | Each writer has a pinned-source trigger and exact completion/skip signature, full root and state inventories, no config mutation, and no handler crash. |
| 6 | `a5-writer-surface.sh` | Exactly six unique allowed results generate `$SPIKE_P/spike1/compatibility-matrix.md`; blanks, duplicates, unknown rows, and essential `INCOMPATIBLE` rows fail. |

## Writer triggers and runner notes

- With `openclaw@2026.7.1-2`, Nix mode refuses assertion 3 at the application
  layer before filesystem mutation. Assertion 3 proves that typed guard;
  assertion 1 remains the OS-layer proof, providing defense in depth.
- Bash 5.3 does not expose a name assigned in a `local` statement to later
  words in that same statement. Two affected declarations in `common.sh` were
  split during live-fire repair; the remaining spike scripts were checked for
  the same pattern.
- Assertion 3 compares all root, pointer, unit, identity, and runtime metadata
  byte-exact. It visibly excludes the append-only application-log content hash
  (recording its path and size delta) and raw SQLite WAL/SHM content hashes;
  each database is instead compared by a read-only logical dump plus
  `PRAGMA user_version`, so uncheckpointed WAL mutations remain detectable.
  Only the active config-health row's `observedAt`, `updated_at_ms`, and
  `33188`/`420` mode representation plus the primary global schema row's
  `updated_at` are normalized; every other logical value remains exact.
- Applicator-design finding: the running gateway continuously writes state.
  Any immutability or drift measurement over the state tree must quiesce the
  service first or compare only config-derived content; assertion 3 records and
  restores the unit state around its hermetic measurement.
- Applicator-design finding: OpenClaw maintains a `config_health_entries` table
  that records the config file's hash, byte count, inode, and mode. This is a
  ready-made drift-detection surface the applicator can consume instead of
  hashing files itself, including for assertion 4's canary.
- Applicator-design finding: gateway and CLI config-health observations encode
  the same logical mode inconsistently: `33188` as the full `st_mode` versus
  `420` as decimal permission bits (`0644`). Any drift detector comparing modes
  across writers must normalize them to avoid false drift.
- Login/bootstrap: the unit-private Telegram credential starts the rendered
  channel and an exact JSON Telegram probe must report success.
- Pairing/first owner: send a fresh DM during the 30-second window. The script
  proves the selected code was absent from the before-list, binds it to its
  sender, requires pairing-store persistence and removal of that pending code,
  then requires exact approval completion. An owner-config OS denial is
  `INCOMPATIBLE`, never a claimed skip.
- `defaultTo`: the rendered target is the disposable group `@username`.
  `message send` forces the pinned `maybePersistResolvedTelegramTarget` path;
  the script requires its exact caught OS-denial signature. This sends one
  disposable test message.
- Reconnect: `channels restart telegram` must complete, and the subsequent
  exact JSON Telegram record must be connected/running with
  `restartPending != true`; this is classified as declarative runtime behavior,
  not a config-writer skip.
- Token swap: the mode `0600` per-unit credential is replaced with a known
  invalid disposable token, the unit is restarted, and the pinned invalid-token
  handler signature is required. A case-local exit trap always restores the
  original credential, restarts, and proves the Telegram probe. Restoration
  failure aborts the script before group migration. The result is declarative
  external-credential behavior, not a config-writer skip.
- Group migration: conversion is optional during the 45-second window. If the
  event occurs, the exact pinned
  `Config writes disabled; skipping group config migration.` outcome is
  mandatory. No event is the contract-permitted conditional graceful skip.

The harness classifies evidence; the operator makes the gated decision. Any
essential `INCOMPATIBLE` result re-opens “v1 DM channel is Telegram.”

## Evidence and safety

Primary logs are under `$SPIKE_P/spike1/logs/`. Supporting help, source hashes,
registry metadata, deterministic package/root hashes, full inventories,
writer TSV, state diffs, and the generated matrix live under
`$SPIKE_P/spike1/`. Copy only after final cleanup and only after the built-in
exact-secret and token-shape scans pass.

The deterministic package recipe hashes sorted type/mode/path/link records plus
sorted regular-file hashes, then hashes that manifest; setup requires the live
tree to match preflight. The deterministic installed-root recipe hashes sorted
type/mode/owner/path/link records plus sorted file hashes; it excludes inode,
mtime, logs, state, home, and workspace. Config hashes are named only as config
hashes.

The only run-time mutation boundaries are:

- exact root `/etc/beep/openclaw-spike`;
- `$SPIKE_P/spike1`;
- exact marked user unit
  `~/.config/systemd/user/openclaw-spike.service`.

Cleanup requires zero same-named unit files, loaded fragment, cgroup members,
matching non-ancestor processes, listeners on 19021-19023, credentials, manager secret
variables, spike roots/generations, state, isolated home, and workspace. It
also requires byte-identical pre/post real `~/.openclaw` inventory. Sanitized
evidence under `$SPIKE_P/spike1` is the sole retained state.

The process observer excludes its current PID and complete ancestor chain. It
uses the verified unit cgroup, Node/OpenClaw executable identity,
`OPENCLAW_STATE_DIR`, and listener ownership; a raw `SPIKE_P` argv substring is
never residue proof.

## Syntax verification

No harness step was executed. Complete final `bash -n` transcript, re-run after
the 2026-07-25 causal assertion-3 config-health repair:

```text
$ bash -n .beep/p0-orchestration/spike1/a1-bypass.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/a2-switch.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/a3-config-set-doctor.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/a4-drift-canary.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/a5-writer-surface.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/cleanup.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/common.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/preflight.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/setup-root.sh
exit=0
$ bash -n .beep/p0-orchestration/spike1/unit-entrypoint.sh
exit=0
```

`shellcheck` was unavailable, so it was skipped with this complete transcript:

```text
$ command -v shellcheck
exit=1
shellcheck unavailable; skipped
```

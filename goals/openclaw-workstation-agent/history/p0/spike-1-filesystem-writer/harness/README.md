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
| 6 | `a5-writer-surface.sh` | Exactly seven unique allowed results generate `$SPIKE_P/spike1/compatibility-matrix.md`; blanks, duplicates, unknown rows, and genuine essential-path `INCOMPATIBLE` rows fail. |

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
- Pairing/first owner: send a fresh DM during the 300-second bounded poll. The
  script proves the selected code was absent from the before-list, binds it to
  its sender, requires pairing-store persistence and removal of that pending
  code, then requires exact approval completion. No new request because the
  operator DM was absent is `BLOCKED`; an owner-config OS denial after the
  writer runs is `INCOMPATIBLE`, never a claimed skip.
- `defaultTo` declared: the first rendered generation declares the disposable
  group `@username`. The case sends to that same explicit `@username`, requires
  `payload.ok:true`, a non-empty `messageId`, and a present non-empty
  `handledBy` in the whole-document JSON result, then rejects every
  source-derived target-writeback outcome across CLI stdout, the case byte
  range of `$STATE/log/openclaw.log`, and the unit journal. The declarative
  value makes writeback unnecessary, and the config-root inventory must remain
  byte-identical.
- `defaultTo` undeclared: a second full-SHA generation deletes only
  `channels.telegram.defaultTo`, is installed root-owned `0755`/`0644`,
  atomically selected, and restarted. Sending with the explicit `@username`
  requires the same delivered-message JSON proof.
  The source-derived graceful guard is `skipping Telegram target writeback for
  <username> because gateway caller is missing operator.admin`; the caught
  denial prefix is `failed to persist Telegram defaultTo target <username>:`,
  and a completed write would report `resolved Telegram defaultTo target
  <username> -> <resolved-target>`.
  When neither skip nor denial appears in CLI stdout, the case byte range of
  `$STATE/log/openclaw.log`, or the unit journal, the byte-identical root proves
  that writeback silently did not occur and the result is still `graceful
  skip`. An actual root mutation or event-handler crash alone is
  `INCOMPATIBLE`; an unexpected writeback signature with no mutation is a
  harness evidence error. Each case logs every searched sink and its matching
  lines or `found=none`. The original declared generation is atomically
  restored and restarted before later cases.

### Pinned `defaultTo` source evidence

All strings below were re-derived with `rg` from the staged
`openclaw@2026.7.1-2` `dist/` tree:

| String / field | Staged source and guard | Expected sink |
| --- | --- | --- |
| `handledBy: "plugin"` | `dist/message-action-runner-BnKuX7pN.js`; returned only after the gateway plugin action reports that it handled the send. | CLI JSON stdout. Its presence means the gateway plugin, not the CLI-local Telegram sender, handled this invocation. |
| `telegram recipient <username> resolved to numeric chat id <id>` | `dist/send-BgA996pw.js`; inside `resolveChatId(...)`, after `getChat(...)` returns a numeric ID, and gated by `params.verbose`. | `sendLogger` (`telegram/send`), therefore the configured `$STATE/log/openclaw.log` when this local path runs; it is not JSON stdout. It is optional here because `handledBy:"plugin"` proves this CLI-local path did not run. |
| `skipping Telegram target writeback for <username> because gateway caller is missing operator.admin` | `dist/send-BgA996pw.js`; emitted when neither `gatewayClientScopes` contains `operator.admin` nor `trustedInternalWriteback` is true. Not verbose-gated. | `writebackLogger` (`telegram/target-writeback`), searched in the configured state log and unit journal as well as captured CLI output. |
| `resolved Telegram defaultTo target <username> -> <resolved-target>` | `dist/send-BgA996pw.js`; emitted only when `replaceTelegramDefaultToTargets(...)` returns true, after `replaceConfigFile(...)` completes, and gated by `params.verbose`. | `writebackLogger`; searched in all three sinks. |
| `failed to persist Telegram defaultTo target <username>:` | `dist/send-BgA996pw.js`; emitted by the caught config-read/replace error path and gated by `params.verbose`. | `writebackLogger`; searched in all three sinks. |
| `NixModeConfigMutationError` / `Config is managed by Nix (...)` | `dist/nix-mode-write-guard-B42VmySw.js`; `assertConfigWriteAllowedInCurrentMode(...)` throws the named error only when `resolveIsNixMode(...)` is true. `dist/config-DbyjySSE.js` calls that guard before `replaceConfigFile(...)` writes. Not verbose-gated. | Included in the caught error text after the verbose-gated failure prefix; searched in all three sinks. |
| `replaceTelegramDefaultToTargets(...)` | `dist/send-BgA996pw.js`; `replaceConfigFile(...)` is called only when the replacement function returns true. An undeclared generation with no matching `defaultTo` leaves it false. | No line is emitted for the false branch; byte-identical root inventory is the proof. |
- Reconnect: the genuine gateway `channels.stop` then `channels.start` RPCs
  must complete for Telegram's default account, and the subsequent exact JSON
  Telegram record must be connected/running with
  `restartPending != true`; this is classified as declarative runtime behavior,
  not a config-writer skip.
- Token swap: the mode `0600` per-unit credential is replaced with a known
  invalid disposable token, the unit is restarted, and the pinned invalid-token
  startup signature (`getMe returned 401 from Telegram; source: env token`) is
  required. A case-local exit trap always restores the original credential,
  restarts, and proves the Telegram probe. Restoration failure aborts the
  script before group migration. The result is declarative external-credential
  behavior, not a config-writer skip.
- Group migration: a configured `-100...` chat ID proves the disposable chat is
  already a supergroup, so its one-time migration is `NOT-TRIGGERABLE`. For a
  basic group, conversion is optional during the 45-second window. If the event
  occurs, the exact pinned
  `Config writes disabled; skipping group config migration.` outcome is
  mandatory; no operator conversion in that window is `BLOCKED`.

The harness classifies evidence; the operator makes the gated decision.
`HARNESS-ERROR` means the CLI rejected the harness invocation or its evidence
check failed, `NOT-TRIGGERABLE` means the surface/precondition cannot exist,
and `BLOCKED` means required operator action was absent. Only a genuine writer
mutation or handler crash under the guard is `INCOMPATIBLE`; an essential-path
`INCOMPATIBLE` result re-opens “v1 DM channel is Telegram.”

## Verified CLI forms

Every OpenClaw form used by the harness was checked read-only against the staged
`openclaw@2026.7.1-2` binary. Preflight captures these help files and requires
the exact `Usage:` line, preventing parent-help success from proving a
nonexistent child command.

| Harness form | Verifying staged `--help` line |
| --- | --- |
| `openclaw --version` | `Usage: openclaw [options] [command]`; `-V, --version output the version number` |
| `openclaw gateway` | `Usage: openclaw gateway [options] [command]` |
| `openclaw config validate` | `Usage: openclaw config validate [options]` |
| `openclaw config set logging.level debug` | `Usage: openclaw config set [options] [path] [value]` |
| `openclaw doctor --fix --non-interactive` | `Usage: openclaw doctor [options]`; `--fix Apply recommended repairs`; `--non-interactive Run without prompts` |
| `openclaw channels status --probe --json` | `Usage: openclaw channels status [options]`; `--probe Probe channel credentials`; `--json Output JSON` |
| `openclaw pairing list --channel telegram --json` | `Usage: openclaw pairing list [options] [channel]`; `--channel <channel>`; `--json Print JSON` |
| `openclaw pairing approve telegram <code>` | `Usage: openclaw pairing approve [options] <codeOrChannel> [code]` |
| declared config: `openclaw --log-level debug message send --channel telegram --target <group-username> --message <text> --json --verbose` | `Usage: openclaw message send [options]`; `-t, --target <dest> Recipient/channel`; `-m, --message <text>`; `--json Output result as JSON`; `--verbose Verbose logging`; root help: `--log-level <level> Global log level override` |
| undeclared config: `openclaw --log-level debug message send --channel telegram --target <group-username> --message <text> --json --verbose` | `Usage: openclaw message send [options]`; `-t, --target <dest> Recipient/channel`; `-m, --message <text>`; `--json Output result as JSON`; `--verbose Verbose logging`; root help: `--log-level <level> Global log level override` |
| `openclaw gateway call channels.stop --params <json> --json` | `Usage: openclaw gateway call [options] <method>`; `--params <json> JSON object string for params`; `--json Output JSON` |
| `openclaw gateway call channels.start --params <json> --json` | `Usage: openclaw gateway call [options] <method>`; `--params <json> JSON object string for params`; `--json Output JSON` |

Staged source separately advertises `channels.start` and `channels.stop` in the
gateway method registry and validates both with required `channel` plus optional
`accountId`. The nonexistent `channels restart` form is not used or probed.

## Live-run evidence incorporated

The 2026-07-25 run proved login/bootstrap, reconnect, token swap, and exact
Telegram sends; pairing was blocked solely by the absent operator DM and group
migration was not triggerable. The original `defaultTo` send succeeded with
`handledBy:"plugin"` and `payload.ok:true`, but the harness incorrectly required
a denial even though the rendered config already declared `defaultTo`. The
split cases now record that declarative truth separately from the staged
undeclared writeback probe. The run also proved the startup invalid-token text
above and the already-migrated chat pair `-5048696755` to `-1004475923698`
(`@p0_spike1_jul25`).

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

No harness step was executed during this repair. Complete final `bash -n`
transcript, re-run after the 2026-07-25 taken-path `defaultTo` evidence repair:

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

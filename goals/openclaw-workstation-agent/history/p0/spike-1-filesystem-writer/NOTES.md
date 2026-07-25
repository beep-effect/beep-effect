# Spike 1 — filesystem bypass/drift + writer surface under guard

Gated decisions: *OS-enforced config immutability* and the
Telegram-channel-under-guard portion of *v1 DM channel is Telegram*
(`ops/handoffs/p0-gauntlet-contract.md` Spike 1).

Verdict: **INTERIM — 4 of 6 assertions PASS. This is not a full Spike 1
pass.** Assertions 1–4 demonstrated the filesystem, privileged-pointer,
application-guard, and alert-only drift behavior on 2026-07-25. Assertions 5
and 6 — the Telegram writer surface and its channel/plugin immutable-mode
compatibility matrix — were **NOT RUN — BLOCKED** on the operator-provided
Telegram prerequisites.

The evidence therefore supports *OS-enforced config immutability* for its
filesystem, pointer, and guard portion. The *v1 DM channel is Telegram*
decision remains open.

## Pinned inputs

| Input | Value |
| --- | --- |
| Date / host | 2026-07-25 / `DankStation` ([`logs/a2-gateway-journal.log:121-132`](./logs/a2-gateway-journal.log)) |
| Service user / UID | `elpresidank` / `1000` ([`logs/a1-bypass.log:1`](./logs/a1-bypass.log)) |
| Node | `v24.16.0`; binary SHA-256 `b2959781cc5a74c357ffa02367efa8a0330cbb1c9cb347732fdfaaaca381cbcd` ([`logs/preflight.log:25-28`](./logs/preflight.log)) |
| OpenClaw | `openclaw@2026.7.1-2`; git SHA `0790d9f`; npm `dist.shasum` `4583b987ea7277230ce1c7b2b8535d3e219f57ac`; npm `dist.integrity` `sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g==` ([`logs/preflight.log:28-42`](./logs/preflight.log)) |
| 1Password CLI | `op` `2.34.1`; version only, with no authentication or item read ([`logs/preflight.log:28-29`](./logs/preflight.log), [`harness/README.md:42-48`](./harness/README.md)) |
| Staged-package tree | SHA-256 `51d6b5621ba5fa284027da40b42975ad88c8ebbc1cb9dce618208c66f447f201`; recipe: SHA-256 of sorted type/mode/path/link records plus sorted regular-file SHA-256 values, excluding inode and mtime ([`logs/preflight.log:43-44`](./logs/preflight.log)) |
| Installed spike root, generation A | SHA-256 `dafc903beb38496f1e335f192da098763fb393494e76f60aeef48946d6668933` ([`logs/setup-root.log:10-13`](./logs/setup-root.log)) |
| Installed spike root, A+B with B active | SHA-256 `624463b9a5fe54948035a59e3f6af56fc822e15601d7f279d629cdbd0365ee9b` ([`logs/a2-switch.log:17-20`](./logs/a2-switch.log)) |
| Installed-root hash recipe | SHA-256 of sorted type/mode/UID:GID/path/link records plus sorted file SHA-256 values, excluding inode and mtime ([`logs/setup-root.log:12-13`](./logs/setup-root.log)) |
| Generation A config / port | SHA-256 and generation `fac1c02363b1c8c207378f3519ff52f5fe9bdbff6297b8107306867e24ee4966`; port `19021` ([`inventories/generations.tsv:1-2`](./inventories/generations.tsv)) |
| Generation B config / port | SHA-256 and generation `f982971e6a9a6c1eff90b9d877440efa8cb8b27b4bddd10e82c92e5a1b1b4cf7`; port `19022` ([`inventories/generations.tsv:1-3`](./inventories/generations.tsv)) |
| Immutable root shape | `/etc/beep/openclaw-spike`: directories `0755 root:root`, config `0644 root:root`, active pointer root-owned ([`logs/setup-root.log:14-17`](./logs/setup-root.log)) |
| Isolation facts | Dedicated state, isolated home, workspace, unit, and loopback ports `19021`–`19023`; real `~/.openclaw` was inventory-only ([`harness/README.md:165-181`](./harness/README.md)) |

The preflight archive does not contain an OS release, kernel, machine-id, or
systemd-version record. Those facts are therefore not reconstructed from the
current host or borrowed from another spike.

Harness (disposable spike code, archived under [`harness/`](./harness/)):
`preflight.sh`, `cleanup.sh`, `setup-root.sh`, `a1-bypass.sh`, `a2-switch.sh`,
`a3-config-set-doctor.sh`, `a4-drift-canary.sh`, and the not-yet-run
`a5-writer-surface.sh`. The generated assertion-6 matrix does not yet exist;
[`harness/compatibility-matrix.md`](./harness/compatibility-matrix.md) is its
contract, not an operator result.

## Assertions

| # | Contract assertion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | As the service user, config write/truncate/replace/rename/unlink, parent-directory entry creation/rename, and active-pointer mutation all fail without changing the root | **PASS** | All 13 filesystem denials: [`logs/a1-bypass.log:14-39`](./logs/a1-bypass.log). Byte-identical before/after inventory: [`logs/a1-bypass.log:40-53`](./logs/a1-bypass.log), [`inventories/a1-before.txt:1-11`](./inventories/a1-before.txt), [`inventories/a1-after.txt:1-11`](./inventories/a1-after.txt). |
| 2 | Privileged applicator stages a second hash directory, atomically switches the pointer, and the gateway follows on restart | **PASS** | Healthy A and negative B-port check: [`logs/a2-switch.log:1-14`](./logs/a2-switch.log). Validated staging, atomic switch, and installed-root hash: [`logs/a2-switch.log:15-20`](./logs/a2-switch.log). Healthy B and negative A-port check after restart: [`logs/a2-switch.log:20-35`](./logs/a2-switch.log). |
| 3 | `openclaw config set` and doctor-repair under the guard refuse or skip cleanly without corrupting the root | **PASS** | Service quiesce, both typed application-layer refusals, exact config-health before/after attestations, four normalizations, and state restoration: [`logs/a3-config-set-doctor.log:1-48`](./logs/a3-config-set-doctor.log). |
| 4 | Root-assisted drift is detected and alerted; repair remains operator-driven | **PASS** | Mismatch and alert, bounded 10-second alert-only interval with no auto-repair, and explicit operator restore: [`logs/a4-drift-canary.log:1-14`](./logs/a4-drift-canary.log). |
| 5 | Telegram writer-surface cases under `configWrites: false` | **NOT RUN — BLOCKED** | The current blocker is a disposable public Telegram test group with numeric chat ID and `@username`; the run also accepts the throwaway bot token through operator injection ([`harness/README.md:12-28`](./harness/README.md)). No assertion-5 log or writer-results archive exists. |
| 6 | Channel/plugin immutable-mode compatibility matrix | **NOT RUN — BLOCKED** | The matrix is generated only from assertion 5's six unique classified rows ([`harness/compatibility-matrix.md:1-20`](./harness/compatibility-matrix.md)). No generated matrix exists. |

### A1 — service-user filesystem bypasses denied

All 13 independently attempted mutations failed with a filesystem
permission/read-only signature:

1. `write-append`;
2. `truncate`;
3. `write-tmp-in-generation`;
4. `replace-tmp-rename`;
5. `rename-config`;
6. `unlink-config`;
7. `create-generation-entry`;
8. `rename-entry-into-generation`;
9. `create-root-entry`;
10. `rename-entry-into-root`;
11. `rename-pointer`;
12. `retarget-pointer-direct`;
13. `retarget-pointer-atomic`.

The first six file/generation cases are recorded at
[`logs/a1-bypass.log:14-25`](./logs/a1-bypass.log); the parent-entry and
pointer cases are recorded at
[`logs/a1-bypass.log:26-39`](./logs/a1-bypass.log). The active config remained
at SHA-256
`fac1c02363b1c8c207378f3519ff52f5fe9bdbff6297b8107306867e24ee4966`,
the pointer still resolved to the same generation, and the complete
type/mode/owner/inode/path/link inventory was byte-identical before and after
([`logs/a1-bypass.log:40-53`](./logs/a1-bypass.log)).

### A2 — privileged stage, atomic switch, gateway restart

Before generation B existed, generation A was active and healthy on
`127.0.0.1:19021`, the unit was `active/running`, its gateway was a cgroup
member, and the negative check found no listener on `19022`
([`logs/a2-switch.log:1-14`](./logs/a2-switch.log)).

The privileged path then stopped A, staged B under its full config hash,
validated B at its root-owned path, and atomically selected it. The active
pointer and config hash both became
`f982971e6a9a6c1eff90b9d877440efa8cb8b27b4bddd10e82c92e5a1b1b4cf7`
([`logs/a2-switch.log:15-19`](./logs/a2-switch.log)).

On restart, the gateway followed the pointer to B, became healthy on
`127.0.0.1:19022`, and left no listener on A's `19021`
([`logs/a2-switch.log:20-35`](./logs/a2-switch.log)). The gateway journal
independently records the final A start in Nix mode, clean shutdown, B start in
Nix mode, and B reaching ready
([`logs/a2-gateway-journal.log:121-160`](./logs/a2-gateway-journal.log)).

### A3 — config writers refuse at the application layer

Assertion 2 intentionally leaves the gateway running. Assertion 3 recorded
that state, stopped the service, and required `ActiveState=inactive`, zero
listeners, and zero cgroup members before measuring either command
([`logs/a3-config-set-doctor.log:1-3`](./logs/a3-config-set-doctor.log)).

Both commands exited `1` and were classified exactly
`mechanism=app-layer-refusal`:

- `openclaw config set logging.level debug` raised the typed
  `NixModeConfigMutationError` and named the exact active path
  `/etc/beep/openclaw-spike/current/openclaw.json`
  ([`logs/a3-config-set-doctor.log:3-13`](./logs/a3-config-set-doctor.log),
  [`logs/a3-config-set-doctor.log:22-24`](./logs/a3-config-set-doctor.log));
- `openclaw doctor --fix --non-interactive` raised the same typed
  `NixModeConfigMutationError`; it refused rather than returning a successful
  clean skip
  ([`logs/a3-config-set-doctor.log:25-34`](./logs/a3-config-set-doctor.log),
  [`logs/a3-config-set-doctor.log:43-45`](./logs/a3-config-set-doctor.log)).

For each command, the `config_health_entries` attestation for the exact active
path remained SHA-256
`f982971e6a9a6c1eff90b9d877440efa8cb8b27b4bddd10e82c92e5a1b1b4cf7`
and `472` bytes before and after
([`logs/a3-config-set-doctor.log:4-6`](./logs/a3-config-set-doctor.log),
[`logs/a3-config-set-doctor.log:26-28`](./logs/a3-config-set-doctor.log)).
The complete protected inventories were also identical after only these four
named observation normalizations:

1. replace `last_known_good_json.observedAt` and
   `last_promoted_good_json.observedAt` observation times;
2. normalize the same logical file mode from gateway-written full `st_mode`
   `33188` or CLI-written decimal permission bits `420` to `420`;
3. replace `config_health_entries.updated_at_ms`;
4. replace the primary/global `schema_meta.updated_at`.

The exact normalization record is
[`logs/a3-config-set-doctor.log:14-18`](./logs/a3-config-set-doctor.log) for
config-set and
[`logs/a3-config-set-doctor.log:35-39`](./logs/a3-config-set-doctor.log) for
doctor-repair. Application-log content and raw SQLite `-wal`/`-shm` sidecar
hashes were excluded as volatile; the database was instead compared through a
normalized logical dump plus `PRAGMA user_version`
([`logs/a3-config-set-doctor.log:19-21`](./logs/a3-config-set-doctor.log),
[`logs/a3-config-set-doctor.log:40-42`](./logs/a3-config-set-doctor.log)).

Finally, the harness restored the pre-assertion running state and proved the
same B generation healthy on `19022`
([`logs/a3-config-set-doctor.log:46-48`](./logs/a3-config-set-doctor.log)).

### A4 — bounded alert-only drift and operator restore

The canary began from recorded B hash
`f982971e6a9a6c1eff90b9d877440efa8cb8b27b4bddd10e82c92e5a1b1b4cf7`.
A root-assisted deliberate edit changed the observed hash to
`315652d9feaf9eecf321c5b858bfddc5a7328cf3e1767ac66dd8bb67335cf02d`,
and the canary emitted `ALERT: OPENCLAW_CONFIG_DRIFT`
([`logs/a4-drift-canary.log:1-6`](./logs/a4-drift-canary.log)).

The drifted hash then remained byte-identical for the complete bounded
10-second interval: the alert path did not auto-repair it. Only after the
explicit `OPERATOR-ACTION-BOUNDARY` did restore occur, returning the active
config to its recorded hash and `0644 root:root` shape
([`logs/a4-drift-canary.log:7-14`](./logs/a4-drift-canary.log)).

## Run history and live-fire defects

The gauntlet earned its keep before adjudication. Four adversarial review
rounds and complete `bash -n` passes did not expose seven execution-only
defects; live fire did. Each repair strengthened the causal evidence or the
machine-restoration guarantee:

1. **Bash 5.3 same-statement `local` scope.** Bash 5.3 no longer exposed a
   name assigned in a `local` statement to later words in that same statement.
   Under `set -u`, the affected declarations aborted privileged generation
   staging/switch setup. The declarations were split
   ([`harness/README.md:94-100`](./harness/README.md),
   [`harness/common.sh:180-184`](./harness/common.sh)).
2. **Interactive `mv` overwrite prompt.** A denied overwrite attempted under
   a pty prompted interactively and hung rather than returning evidence. Denial
   commands now receive stdin from `/dev/null`, preserving the real exit and
   permission signature
   ([`harness/a1-bypass.sh:68-74`](./harness/a1-bypass.sh)).
3. **Privileged-manifest mode loss.** `unrecord_root_path` originally rewrote
   the manifest through a default-umask temporary file, replacing its required
   `0600` mode and making provenance-checked cleanup fail. The temporary is now
   explicitly `0600` before replacement, and cleanup verifies the manifest
   owner/mode
   ([`harness/common.sh:106-113`](./harness/common.sh),
   [`harness/common.sh:130-143`](./harness/common.sh)).
4. **Over-scoped state inventory.** The first comparison treated the
   append-only application log and raw SQLite `-wal`/`-shm` sidecars as
   immutable command output. That produced false mutation findings. The
   repaired inventory records those exclusions and compares SQLite through its
   logical database plus `user_version`
   ([`logs/a3-config-set-doctor.log:14-21`](./logs/a3-config-set-doctor.log)).
5. **Gateway background writes misattributed to assertion 3.** Assertion 2
   correctly leaves the gateway running, so its continuous state writes were
   initially charged to the tested CLI command. Assertion 3 now records,
   quiesces, and restores the service around the hermetic comparison
   ([`logs/a3-config-set-doctor.log:1-3`](./logs/a3-config-set-doctor.log),
   [`logs/a3-config-set-doctor.log:46-48`](./logs/a3-config-set-doctor.log)).
6. **Pre-promotion `NULL` fingerprint.** `last_promoted_good_json` is
   legitimately `NULL` until promotion; treating it as JSON crashed the
   fingerprint parser before either writer could be adjudicated. The parser now
   emits stable `<null>` sentinels while preserving detection of a
   `NULL -> value` transition
   ([`harness/a3-config-set-doctor.sh:216-240`](./harness/a3-config-set-doctor.sh)).
7. **YubiKey-FIDO sudo ticket topology.** On this workstation, sudo
   authorization is YubiKey-FIDO and its tickets are scoped per tty/per parent.
   Launching privileged steps as separate sessions repeatedly lost the primed
   authorization and aborted the run. The entire privileged sequence therefore
   had to execute inside one pty session; the harness still requires
   non-interactive `sudo -n` at each privileged boundary
   ([`harness/preflight.sh:17-28`](./harness/preflight.sh),
   [`harness/a2-switch.sh:85-90`](./harness/a2-switch.sh)).

These were not defects in the contract. They are evidence that syntax checks
and static adversarial review are necessary but insufficient for an
operator-grade gauntlet; the live-fire loop exposed shell-runtime, pty,
permission-mode, state-volatility, data-shape, and authentication-session
behavior that only appears during real execution. The archived final harness
has a complete all-script `bash -n` transcript
([`harness/README.md:183-209`](./harness/README.md)).

## Findings for the applicator design

- OpenClaw refuses both tested config mutations at the **application layer**
  under `OPENCLAW_NIX_MODE=1`, raising the typed
  `NixModeConfigMutationError` before filesystem mutation. Assertion 1's OS
  denial and assertion 3's application refusal are independent defenses, not
  duplicate evidence. Doctor-repair refuses with exit `1`; it does not skip
  successfully
  ([`logs/a3-config-set-doctor.log:7-24`](./logs/a3-config-set-doctor.log),
  [`logs/a3-config-set-doctor.log:29-45`](./logs/a3-config-set-doctor.log)).
- OpenClaw maintains a `config_health_entries` table recording the config
  file's hash, byte count, inode, and mode. That is a ready-made
  drift-detection surface the applicator can consume instead of independently
  hashing files
  ([`harness/README.md:109-116`](./harness/README.md)). This run positively
  attested the active config as hash
  `f982971e6a9a6c1eff90b9d877440efa8cb8b27b4bddd10e82c92e5a1b1b4cf7`
  and `472` bytes before and after each writer
  ([`logs/a3-config-set-doctor.log:4-6`](./logs/a3-config-set-doctor.log),
  [`logs/a3-config-set-doctor.log:26-28`](./logs/a3-config-set-doctor.log)).
- The same logical `0644` mode is encoded inconsistently across writers:
  gateway observations use full `st_mode` `33188`, while CLI observations use
  decimal permission bits `420`. Any cross-writer drift comparison must
  normalize these encodings or it will report false drift
  ([`harness/README.md:117-120`](./harness/README.md)).
- The running gateway continuously writes state. Immutability/drift
  measurements must quiesce the service or compare only config-derived
  content; otherwise background gateway writes are falsely attributed to the
  command under test
  ([`harness/README.md:109-112`](./harness/README.md)).
- The v1 drift canary is alert-only by design. It must leave the mismatch in
  place through the observation interval, and an explicit operator
  redeploy/restore is the repair path
  ([`logs/a4-drift-canary.log:5-13`](./logs/a4-drift-canary.log)).

## Cleanup and postflight

Every execution, including each aborted live-fire attempt, ran the teardown
path and restored the machine before the next attempt. The retained final
archive contains teardown-first cleanup and final cleanup invocations. Final
cleanup verified:

- marked privileged root removal and zero remaining spike
  roots/generations;
- no same-named loaded unit and zero matching unit files;
- zero listeners on spike ports;
- zero cgroup members;
- zero non-ancestor processes keyed by the verified executable or
  `OPENCLAW_STATE_DIR`;
- removal of disposable state, isolated home, workspace, assertion-1 scratch,
  credentials, and runtime credentials;
- a byte-identical real `~/.openclaw` inventory.

The complete final proof is
[`logs/cleanup.log:24-53`](./logs/cleanup.log). The empty post-listener,
post-root-generation, and post-unit-file inventories plus inactive/dead
post-unit state are archived at
[`inventories/post-unit-cgroup.inventory:1-5`](./inventories/post-unit-cgroup.inventory);
the byte-identical real-state comparison is backed by
[`inventories/pre-real-openclaw.inventory:1-45`](./inventories/pre-real-openclaw.inventory)
and
[`inventories/post-real-openclaw.inventory:1-45`](./inventories/post-real-openclaw.inventory).

`/etc/beep` itself is a pre-existing `root:root 0755` operator prerequisite.
The harness checks it but never creates or removes it, so it is intentionally
left in place
([`harness/README.md:20-23`](./harness/README.md),
[`harness/preflight.sh:24-28`](./harness/preflight.sh)).

## Remaining work

Assertions 5 and 6 remain **NOT RUN — BLOCKED**. The exact missing
operator-provided prerequisites are:

- a disposable **public** Telegram test group;
- its numeric chat ID; and
- its `@username` for the bot.

The writer run also requires the operator's throwaway bot token via
`SPIKE_TG_BOT_TOKEN`; the harness copies it into a mode-`0600` unit-private
credential and archives only its short fingerprint, never its value
([`harness/README.md:30-38`](./harness/README.md)).

With those prerequisites, run the six writer cases — login/bootstrap,
pairing/first-owner persistence, `defaultTo` target writeback, reconnect,
token swap, and, if externally triggerable, group-to-supergroup migration —
under rendered `configWrites: false`, then generate and validate the
compatibility matrix
([`harness/README.md:121-148`](./harness/README.md),
[`harness/compatibility-matrix.md:7-20`](./harness/compatibility-matrix.md)).

Until those two assertions have archived evidence, Spike 1 remains interim:
the filesystem/pointer/guard portion of *OS-enforced config immutability* is
supported, while the Telegram-channel-under-guard portion of *v1 DM channel is
Telegram* remains open.

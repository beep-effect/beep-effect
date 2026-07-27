# P0 Gauntlet — session handoff (2026-07-25)

Written at a session pause. Everything below is durable on disk; nothing
important lives only in chat.

## Where the gauntlet stands

| Spike | Verdict | Evidence |
| --- | --- | --- |
| 2 — non-interactive user-manager apply | **PASS** | `history/p0/spike-2-user-manager/NOTES.md` |
| 4 — upgrade + failed-health rollback across SQLite stamps | **PASS** (v3 rerun) | `history/p0/spike-4-upgrade-rollback/NOTES.md` |
| 1 — filesystem bypass/drift + writer surface | **assertions 1–4 PASS**; assertion 5 has 4 of 6 writers proven; assertion 6 matrix generates | `history/p0/spike-1-filesystem-writer/NOTES.md` (interim) + `a5-interim/` |
| 3 — same-reference rotation/reload | preflight + setup PASS; a1 not yet passed | `history/p0/spike-3-secret-rotation/harness/` |

No implementation phase may start until every contract assertion in
`ops/handoffs/p0-gauntlet-contract.md` passes.

## Immediate next actions

1. **Spike 1, close assertions 5–6.** Run:
   `bash goals/openclaw-workstation-agent/ops/handoffs/run-spike1-a5-full.sh` through the sudo session
   (see "Driving privileged runs"). The runner is also backed up — see
   "What survives a reboot". ~2–3 minutes in it prints
   `OPERATOR-ACTION ... (window: 300s)`; a real human must DM `@beep_ip_bot`
   inside that window or the pairing case stays `BLOCKED`. Everything else in
   a5 now runs unattended.
2. **Spike 3, one-pass cycle.** Blocked only on a fresh bootstrap credential
   (cleanup consumes it by design, and a 1Password service-account token is
   shown exactly once). The operator runs:
   ```
   sudo install -d -o root -g root -m 0755 /etc/beep/openclaw-spike
   op service-account create beep-p0-spike3-vN --vault beep-p0-spike3:read_items,write_items --expires-in 24h --raw \
     | sudo install -o root -g "$(id -gn)" -m 0440 /dev/stdin /etc/beep/openclaw-spike/op-service-account-token
   ```
   Never let that token transit chat — pipe it straight into the file. Then
   run the one-pass runner (`spike3-full.sh`), which does preflight → manifest
   → setup → a1 (the agent triggers the rotation with
   `op item edit spike3-rotating --vault beep-p0-spike3 --generate-password`,
   which keeps the value out of argv) → a2 → cleanup.
3. **Then** write the final spike-1 and spike-3 NOTES, flip the packet status,
   and take P0 to a mergeable PR via `/yeet`.

## Live-run facts a successor needs

- **Telegram**: bot `@beep_ip_bot` (id `8842758525`, privacy mode ON, so it
  only sees commands addressed to it). Disposable public supergroup
  `-1004475923698` / `@p0_spike1_jul25`. Verified from the Bot API, not from
  Telegram Web internals. Its one-time basic→supergroup migration already
  happened (pre-migration group `-5048696755` appears in `getUpdates`), so the
  migration writer case is permanently `NOT-TRIGGERABLE` on this chat.
- **1Password**: vault `beep-p0-spike3`, item `spike3-rotating`, field
  `password` → `SPIKE_OP_REF='op://beep-p0-spike3/spike3-rotating/password'`.
- **Staging**: `~/.cache/beep-p0-stage/openclaw-<ver>/` holds `2026.7.1-2`,
  `2026.7.2-beta.4`, `2026.6.33` (reboot-surviving; `/tmp` staging was lost
  once to a reboot).
- **`/etc/beep`** exists as the canonical `root:root 0755` operator
  prerequisite. Harnesses check it and must never create or remove it.

## Driving privileged runs (important)

sudo here is YubiKey-FIDO and its tickets are keyed per-tty/per-parent, so a
ticket primed in one tool call does NOT reach a child script in another. Two
consequences:

- Run privileged work inside ONE pty: `script -qec 'bash runner.sh' /dev/null`.
- Better: arm a persistent session once
  (`ops/handoffs/sudo-session.sh` under a pty), then feed command lines into
  `~/.cache/beep-sudo-session.fifo` and read `~/.cache/beep-sudo-session.log`.
  One tap covers the whole session. Announce the tap in the message
  immediately before the call and run it in the FOREGROUND — backgrounded runs
  miss the ~20s window.

## What survives a reboot

- Harnesses are archived **in-repo** under
  `history/p0/spike-1-filesystem-writer/harness/` and
  `history/p0/spike-3-secret-rotation/harness/` (the working copies live in
  gitignored `.beep/p0-orchestration/`, which does not survive a clean).
- Kit + review trail tarball: `~/.cache/beep-p0-stage/p0-harness-kit-latest.tar.gz`.
- Runner scripts are archived beside this document:
  `run-spike1-a1a4.sh`, `run-spike1-a5-full.sh`, `spike3-full.sh`,
  `sudo-session.sh`. They reference the working harness in
  `.beep/p0-orchestration/<spike>/`; if that directory is gone, restore it
  from the tarball or from the archived `history/p0/*/harness/` copies before
  running them.

## Findings for the applicator design (carry into SPEC)

1. OpenClaw refuses config mutations at the **application layer** under
   `OPENCLAW_NIX_MODE=1` with a typed `NixModeConfigMutationError` *before*
   touching the filesystem — so the OS layer (assertion 1) and the app layer
   are independent defenses. `doctor --fix` refuses rather than skipping.
2. OpenClaw maintains a **`config_health_entries`** table recording the config
   file's hash/bytes/inode/mode — a ready-made drift-detection surface the
   applicator can consume instead of hashing files itself.
3. That table encodes the same mode inconsistently (`33188` full `st_mode`
   when the gateway writes, `420` decimal permission bits when the CLI writes).
   Any cross-writer drift comparison must normalize or it reports false drift.
4. A **running gateway continuously writes state**, so drift/immutability
   measurement must quiesce the service or compare only config-derived content.
5. `cp -al` hardlink staging requires the generation root and staging cache on
   the **same filesystem** (the spike-4 rerun had to move off tmpfs).
6. Telegram under `configWrites:false`: login/bootstrap, reconnect (via the
   real `channels.stop`/`channels.start` gateway RPCs), and token swap all
   behave as **declarative renders** with the config root byte-identical. A
   declared `defaultTo` means the writeback path never fires at all.

## Harness defects found only by executing (nine so far)

Four rounds of adversarial review plus `bash -n` missed every one of these;
they are the argument for running the gauntlet rather than reviewing it longer.

1. bash 5.3 no longer exposes a name assigned in the same `local` statement to
   later words in it — fatal under `set -u`.
2. An interactive `mv` overwrite prompt hung the run under a pty (fixed with
   stdin `</dev/null`).
3. `unrecord_root_path` rewrote the privileged manifest through a
   default-umask temp, destroying its required `0600` mode.
4. State inventories were over-scoped (application log + raw SQLite
   `-wal`/`-shm` sidecars) — now compared via a logical SQLite dump.
5. a2 leaves the gateway RUNNING, so its background writes were misattributed
   to the tested command until assertion 3 learned to quiesce and restore.
6. `last_promoted_good_json` is legitimately NULL until promotion and crashed
   the fingerprint parser.
7. `stat %F` reports an empty file as `regular empty file`, which failed the
   manifest's own metadata check.
8. `npm view --json` returns dotted literal keys (`.["dist.shasum"]`).
9. Phantom CLI surfaces: this OpenClaw has no `--verbose` (use
   `--log-level debug`) and **no `channels restart` subcommand** — and the
   preflight's capability proof passed vacuously because `--help` on a
   nonexistent subcommand prints the parent help and exits 0. Every CLI form
   is now verified against real `--help` output and recorded in the harness
   README's "Verified CLI forms" table.

## Incident to disclose in the final NOTES

During the first spike-3 a1 run, the cold-owner client subshell was the one
invocation lacking `env -i` isolation. It fell back to the operator's real
`~/.openclaw/openclaw.json` and touched the real state database's WAL/SHM
sidecars (2026-07-25 12:42). Assessed: no live instance was running, the
database passes `PRAGMA integrity_check`, its schema and main file were
unchanged; only the sidecars were touched by an open/close. Fixed by routing
every invocation through `spike3_run_openclaw`, which hard-fails if a resolved
config path escapes the spike's own roots. This is a contract violation and
must appear in the spike-3 NOTES, not be quietly dropped.

## Session hygiene note

A live 1Password service-account token was pasted into chat during this
session and was therefore written to the session transcript. It was never
installed or used; the operator was asked to delete that service account in
the 1Password UI (the CLI has no delete subcommand). Confirm that deletion
happened.

## Withheld evidence file (gitleaks false positive)

`a5-interim/logs/a5-writer-surface.log` (the combined a5 run log) is NOT
committed. Gitleaks' `generic-api-key` rule fires on its
`root_before=<64-hex>` inventory hashes. Verified false positive: the flagged
value recomputes exactly as `sha256sum` of the archived
`a5-interim/inventories/a5-token-swap-root-before.inventory`, and
`root_before` equals `root_after` (which is the proof of non-mutation, not a
credential). The file was moved to
`~/.cache/beep-p0-stage/a5-writer-surface-combined.log` rather than edited —
archived evidence must never be altered to satisfy a scanner. The per-case
logs, `writer-results.tsv`, `compatibility-matrix.md`, and the inventories
carry the same evidence. Proper fix for a later session: add a narrow
gitleaks allowlist scoped to `goals/**/history/p0/**` for
`root_(before|after)=[a-f0-9]{64}`, then restore the file.

## Session 2 addendum (same day, after account switch)

Progress:

- **Spike 1 assertion 5** now classifies four writer surfaces as
  `declarative render` (login/bootstrap, reconnect via the real
  `channels.stop`/`channels.start` RPCs, token swap) plus a
  `NOT-TRIGGERABLE` migration, and generates the assertion 6 matrix. Every
  case leaves the config root byte-identical. `A5-PASS` fires because no
  essential writer is INCOMPATIBLE — but note the verdict is only as strong
  as the two cases still unresolved below.
- **`defaultTo`** needed two fixes, both from live evidence: the success
  predicate used `jq -eR` (per-line) against a pretty-printed multi-line JSON
  document so it never matched; and it then demanded a resolution log line
  that the taken path cannot emit — the response carries
  `handledBy: "plugin"` (the gateway handled the send) while the pinned string
  lives in the CLI-local resolution path, is `--verbose`-gated, and writes to
  the log file rather than stdout or the journal. Predicates are now based on
  delivered-message evidence, and every pinned string must document its source
  file, guard condition, and output sink.
- **Spike 3 cold owner** — investigated and resolved with a real answer:
  `logs --follow` re-polls `logs.tail` per fetch (`dist/logs-cli-*.js`), and
  `gateway call --expect-final` / `agent` are finite calls, so none can prove
  a persistent authenticated connection. **`openclaw acp`** ("Run an ACP
  bridge backed by the Gateway") is the surface that does, and the harness now
  uses it. The old first-frame predicate was never proof: a normal gateway
  `logs.tail` response can carry `sourceKind:"file"` without `localFallback`.
- **Mutual exclusion** between spikes 1 and 3 is now recorded in the gauntlet
  contract (shared `/etc/beep/openclaw-spike` root and unit name).
- Harness improvement: the pairing window is now `SPIKE_PAIRING_WINDOW`
  (default 600s) so a validation run can iterate quickly without weakening
  the authoritative run.

Blocked on operator presence (all three are momentary, not long tasks):

1. **1Password must be unlocked** when a run starts — `op read` failed mid-run
   with "authorization prompt dismissed", which aborts the a5 cycle.
2. **The pairing DM.** Four windows have now expired (180/300/600/20s).
   Sending early does NOT work: the gateway drains queued Telegram updates at
   boot, so a pre-sent DM lands in the "before" snapshot and cannot prove an
   external trigger. It must arrive while the case polls. Best flow: operator
   says ready, run starts, operator sends the DM immediately.
3. **A fresh spike-3 service-account token**, piped straight into
   `/etc/beep/openclaw-spike/op-service-account-token` (cleanup consumes it
   every cycle by design).

Nothing else blocks P0. Once those three land, spike 1 and spike 3 close, the
final NOTES get written, and P0 goes to a mergeable PR via `/yeet`.

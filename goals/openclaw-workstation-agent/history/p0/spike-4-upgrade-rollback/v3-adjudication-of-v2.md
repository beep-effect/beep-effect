# Spike 4 archived-evidence adjudication

## Verdict summary

**Overall: NOT PASS / gate not cleared from the archive as it stands.**

| Contract assertion | Verdict |
| --- | --- |
| 1. Staged B upgrade, forced failed acceptance, snapshot restore, clean A restart | **PROVEN** |
| 2. A refuses the migrated state without snapshot restore | **PROVEN** |
| 3. Reversible/irreversible classification, including the irreversible-class operator gate and forward-recovery plan | **PARTIAL** |

The complete post-fix run did happen: `logs/v2-sequence.log:1-33` reaches
`SPIKE4-V2-PASS`. It is not the abandoned validation attempt represented by
`logs/run1-schema-drift-validate-B.log:1-4`.

That complete sequence proves the two state-machine behaviors. It does not
complete assertion 3's documentation obligation. Common-rule evidence is also
incomplete: no package SHAs, no exact Node patch version, and no content hash
for the spike root were archived. Cleanup is not proven complete because
`logs/cleanup.log:1-5` ends with `spike gateways still running: 3`.

Paths cited below are relative to
`goals/openclaw-workstation-agent/history/p0/spike-4-upgrade-rollback/`.

## Per-assertion adjudication

### Assertion 1 — PROVEN

The post-fix archive shows the required behavior end-to-end:

- `logs/v2-setup.log:1-20` records teardown-first setup, both rendered
  generation configs, both pre-upgrade databases at `user_version=1`, legacy
  sessions, and `SPIKE4-V2-SETUP-OK`.
- `logs/v2-sequence.log:1-10` records healthy A, both baseline stamps, candidate
  B validation, two WAL sidecars, and a snapshot containing both the shared and
  per-agent databases.
- `logs/v2-sequence.log:11-18` records the pointer switch, healthy B on 19012,
  shared `1 -> 5`, per-agent `1 -> 14`, consumption of the legacy sessions
  file, and the forced failed acceptance probe on expected port 19011.
- `logs/v2-sequence.log:22-26` records snapshot restore, the switch back to A,
  healthy A, both stamps restored to 1, and the legacy sessions file restored.
- `logs/v2-sequence.log:33` closes the run with `SPIKE4-V2-PASS`.

The 0-byte `logs/v2-sessions-after-migrate.txt` is an expected observed state,
not evidence of truncation. `harness/v2-sequence.sh:51-52` first reports whether
`sessions.json` was consumed and then lists the sessions directory into that
file. The run reports consumption at `logs/v2-sequence.log:16`; the gateway
journal independently records import and archival of the legacy session data
at `logs/v2-refusal-journal.log:26-30`. The sequence then continues through
rollback and its final PASS marker.

The older `logs/sequence.log:1-30` also demonstrates the shared-database
sequence, but it is not needed to fill gaps in the stronger v2 evidence.

### Assertion 2 — PROVEN

`logs/v2-sequence.log:19-21` shows the no-restore downgrade leg and the exact
refusal:

```text
[spike4] === step 8 (assertion 2): downgrade WITHOUT restore refused ===
[spike4] pointer -> gen-A
ASSERT-PASS: downgrade refused: uses newer schema version 5; this OpenClaw build supports 1
```

The raw journal corroborates the causal failure:
`logs/v2-refusal-journal.log:51-60` shows A starting, rejecting the shared
database because it uses schema version 5 while A supports 1, exiting status 1,
and leaving the unit failed. This is the contract's trap: without restore, A
does not start against B-migrated state.

### Assertion 3 — PARTIAL

What is demonstrated:

- A rollback-benign/additive class exists:
  `logs/v2-sequence.log:27-29` shows the 2026.6.33 state touched by 2026.7.1-2
  remains at `user_version=1`, then 2026.6.33 starts without restore.
- A stamped, old-binary-incompatible class exists:
  `logs/v2-sequence.log:14-15` records shared `1 -> 5` and per-agent `1 -> 14`;
  `logs/v2-sequence.log:19-21` and
  `logs/v2-refusal-journal.log:51-60` prove A cannot use that in-place migrated
  state.
- The encountered shared migrations are identified in raw output:
  `logs/v2-refusal-journal.log:9-19` names the versioned message-lifecycle
  ledger migration and SQLite STRICT-table migration. Legacy session import is
  shown at `logs/v2-refusal-journal.log:26-30`.
- A separate config-version guard is demonstrated at
  `logs/v2-future-guard.log:1-6`, including its intentional recovery override
  warning.

What is missing:

- No archived file classifies every encountered migration as
  reversible/irreversible in the contract's terms.
- No archived file documents the operator gate for the stamped/in-place
  incompatible class.
- No archived file documents the required forward-recovery plan. The harness
  restores the snapshot after the refusal; it never demonstrates or records
  reselecting B (or a newer compatible binary) against the still-migrated
  state.

The evidence supports describing 2026.6.33 → 2026.7.1-2 as
**rollback-benign**, and 2026.7.1-2 → 2026.7.2-beta.4 as **not in-place
downgrade-compatible / snapshot-required**. Calling the latter contractually
complete as an “irreversible class” would over-credit the archive because its
operator gate and forward-recovery plan are absent.

## Pinned inputs

| Input | Archived value | Evidence / qualification |
| --- | --- | --- |
| Generation A | `openclaw@2026.7.1-2` | Declared by `harness/setup.sh:5,38`; also emitted as the running binary in `logs/v2-future-guard.log:1,4`. No per-run `openclaw --version` capture. |
| Generation B | `openclaw@2026.7.2-beta.4` | Declared by `harness/setup.sh:6,39`; behavior is bound to the staged B path by `harness/v2-sequence.sh:31-34,44-50`. No per-run `openclaw --version` capture. |
| Additive control | `openclaw@2026.6.33` | Declared invocation at `harness/v2-sequence.sh:81-92`; successful rollback output at `logs/v2-sequence.log:27-29`. |
| Node | major `24`, mise path `$HOME/.local/share/mise/installs/node/24/bin` | `harness/v2-sequence.sh:11`; the supplied dead-session context also says Node v24 (mise). Exact `node --version` output is **not archived**. |
| Main ports | A/expected `19011`; B `19012` | `logs/v2-setup.log:13-14`; live/probe behavior at `logs/v2-sequence.log:2,13,17-18`. |
| Control ports | additive `19013`; future guard `19014` | Invocation definitions at `harness/v2-sequence.sh:83-97`. |
| Config SHA-256 prefixes | A `a67c3fd70ab4be5b`; B `644a12fd8197e09f` | `logs/v2-setup.log:13-14`. The archived configs hash to those same prefixes. |
| Shared DB stamps | pre `1`; B-migrated `5`; restored `1` | `logs/v2-sequence.log:3,14,25`. |
| Per-agent DB stamps | pre `1`; B-migrated `14`; restored `1` | `logs/v2-sequence.log:4,15,25`. |
| Additive-control DB stamp | `1` after 2026.7.1-2 | `logs/v2-sequence.log:28`. |
| Session/scratch identifier in paths | `3d98f4e1-d597-4777-a0ea-425d551c87be` | For example, `logs/v2-setup.log:9,17-18`. This is a scratch-session identifier, **not demonstrated to be the contract's spike-root content hash**. |
| Package SHAs | **NOT RECORDED** | Versions and config hashes are not package SHAs. |
| Local model | `ollama/gemma3:4b` | Archived configs `configs/gen-A.openclaw.json:10-16` and `configs/gen-B.openclaw.json:10-15`. |

## Deviations & isolation

### User-owned root

The run formally deviated from the common-rule `/etc/beep/.../<content-hash>`
root and from the listed Spike 4 sudo prerequisite. The archived harness
explicitly chose user ownership (`harness/setup.sh:8-9`), and all observed
state lived under a disposable scratch root.

This does **not** threaten the gated conclusion about the
*OpenClawGeneration state machine*. The proved causal chain is versioned binary
selection → SQLite stamp migration → old-binary refusal → byte-for-byte
snapshot restoration → clean old-binary start. Root ownership does not alter
SQLite `user_version` compatibility or the restored bytes. Root-enforced
generation immutability and privileged pointer control are Spike 1's subject.
The deviation should be waived explicitly for this gated decision, not silently
reported as contract-conforming.

### Isolation boundary

The main leg respected the intended live-state boundary:

- `harness/v2-setup.sh:31` and `harness/v2-sequence.sh:31-33` isolate `HOME`,
  `OPENCLAW_CONFIG_PATH`, and `OPENCLAW_STATE_DIR`.
- Logged main-leg config, state, databases, and application log paths all sit
  beneath the disposable scratch tree; examples are
  `logs/v2-setup.log:9-10,17-18` and
  `logs/v2-refusal-journal.log:52-54`.
- The unit is dedicated (`openclaw-spike.service`), and the gateway binds
  non-default loopback ports.
- There is no archived indication that real `~/.openclaw` state was read or
  mutated.

Strict common-rule isolation is nevertheless **not fully proven**:

- The additive control configs omitted an explicit logging path. Both
  `logs/v2-ctrl-712.log:9` and `logs/v2-ctrl-633-back.log:9` report the
  application log at `/tmp/openclaw/openclaw-2026-07-25.log`, outside the
  dedicated spike tree.
- `logs/cleanup.log:1-4` proves unit-file removal and daemon reload, but line 5
  reports three spike gateways still running. The log does not identify those
  processes or show a later zero count. The later machine reboot may have
  terminated them, but that is not archived cleanup evidence.

These isolation/cleanup defects do not reverse assertions 1 or 2, but they
prevent an unqualified common-rules PASS.

## Re-run plan

Assertions 1 and 2 do not need another behavioral run merely to establish
their behavior. A clean rerun is still the shortest way to bind the missing
pinned inputs to one execution, remove the strict isolation ambiguity, prove
cleanup, and produce a complete assertion-3 record.

Run only these legs, in this order:

1. teardown/preflight;
2. `setup.sh`;
3. `v2-setup.sh`;
4. one **isolated classification sequence** based on `v2-sequence.sh`;
5. teardown/postflight.

Do not rerun the obsolete `run-sequence.sh` leg or the standalone
`precheck-downgrade-refusal` probe.

### 1. Recreate the three staged installs

```bash
STAGE_CACHE="$HOME/.cache/beep-p0-stage"
mkdir -p \
  "$STAGE_CACHE/openclaw-2026.6.33" \
  "$STAGE_CACHE/openclaw-2026.7.1-2" \
  "$STAGE_CACHE/openclaw-2026.7.2-beta.4"

npm install --prefix "$STAGE_CACHE/openclaw-2026.6.33" \
  --no-save --package-lock=false openclaw@2026.6.33
npm install --prefix "$STAGE_CACHE/openclaw-2026.7.1-2" \
  --no-save --package-lock=false openclaw@2026.7.1-2
npm install --prefix "$STAGE_CACHE/openclaw-2026.7.2-beta.4" \
  --no-save --package-lock=false openclaw@2026.7.2-beta.4
```

Capture, without credentials, `node --version`, each staged binary's
`openclaw --version`, and `npm view openclaw@<version> dist.shasum
dist.integrity`. Also hash each staged package's `node_modules/openclaw/package.json`
and the two rendered configs. This closes the exact-Node and package-SHA gaps.

### 2. Create the disposable root and link staging at the path the harness expects

```bash
export SPIKE_P="$(mktemp -d /tmp/beep-p0-spike4.XXXXXX)"
ln -s "$HOME/.cache/beep-p0-stage" "$SPIKE_P/stage"
mkdir -p "$SPIKE_P/spike4/logs"
```

The symlink is required because `harness/setup.sh:28` and
`harness/v2-sequence.sh:87,90,97` resolve packages through
`$SPIKE_P/stage/openclaw-<version>/node_modules/.bin/openclaw`.

### 3. Teardown first, then run setup

```bash
systemctl --user stop openclaw-spike.service 2>/dev/null || true
systemctl --user disable openclaw-spike.service 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/openclaw-spike.service"
systemctl --user daemon-reload
systemctl --user reset-failed openclaw-spike.service 2>/dev/null || true

SPIKE4_ARCHIVE="goals/openclaw-workstation-agent/history/p0/spike-4-upgrade-rollback"
SPIKE_P="$SPIKE_P" bash "$SPIKE4_ARCHIVE/harness/setup.sh" \
  2>&1 | tee "$SPIKE_P/spike4/logs/setup.log"
SPIKE_P="$SPIKE_P" bash "$SPIKE4_ARCHIVE/harness/v2-setup.sh" \
  2>&1 | tee "$SPIKE_P/spike4/logs/v2-setup.log"
```

Before proceeding, archive the exact version/hash metadata and compute the
spike-root/config content hash using a documented deterministic recipe.

### 4. Run the isolated classification sequence

Use a disposable copy of `v2-sequence.sh` with exactly these two narrow
adaptations:

1. Add `"logging":{"file":"$SPIKE_P/spike4/ctrl-openclaw.log"}` to
   `ctrl-config.json`, so the control leg does not write `/tmp/openclaw`.
2. After the expected A refusal and **before** snapshot restore, switch back to
   B and prove B starts healthy against the still-migrated shared=5/agent=14
   state; stop B, then continue with snapshot restore and the existing A
   health/stamp/session assertions.

Run it as:

```bash
SPIKE_P="$SPIKE_P" bash "$SPIKE_P/v2-classification-sequence.sh" \
  2>&1 | tee "$SPIKE_P/spike4/logs/v2-classification-sequence.log"
```

The resulting NOTES must explicitly classify:

- `2026.6.33 -> 2026.7.1-2`: rollback-benign/reversible for the exercised
  databases because the stamp remains 1 and 6.33 starts without restore.
- `2026.7.1-2 -> 2026.7.2-beta.4`: in-place downgrade-incompatible and therefore
  snapshot-required for rollback, with shared `1 -> 5` and agent `1 -> 14`.
- Operator gate: do not activate B unless a stopped-state snapshot of every DB
  and WAL sidecar exists and is verified restorable; do not permit A to start
  on the migrated state.
- Forward recovery: if snapshot restore is unavailable or rejected, keep A
  stopped, select B or a newer schema-compatible generation, start it against
  the migrated state, run acceptance, and preserve the failed state/snapshot
  for operator diagnosis. The new intermediate B-health probe should evidence
  the compatibility premise.

### 5. Teardown and prove zero residual state

```bash
systemctl --user stop openclaw-spike.service 2>/dev/null || true
systemctl --user disable openclaw-spike.service 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/openclaw-spike.service"
systemctl --user daemon-reload
systemctl --user reset-failed openclaw-spike.service 2>/dev/null || true

systemctl --user list-unit-files 'openclaw-spike*' --no-legend
systemctl --user is-active openclaw-spike.service
pgrep -af "$SPIKE_P|openclaw.*1901[1-4]" || true
```

The archived postflight must state and show: no unit file, unit inactive/not
found, zero matching processes, no live `~/.openclaw` mutation, and removal of
the disposable `SPIKE_P` after its evidence has been copied out. Do not record
tokens, API-key values, or the generated gateway-token file.

## Draft NOTES.md

Not warranted. The contract says a spike passes only when every assertion is
demonstrated with archived evidence. Assertion 3 and the common pinned-input /
cleanup evidence are incomplete, so a PASS-style Spike 2 analogue would
overstate the archive. After the minimal rerun and documentation above, the
orchestrator can draft NOTES in the Spike 2 format.

---

*Provenance: adversarial adjudication of the interrupted v2 run's archive,
produced 2026-07-25 by a GPT-5.6-Sol (medium) background task and reviewed by
the orchestrating session. Its re-run plan drove the v3 evidence set in this
directory; `NOTES.md` records the final verdict.*

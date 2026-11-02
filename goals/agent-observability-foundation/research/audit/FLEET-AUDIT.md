# Local collector and fleet coverage audit

Captured 2026-10-28 UTC (2026-10-27 America/Chicago). Read-only local audit; report and sanitized evidence are the only writes. No transcript/prompt bodies, secret files, raw environment values, databases, remote hosts, or remote Phoenix endpoints were opened. Source-file byte comparisons and transcript filename/stat inventories were used.

## Finding

**The workstation's scheduled AI-metrics collection is disabled.** Both `beep-ai-metrics-forwarder.service` and `.timer` are symlinks to `/dev/null`. Live user-systemd reports `LoadState=masked`, `UnitFileState=masked`, `ActiveState=inactive`, `SubState=dead`; the timer has no next trigger. `Result=success` is an empty historical service state and does not establish successful collection.

Both units also have a recovery-hold drop-in. Its negative `ConditionPathExists` points to an existing `HOLD` marker under `~/workstation-diagnostics/2026-09-15/metrics-forwarder-quarantine/`. The quarantine receipt says: “Post-boot swap/VMA corruption in metrics-forwarder Bun thread; H3 absent and RAM pressure low. Isolates observed trigger, does not assert root cause.” This is recorded historical rationale, not a diagnosis independently reproduced here. Removing a mask alone would leave the hold condition; neither control was changed.

The central latest-status file was last modified **2026-09-15 01:37 UTC**. Its derived DuckDB file was last modified **2026-09-15 05:00 UTC**, size 3,498,323,968 bytes. The identity registry was generated September 15. These local records are stale by roughly six weeks. They cannot substantiate the current seven-day Phoenix display or identify which live producer supplied its 6,674 traces / 285 sessions. A second producer, direct exporter, or server-side source remains possible; this local audit does not establish its presence or absence.

## Fleet inventory and registration

There are **24 existing primary clones** in the requested naming scope: main, `beep-effect0`, `beep-effect2` through `beep-effect22`, and private. `beep-effect1` is absent. Their Git registrations enumerate **225 distinct existing roots: 24 primary clones and 201 linked worktrees**. Counts include historical worktrees and do not imply all are currently active.

The one discovered central metrics identity registry contains only **3 roots: 2 primary clones and 1 linked worktree**, plus 9 source instances. It is not a current fleet inventory. Identifiers were not published or reverse-mapped. Root cardinality alone cannot say which roots contributed transcript rows, but it cannot provide a coverage certificate for the observed fleet either. No `.beep/ai-metrics` directory exists under any of these 225 registered roots.

| Primary clone | Git roots, including primary | Claude JSONL files | Modified in last 7 days | Over 32 MiB |
| --- | ---: | ---: | ---: | ---: |
| `beep-effect` | 28 | 653 | 206 | 1 |
| `beep-effect0` | 35 | 0 | 0 | 0 |
| `beep-effect2` | 53 | 590 | 46 | 1 |
| `beep-effect3` | 12 | 919 | 52 | 2 |
| `beep-effect4` | 5 | 229 | 227 | 1 |
| `beep-effect5` | 7 | 643 | 143 | 2 |
| `beep-effect6` | 4 | 140 | 22 | 0 |
| `beep-effect7` | 6 | 186 | 101 | 0 |
| `beep-effect8` | 6 | 278 | 75 | 0 |
| `beep-effect9` | 20 | 165 | 54 | 1 |
| `beep-effect10` | 5 | 548 | 367 | 1 |
| `beep-effect11` | 8 | 90 | 13 | 2 |
| `beep-effect12` | 2 | 42 | 29 | 0 |
| `beep-effect13` | 6 | 42 | 36 | 0 |
| `beep-effect14` | 2 | 0 | 0 | 0 |
| `beep-effect15` | 2 | 0 | 0 | 0 |
| `beep-effect16` | 4 | 14 | 1 | 0 |
| `beep-effect17` | 2 | 16 | 0 | 0 |
| `beep-effect18` | 2 | 4 | 0 | 0 |
| `beep-effect19` | 4 | 653 | 0 | 0 |
| `beep-effect20` | 4 | 1 | 0 | 0 |
| `beep-effect21` | 2 | 85 | 3 | 1 |
| `beep-effect22` | 1 | 15 | 0 | 0 |
| `beep-effect-private` | 5 | 38 | 3 | 0 |

These Claude counts use the exact encoded project directory implied by the current source resolver. Across the 24 primary clones there are **5,351 JSONL files**, **1,378 modified in the last seven days**. Main accounts for **653 files / 206 recently modified**, leaving **4,698 files / 1,172 recently modified outside main's default Claude directory**. Across the whole home Claude projects directory there are 6,546 files / 1,951 recently modified. This broader set includes other projects and must not be labeled beep-effect activity.

No exact encoded project directory was found for the 201 linked worktree paths. This does not establish zero worktree activity: Claude may associate it with another project directory, and transcript metadata was intentionally not inspected. The full home project inventory and primary-clone inventories should not be added; they overlap.

## Installed binding versus canonical source

There is **no active working directory or command**, because the service is masked. Preserved original and September 12 backup units bind to main at `~/YeeBois/projects/beep-effect`, invoke Bun and `packages/tooling/tool/cli/src/bin.ts -- ai-metrics forwarder run`, and target dankserver with OTLP enabled. The original uses the absolute central XDG data root `~/.local/state/beep/ai-metrics`; the older `.pre-p0` backup instead uses `.beep/ai-metrics` and is unsafe to restore verbatim against current absolute-path requirements.

The saved timer interval is 360 minutes after inactivity, initial delay 5 minutes. Saved collection limits are 50 files per source and 32 MiB per file; parquet export is disabled. Secret-reference arguments and private endpoint identifiers are omitted from the evidence. Their existence does not prove authentication or endpoint health.

Byte comparisons of three collector-related source files found all 23 public primary clones equal to main for `forwarder.ts`, `internal/transcript-utils.ts`, and CLI `AIMetrics/internal/Programs.ts`. Private differs in `forwarder.ts` and `Programs.ts`; its root resolver matches. This is a narrow source comparison, not proof of identical runtime, dependencies, hooks, full configuration, or revision. Linked-worktree source drift was not scanned.

Canonical timer rendering now writes a fixed sanitized failure diagnostic and discards stderr (`forwarder.ts:1098–1105`); preserved historical units embed a bounded stderr fragment in failed status JSON. Current rendering also sets restart-on-failure and a 5-minute restart delay (`forwarder.ts:1123–1124`). Restoring an old unit would miss these current behavior changes.

## Concrete coverage gaps and failure modes

1. **Local scheduled export is absent.** The mask and recovery hold are independent controls. Current data freshness cannot be inferred from an inactive successful service result or a stale latest-status file.
2. **Claude coverage is bound to one root by default.** `internal/transcript-utils.ts:61–64` selects `~/.claude/projects/<encoded repoRoot>` for Claude and `~/.codex/sessions` for Codex. CLI `Programs.ts:238–240` defaults `repoRoot` to the working directory. The preserved main-bound command supplies no root enumeration. Restoring it as written would not discover the other primary-clone Claude directories.
3. **Codex discovery has a different scope.** Its home-wide active sessions directory contains 313 JSONL files, 312 recently modified, including 8 over 32 MiB. The separate archived-sessions directory contains 18 files, all recently modified, including one over 32 MiB, and is outside the default root. These are file counts, not unique sessions or repo-filtered events. Archive relocation and file copy can alter mtimes; no semantic seven-day count was calculated.
4. **Repeated newest-file selection can starve backlog.** `forwarder.ts:1300–1303` sorts by newest mtime and takes `maxFiles`; no rotating selection cursor is visible in that selection. The stale status already recorded Codex 317 eligible candidates, 50 included, 267 omitted by the cap, plus 14 oversized files. Claude was 15/15; OpenClaw 0/0. These are September observations, not current totals. A restarted timer with the same cap cannot establish complete historical catch-up merely by running repeatedly.
5. **Registry insertion is per run root.** `forwarder.ts:1490–1500` upserts `input.repoRoot` and declares the three scanned source kinds. It does not enumerate the Git fleet there. A source-instance registry entry is therefore not proof that matching source data was found; the historical OpenClaw zero-file coverage demonstrates why the distinction matters.
6. **Remote-host completeness is unknown.** Only the local saved target configuration was inspected. No dankserver, beep-worker, other workstation, cloud-agent host, or vendor-host collection was tested. A host coverage claim needs separate live producer inventory and transport acknowledgments for each host.
7. **Additional agent surfaces are unproven.** This forwarder discovers Codex, Claude, and an OpenClaw service-unit path. The fleet includes multiple agent routes, but this audit found no evidence that Cursor, Junie, Grok, browser/cloud tasks, or app-specific alternative homes reach this scheduled path. Direct instrumentation may exist elsewhere and needs separate verification.

## Implications for the exploration

Treat the seven-day dashboard as **a measured subset with unknown fleet coverage** until producer identity, live collection status, backlog age, and source-specific exclusions are reconciled end to end. Trace count, session count, source-file count, registered-root count, and Git worktree count are different populations and must retain separate denominators.

The next proof should bind every expected host and root to a declared collector/source route; identify intentional exclusions; record fresh discovery and export receipts; and show the last accepted server acknowledgment. Resuming the quarantined collector is an implementation/operational action requiring investigation of the existing recovery hold, not part of this research audit. No unmask, timer enablement, backfill, secret read, or remote operation was attempted.

## Evidence and limits

- `fleet-inventory.json`: timestamped aggregate/stat-only inventory, per-primary-clone Git-root counts, narrow source drift, central registry cardinality, and home source counts. No worktree/session identifiers or transcript filenames retained.
- `fleet-collector-status.json`: allowlisted live systemd properties, quarantine rationale, stale status counts, database stat, and sanitized preserved command parameters.
- Source references are current local working-tree files under `packages/tooling/library/ai-metrics/src/` and `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts`; lines can drift after edits.
- Graft was queried before opening source. The reported query saved approximately 96,450 context tokens; its estimated cost equivalence is informational, not billing evidence.

## Requested agent surfaces: installed versus configured versus observed

This extension inspects only allowlisted telemetry flags, config section/key presence, launcher paths, and shell-route names. Credentials and endpoint values were not emitted. File/config presence is not successful runtime export. The Phoenix observations below were supplied by the parent research lane; this audit made no remote calls and did not independently re-query them.

| Surface | Installed/local configuration evidence | Collection conclusion |
| --- | --- | --- |
| Claude Code | `claude` resolves locally. User settings enable telemetry (`CLAUDE_CODE_ENABLE_TELEMETRY=1`), traces and metrics exporters are `otlp`, logs exporter is `none`. Prompt, raw API body, tool-content, and tool-detail switches inspected are `0`. | Native export is configured separately from the masked transcript forwarder. Parent lane observed 359,131 Claude-named spans in its current native-Phoenix seven-day query, with no recognized token usage or cost. This supports some Claude activity, not complete clone/host coverage or complete measurement fields. |
| Codex CLI | `codex` resolves locally. `~/.codex/config.toml` contains `[otel]`; **`exporter="none"`**, while `metrics_exporter` is configured using `otlp-http`; `log_user_prompt=false`. Independent review found a distinct installed `trace_exporter` field, absent from the inspected TOML. Version-matched Codex 0.165.0 source defaults that field to `None`; this shared CLI config therefore leaves native tracing disabled absent runtime overrides. | The event exporter is explicitly off. Separately, the absent `trace_exporter` leaves native tracing at its version-matched default `None` for CLI runs using this config without overrides; metrics export remains separately configured. Desktop overrides and effective running-process configuration are unverified. Parent lane observed zero `handle_responses` and zero `ai_metrics` spans. Active session JSONL existence does not prove Phoenix ingestion. |
| ChatGPT Desktop / Codex desktop app | `/usr/bin/chatgpt` resolves to `/usr/lib/chatgpt/codex-launcher`; Codex desktop configuration directories exist. The launcher text contains no OTEL variable or OTLP marker. | Installed app presence is proven. It may use the same Codex home and app-server routes; neither the launcher nor shared CLI config proves desktop-specific environment inheritance or end-to-end export. Distinct app/runtime attribution is missing from this local proof. |
| Claude Desktop | Desktop launcher entry, `~/.config/Claude/config.json`, and `claude_desktop_config.json` exist. Those inspected text files contain no OTEL variable names or OTLP marker. | Desktop is locally configured as an app, but no desktop metrics collector route was proven. Claude Code telemetry settings cannot be assumed to instrument native desktop conversations or Cowork. |
| Grok | `grok` resolves locally; its config exists. No top-level telemetry/OTEL section or matching telemetry env key was found in the inspected config. Its session directory exists; content was not opened. | Installation is proven; export to this Phoenix pipeline is unproven. The transcript forwarder does not declare a Grok source kind. Absence of a matching config section does not prove vendor telemetry is absent. |
| Muse | `claudem` is not a standalone PATH executable, but `.zshrc` contains the `claudem` shell route, `muse-wonder-1.0` pin, and `_claude_proxy` helper call. The helper invokes Claude and assigns OTEL resource attributes. | A Claude proxy shell route is configured. It may flow through Claude instrumentation, but model/provider attribution and delivery must be verified independently; Claude-named spans cannot establish Muse coverage. Interactive shell functions are also unavailable to a bare noninteractive PATH lookup. |
| cursor-agent | Local executable and CLI config exist. No matching telemetry env keys or top-level telemetry section were found; the inspected launcher text contains no OTEL or OTLP marker. | Installation is proven; export to this metrics pipeline is unproven. The forwarder declares no Cursor source kind. |

The local Claude native exporter offers a concrete explanation for recent Claude spans despite the masked transcript service. It remains an inference until the server's producer/resource attributes are tied to this host. Version-matched source establishes that Codex's absent explicit `trace_exporter` leaves tracing at default `None` for CLI runs using this shared config without overrides. This is a concrete configuration gap; desktop overrides, effective running-process configuration, and the exact cause of the observed zero recognized spans remain unverified. The conclusion does not follow from `exporter=none`. Native Claude spans, native Codex metrics, and `ai_metrics` reconstructed spans are distinct streams and should be reported separately, with per-surface coverage and token/cost field completeness.

Additional sanitized evidence: `fleet-agent-surfaces.json`. This includes only telemetry variable/key names, allowlisted safe switches, launcher locations, and Muse route-presence booleans. No full application config, shell function, secret-reference inventory, or environment was retained.

### Version-matched Codex and remote settings clarification

The parent lane matched installed Codex 0.165.0 to [`rust-v0.165.0` OTEL config source](https://github.com/openai/codex/blob/rust-v0.165.0/codex-rs/core/src/config/otel.rs), whose line 20 defaults an absent `trace_exporter` to `None`; see `codex-versioned-config-evidence.json` for source URL, hash, and extracted lines. This resolves the shared CLI file's default, without proving desktop or launch-time overrides. Parent evidence in `dankserver-producer-settings.json` finds no OTEL keys in the readable remote admin config; worker files were unreadable. Unreadable worker configuration is **unknown**, not absent telemetry, and admin configuration does not represent every worker route.


## Final parent-audit worker follow-up

After the administrator-account read failed, the parent used the repo-owned dedicated worker SSH route for a read-only own-account projection. Worker Codex config exists with no OTEL keys; worker Claude user settings are absent. See `dankserver-producer-settings.json`. This resolves file-access uncertainty for those two paths, but effective process/environment/system overrides and end-to-end worker traffic remain unverified. No permissions or configuration changed.

# Independent audit review

Reviewed 2026-10-28 UTC. Scope: `SOURCE-AUDIT.md`, `FLEET-AUDIT.md`, `HARNESS-COVERAGE.md`, `DEPLOYMENT-AUDIT.md`, their principal implementation claims, sanitized existing evidence, installed Codex binary field names, and four existing synthetic tests. No live telemetry queries, remote operations, real transcripts, secret values, production-data writes, service changes, package installs, or rewrite implementation were performed. Report corrections described below are the only other authored changes.

## Verdict

The audit establishes material coverage and interpretation failures, and supports a first-principles design exploration. It does **not** yet establish the numerical cause of the UI's 6,674 traces / 285 sessions, comprehensive absence of any requested harness, or a justified production rewrite launch. The strongest verified defects are current-root attribution of global Codex discovery, bounded newest-file starvation, export-time/zero-duration span projection, and error-to-empty discovery behavior. The most decisive operational evidence is the independently masked and quarantined local transcript collector. Separate native Claude telemetry explains why that outage can coexist with recent spans.

One material overclaim was found and corrected: **`[otel].exporter="none"` does not establish that Codex native tracing is disabled.**

## Correction: Codex exporters are separate settings

The installed Codex executable contains the serialized `OtelConfigToml` field name **`trace_exporter`**, distinct from the inspected `exporter` and `metrics_exporter` settings. An allowlisted TOML projection finds no explicit `trace_exporter` and no profile-level OTEL section in the inspected shared file. The parent subsequently matched installed Codex 0.165.0 to versioned upstream source, resolving the default: `codex-rs/core/src/config/otel.rs:20` defaults absent `trace_exporter` to `None`. Evidence is retained in `codex-versioned-config-evidence.json`. Runtime overrides remain unverified. Binary strings alone were insufficient; the conclusion now rests on version-matched source.

Consequently the evidence supports: event exporter configured as `none`; metrics exporter has `otlp-http` configuration; native tracing left at default `None` for CLI runs using the inspected shared config without overrides; no recognized Codex span names in the parent lane's bounded query. This supports a concrete shared-CLI configuration gap, while desktop overrides and effective running-process settings remain unknown. It does not establish the sole cause of absent spans. Native metrics reaching Prometheus is independent evidence and does not settle traces.

Updated `FLEET-AUDIT.md`'s Codex row and concluding attribution, and added the version-matched default and runtime qualification in `fleet-agent-surfaces.json`. Any design sketch or synthesis repeating the prior “traces off” statement must receive the same correction. Version-matched source verification is now complete; effective runtime route evidence remains a next verification only if separately scoped. Do not print startup config or complete application configuration as a shortcut.

## Findings verified against source

| Finding | Verified source | Severity and qualification |
| --- | --- | --- |
| Global Codex discovery uses current-root ingest attribution | `internal/transcript-utils.ts:56–67`; `forwarder.ts:1485–1515,1644–1653`; `derived-storage.ts:1498–1508,1540–1560,1578–1597` | **High analytical correctness risk.** Codex source discovery is home-wide, while the write receives one current-root hash and config snapshot. Session upsert replaces task/config association. This is a concrete mismatch, not proof that every stored Codex event belongs to the wrong repo. CLI/desktop origin and true session cwd are not established from the current context alone. |
| Newest-N selection offers no eventual backlog progress | `forwarder.ts:1183–1194,1297–1343` | **High completeness risk.** Repeated identical eligible sets choose the same prefix; `includeAll` does not remove the cap. Source budgets are separate, so do not revive the stale shared-budget claim. Historical status demonstrates actual cap exclusions, but not how many never-ingested events or sessions are missing. |
| OTLP spans have export-time start/end and zero duration | `otlp.ts:821–854,890–898` | **High measurement-validity risk.** Code directly assigns the same current timestamp to start/end and `[0,0]` duration. Such spans cannot measure native request latency or original activity dates. Actual Phoenix filter behavior was not exercised here; its ordinary span-time view must be distinguished from a custom query using `ai_metrics.timestamp`. |
| Discovery errors become successful empty/skipped results | `internal/jsonl-discovery.ts:20–22,39–62`; `forwarder.ts:1221–1227` | **High reliability observability risk.** Stat errors are discarded through `Effect.option`; read-directory errors become empty lists. Missing and inaccessible can be indistinguishable to coverage. This does not mean selected-file read failures are ignored: they fail explicitly later. |
| Path occurrence is the session/event identity | `derived-storage.ts:1763–1767,1842–1847`; `otlp.ts:540–555` | **Medium semantic limitation unless unique-conversation counts are claimed.** Copying one transcript to another path changes identity. This can be intentional provenance; it becomes a counting defect when presented as a unique logical-session census. No current per-ingest-run duplication defect was established. |
| OpenClaw forwarder input is unit metadata | `forwarder.ts:1258–1287`; source enum in `models.ts:122–128` | **Coverage limitation.** A service-unit source is not gateway conversation/activity ingestion. Local/dankserver retirement status must remain separate from this adapter's capability; do not imply current OpenClaw use. |
| Harness vocabulary exceeds actual adapters | `models.ts:122–128`; `hook-pulse.ts:219`; `forwarder.ts:1577–1583` | **High coverage-claim risk.** Grok/Muse/Cursor/desktop vocabulary or launch support does not imply transcript ingestion. Cursor hook support exists, which prevents the blanket statement “Cursor is unsupported” across all signals. |
| Managed subprocess environment is constrained | `AiProviderCliSession.profile.service.ts:29–44` | **Route-specific risk.** These managed launches pass HOME/PATH and optional CODEX_HOME, not arbitrary parent telemetry variables. The conclusion is limited to this managed driver, not all native CLI or shell launches. |

Timestamp extrema are also lexicographically ordered (`ingest.ts:167–170,218–228`). Mixed timezone offsets can reverse chronological order; real occurrence was not inspected, so classify this as a source-level input-normalization defect with unmeasured incidence. Memory/backlog concerns remain source-supported risks, not measured crash causation.

## Fleet findings: strong facts, bounded denominators

The sanitized audit records 24 primary clones and 201 existing linked worktrees at its snapshot. They are **Git registrations, not 225 active producers, active sessions, or independent telemetry sources**. The central registry has 3 roots, but this does not prove only 3 roots' work was observed: home-wide Codex discovery can include more roots while incorrectly attributing them to a registered ingest context. Registry cardinality measures identity registration, not collection completeness.

Both local scheduled units are masked and a separate hold marker exists. Central collection state is dated September 15. Those facts establish that this scheduled path cannot be credited with current automatic collection. They do not establish zero local native telemetry or zero remote collection. The quarantine's historical corruption rationale is neither a demonstrated current failure nor permission to remove the hold.

Transcript filename/stat counts support discovery scope and cap-risk assessment. They are not unique-session counts or event-time counts. Last-seven-day mtimes can reflect copying, restoration, archival relocation, or an old session receiving a new event. The fleet report states these limits correctly. No exact Claude directory for linked-worktree paths does not establish no worktree activity; Claude's project mapping can differ.

Narrow equality of three collector source files in public clones does not establish hook, dependency, environment, configuration, launcher, or deployed-runtime parity. Private source differences are drift observations rather than defects on their own.

## Deployment claims independently checked

The local collector template's allowlist retains Claude-named spans, `ai_metrics.*`, and exact `handle_responses`; its traces pipeline includes the filter and project stamp. Metrics use another pipeline. This verifies intentional exclusion as a separate accounting category, not unexpected transport loss.

The Phoenix health probe generates `ansible-phoenix-health`, posts directly to loopback Phoenix, accepts HTTP 200, and supplies no explicit project/session (`roles/phoenix/tasks/main.yml:295–346`). It bypasses native collection and would fail the native name allowlist. It can contribute synthetic default-project data depending on backend routing; the report correctly avoids treating that routing as live proof. No query-visible trace assertion is present in the probe.

The retention check reads `edges[0]` while mutation targets a configured policy ID (`main.yml:376–408`). This verifies a policy-identity ambiguity; a wrong live policy or actual retention loss is unproven.

The Phoenix backup template leaves repository-success flags set when service restart fails, then writes those flags in cleanup (`dankserver-phoenix-backup.sh.j2:63–104`). This verifies an inconsistency between the documented “latest backup run succeeded” gauge and recovery failure. Snapshot success itself remains truthful; the defect is conflation with overall recovery and last-success semantics. No failed live restart was observed here.

Other deployment findings—explicit durable queue ownership absent, missing-series alerts, worker installer omissions, and unmanaged native-route declaration—are appropriately source-scoped in `DEPLOYMENT-AUDIT.md`. They should remain **unproven runtime guarantees**, not claims that SDK retries are disabled, alerts never arrive, workers emit nothing, or every backup loses events. The parent lane's successful 23/24-second backup examples bound only those observed runs. The parent-reported deployed transform absent from template is a reconciliation risk; this review made no new live comparison.

## Bounded synthetic verification performed

Executed the existing local fixture suite with its installed dependencies:

```text
bunx --no-install vitest run --config vitest.config.ts test/ingest.test.ts   -t 'discovers Codex, Claude, and OpenClaw|skips transcript files that become unreadable|skips oversized transcript files|keeps one transcript on one trace'
```

**Result: 4 passed, 81 skipped, one test file passed, 3.52 seconds.** Tests use temporary synthetic files/stores and do not require production telemetry or credentials. This confirms current baseline discovery, intentional unreadable/oversized skipping, and stable per-path trace identity across runs. It does **not** reproduce multi-root misattribution, repeated bounded-scan starvation, actual protobuf sender timestamps, cross-path duplication, or backend receipt. No packages were installed and no broad suite was run.

Source inspection proves the deterministic mechanics behind those outstanding reproductions, but executable regressions should still precede remediation. Highest-value additional fixtures are: two synthetic roots sharing global Codex inputs; N+1 files over two identical bounded scans; a capturing protobuf exporter under a fixed clock; injected subtree stat/read failures; one logical synthetic session copied across paths. Mock Phoenix restart failure and render the name filter in isolated deployment fixtures. Do not interrupt production services or issue live traces to validate these cases during this audit.

## Audit closure criteria

A comprehensive conclusion should keep four questions separate: adapter capability, installed enablement, fresh producer activity, and acknowledged/query-visible delivery. Publish the known inventory's provenance and unknown routes rather than asserting all-activity coverage. Preserve native versus reconstructed streams, CLI versus desktop, requested proxy route versus observed provider identity, excluded versus failed discovery, and event time versus observation/export time.

Version-specific Codex trace default interpretation is resolved. Before implementation, verify effective runtime overrides, record recognized field completeness alongside native producer counts, and turn the principal deterministic source findings into synthetic regression fixtures. The current evidence is sufficient to reject the dashboard totals as a complete fleet census and to scope corrective design; it is insufficient to prescribe a wholesale rewrite or claim a quantified missing-event percentage.

## Final evidence update from parent lane

Version-matched [Codex OTEL configuration source](https://github.com/openai/codex/blob/rust-v0.165.0/codex-rs/core/src/config/otel.rs) resolves the missing trace-exporter default to `None` (line 20); line 17 and line 21 distinguish adjacent exporter settings. This validates the **shared CLI default gap**, not the earlier incorrect inference from `exporter=none`. Parent `dankserver-producer-settings.json` records a readable remote admin config without OTEL keys and unreadable worker files. Preserve worker state as unknown and avoid promoting admin-account observations into fleet-wide absence claims.


## Final parent-audit worker follow-up

After the administrator-account read failed, the parent used the repo-owned dedicated worker SSH route for a read-only own-account projection. Worker Codex config exists with no OTEL keys; worker Claude user settings are absent. See `dankserver-producer-settings.json`. This resolves file-access uncertainty for those two paths, but effective process/environment/system overrides and end-to-end worker traffic remain unverified. No permissions or configuration changed.

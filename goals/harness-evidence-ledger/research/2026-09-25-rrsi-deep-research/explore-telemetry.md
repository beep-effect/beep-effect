# explore-telemetry findings (Opus Explore agent, 2026-09-25) — saved by parent

Summary: per-session hook event stream, config-hash snapshots, tombstone format and baseline ratchets exist. GAP: nothing records which files/skills/hooks entered an agent's context; today `touched` is only recoverable by parsing raw transcripts after the session.

## 1. Harness telemetry
- "harness-otel" = completed goal packet goals/harness-otel-adoption (Claude Code + Codex built-in OTel → dankserver collector → Phoenix/Prometheus). Attributes fixed: beep.repo/branch/task_class/goal_slug/schema_version + host.name (research/p0-attribute-contract.md:16-31). Span names claude_code.tool/.tool.execution/.llm_request/.interaction. OTEL_LOG_TOOL_DETAILS=0 → no file paths, no skill names.
- P1 hook-event stream IS BUILT AND LIVE: .claude/hooks/hook-pulse.sh wired to every hook event in .claude/settings.json; writes one HookPulseV1 row per event to $XDG_STATE_HOME/beep/agent-evidence/hook-events/hook-pulse-<day>-<sessionHash>.ndjson (hook-pulse.sh:362). 2,451 shards on disk. Schema: packages/tooling/library/ai-metrics/src/hook-pulse.ts:883. Fields: schemaVersion, ts, sessionId(hashed), agentKind, hookEvent, cwd(hashed), toolName, toolUseId, promptId, transcriptPath(hashed), permissionMode, waitReason… `tool_input` deliberately omitted → cannot tell which files were Read or which Skill was called.
- Sibling ledgers circuit-breaker/ and sequence-break/ in the same store.

## 2. Config fingerprints (none has all five of model/effort/toolset/harness hash/rev)
- ai-metrics/src/config-snapshot.ts:22-30,946-1015: configHash + baselineHash (skills, agents, hooks) + sessionHash (AGENTS.md, CLAUDE.md, .claude/settings*.json, .codex/config.toml), per-file sha256 over .claude/.codex/.ai/.aiassistant. models.ts:676 ConfigSnapshot adds optional gitCommit; AgentTask.configSnapshotId at models.ts:720. No model/effort/tools.
- flight-record.ts:309-344,553 FlightConfigAttribution (observed|last-known|unknown), bare sha256.
- DocgenQualityWorkerEvalReport (Docgen/internal/QualityWorkerEval.ts:416-437): model, reasoningEffort, codexSdkVersion; no rev.
- `beep models` (Models.manifest.schemas.ts:340) pins role/surface → model+effort in ~/.config/beep/models.yaml.
- Cache.fingerprint.ts:129-289 toolchain only.
- Closest composite: config-snapshot sessionHash + baselineHash + gitCommit + a model/effort binding. Tool set and harness version missing everywhere.

## 3. Research ledger
- Tombstones: 31 rows in research/ledger/tombstones/2026-08-30.jsonl, 2026-09-13.jsonl. Reasons: unactioned-3-runs (29), unactioned-3-runs-superseded (2).
- Row: {"schema":"beep.research.tombstone/v0","id":"t-2026-09-13-01","originPacket":"research/2026-09-03","originId":"f-law-01","title":…,"url":…,"reaped":"2026-09-13","reason":"unactioned-3-runs","resurrect":"needs evidence post-dating 2026-09-13"}
- Laws research/README.md:21-45: single writer, immutable packets, machine proposes / human admits. Dispositions ledger + demurrage reaper UNCHECKED in goals/nightly-research-routine/PLAN.md:48-53 (spec SPEC.md:105-112); no dispositions file, no reaper code; tombstones come from the routine's prompt.

## 4. Retention / pruning
- KnipRatchet.ts + standards/fallow.*.regression-baseline.jsonc only shrink.
- "advisory → blocking after 3 consecutive clean runs" is doctrine only (DECISIONS.md:1173); minimumCleanRuns: 3 in goals/fallow-quality-enforcement/research/feature-matrix.jsonc:83; no promotion code.
- Workstream C pruning = one-off docs PR (goals/knowledge-surface-automation/research/p1-context-pruning-analysis.md); no command. explorations/context-rent-telemetry parked waiting on that machinery.

## 5. Usage counters
- No live counter. "4 dead skills" (goals/harness-hygiene-mechanical/SPEC.md:39-41) came from a one-off transcript scan (explorations/agent-effectiveness-pulse/research/pulse/skill-usage.md): 194 direct Skill calls + Codex proxy (SKILL.md path refs). ToolInvocation model (models.ts:860) keeps only toolName.

## 6. Observability doctrine (standards/architecture/12-observability.md)
- Span names <slice>.<concept>.<action> snake_case (:17-28); attribute keys <slice>.<concept>.<field>, low-cardinality, no raw input/PII (:49-53); harness contract requires `beep.` prefix and no paths/session ids in metric labels (p0-attribute-contract.md:28).
- A touched-surfaces attribute must be e.g. beep.harness.context.touched with hashed/bucketed surface ids, traces only.

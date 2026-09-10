# Instance

- id: `ai-metrics-sanitized-transcript-thread-spawn`
- source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- corpus source: `663904610cce2a38c06b0619a8c414646b69361c`
- file:line: `packages/tooling/library/ai-metrics/src/privacy.ts:232`
- symbol: `AiMetricsSanitizedTranscript`
- members: `threadSpawn`, `sourceRole`
- classification: E1/E4; derived; persisted; tagged-union; Tier 2 singleton
- source receipt: `../data/design-refresh-2026-09-09-r27-observability-carriers.md`
- independent census: `../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-observability-contract-correction1.jsonl`
  and its completed `.execution.json`; this design still requires P3 review.

Source references below are relative to `packages/tooling/library/ai-metrics/`
unless another path is explicit. This carrier is distinct from the withdrawn
snake-case/camel-case seed: `CodexSubagentSource.thread_spawn` at
`src/privacy.ts:343` is input metadata in another declaration.

# Current shape

The public class at `src/privacy.ts:210` combines a role literal with an
optional-key Boolean and independently stores the full sanitized transcript.
`sourceRole` at `:228` has both constructor and missing-key decoding defaults
of primary. `threadSpawn` at `:232` has a constructor None default and encodes
None as an omitted key. `makeSanitizedTranscript` gets a single attribution
at `:805` and copies its pair at `:833`–`:834`.

The complete schema field order is `acceptedEvents`, `agentNicknameHash`,
`agentRoleHash`, `eventNames`, `firstTimestamp`, `forkedFromIdHash`,
`lastTimestamp`, `parentSessionIdHash`, `parentThreadIdHash`,
`rawEventEnvelopes`, `rejectedLines`, `sessionIdHash`, `sourceKind`,
`sourcePathHash`, `sourceRole`, `threadSpawn`, `totalLines`. Counts are
`S.Natural`; event names are an array of strings; timestamps are independently
optional strings; six optional hashes and required path hash use
`AiMetricsEncodedSha256`; raw envelopes retain their existing schema.
Every optional hash/timestamp uses optional-key encoding and None defaults.

It is nested in `AiMetricsPrivacyCheckResult.sanitized` at `:285`, encoded
through the privacy JSON codec at `:383`/`:935`, and carried in
`AiMetricsDerivedTranscriptRecord.privacy` at `src/derived-storage.ts:786`.
The storage writer projects it into both `ai_metrics_source_files` and
`ai_metrics_sessions`, with its raw envelopes supplying turns. Thus it is a
persisted application-owned carrier even though its construction is derived.

# Cardinality gap

The independent role/option product is **9 representable, 5 legal**.

| Role | Thread-spawn alternatives | Actual derivation |
| --- | --- | --- |
| primary | None | Codex lacking subagent metadata or Claude primary path. |
| subagent | None | Claude subagent path or Codex subagent metadata omitting the Boolean. |
| subagent | Some(false), Some(true) | Codex subagent Boolean forwarded without truthiness coercion. |
| gateway_metadata | None | OpenClaw attribution at `src/privacy.ts:650`. |

E1 is the paired copy at `src/privacy.ts:833`; E4 is the attribution
producer family. All five arrive via one attribution value. Both Some values
and all six optional hash payloads survive. No role implies the presence of a
parent/session hash. The primary default supports legacy payloads missing
`sourceRole` with absent thread-spawn. Nothing in this table constrains a
later joined OTLP row's historical role to the current session's role.

# Target schema

Use three annotated private full-transcript `S.Class` members, assembled from
the existing `AiMetricsSourceRole` kit with `mapMembers` and
`S.toTaggedUnion("sourceRole")`. Export the union and same-name type as
`AiMetricsSanitizedTranscript`. Keep a private common transcript payload
definition, preserving all fields and refinements above; preserve final member
field order explicitly instead of allowing payload extraction to reorder JSON.

This design depends on the merged attribution singleton. Reuse only the
corresponding attribution case's `sourceRole` and `threadSpawn` field schemas:
primary/gateway have absence-only `Option<never>` through
`S.OptionFromOptionalKey(S.Never).pipe(SchemaUtils.withNoneDefault)`;
subagent has the original optional-key Boolean/None-default schema. Keep the
stricter `AiMetricsEncodedSha256` payload definitions in this module rather
than spreading attribution's plain-string hashes.

On the primary member only, preserve the missing-key role decode default by
adding `S.withDecodingDefaultKey(Effect.succeed(AiMetricsSourceRole.Enum.primary))`
to its primary tag. The tag's constructor default supplies primary for
`.cases.primary.make(...)`. The other two members must not gain a missing-role
decoding default. Keep default encoding strategy passthrough: canonical
encoding includes `sourceRole: "primary"` even when decode received no role.
Do not use `tagDefaultOmit`, which would remove an existing encoded key.

The result keeps flat property reads and flat encoded JSON. The fixed None
view cannot carry a Boolean, so the decoded union has five states without
new getters, aliases, nested wire data or stored state. Direct member codecs
are sufficient; do not insert a second permissive domain class or a custom
normalizer. The primary missing-role path must be exercised through the
whole union decoder, not merely its case decoder, to prove default dispatch.

Exact local basis: `.repos/effect/packages/effect/SCHEMA.md:502` documents
missing-key versus undefined defaults; its `:2010` documents tagged unions.
`.repos/effect/packages/effect/src/Schema.ts:5896`, `:6105`, and `:13280`
define constructor tags, case helpers and optional-key/Option mapping.
The primary default and Never/Option composition are design requirements
whose combined implementation must pass the codec tests below; no prototype
execution is claimed by this design.

# Migration inventory

| Surface | Required migration or preserved consumer |
| --- | --- |
| `src/privacy.ts:210`–`:238` | Replace this flat class with three complete members and the public union, retaining the primary default, hash refinements and all payloads. |
| `:792`–`:840` | `makeSanitizedTranscript` keeps normalized relative-path handling, attribution call, summary metrics and raw envelope creation. Match one attribution value to select the transcript case; eliminate the independent role/option assignments at `:833`–`:834`. |
| `:726`–`:752` | Raw-envelope construction still copies the source role determined during this ingest; do not alter raw event hashes, source kind/path, line numbers or timestamp behavior. |
| `:280`–`:291`, `:383`, `:882`, `:933` | Nest the new union in the privacy result and retain the existing JSON codec, privacy-check flow and `AiMetricsPrivacyError` mapping. |
| `src/derived-storage.ts:786` | Storage input continues nesting `AiMetricsPrivacyCheckResult`; preserve its other fields and constructor behavior. |
| `src/derived-storage.ts:1129`–`:1194` | Keep task id seed `[configSnapshotId, sourceKind, sourceRole, sourcePathHash]`, task title and task metadata. The union's common role view preserves the same bytes. |
| `src/derived-storage.ts:1198`–`:1272` | `upsertSourceFile` retains all columns, ids, metrics, JSON event names, timestamps, hashes and privacy bit. Preserve role at `:1268` and `O.getOrNull(threadSpawn)` at `:1269`. |
| `src/derived-storage.ts:1320`–`:1380` | `upsertSessionAndTurns` keeps session identity `[sourceKind, sourcePathHash]`, INSERT OR REPLACE, all parameter names and role/thread-spawn mapping at `:1377`–`:1379`. |
| `src/derived-storage.ts:1384`–`:1442` | Preserve raw-envelope turn iteration, content-keyed turn ids, INSERT OR IGNORE, first-seen lineage and source role. |
| `src/derived-storage.ts:1470` onward | Retain the derived-store transaction and Parquet export surface; table snapshots must have the same values and schemas. |
| `src/index.ts:183` | Preserve public privacy export names; cases/payload classes stay private. |
| `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:1443` | Keep the existing public privacy JSON text and command behavior. |
| `src/privacy.ts:195`, `:263`, `:913`; `src/derived-storage.ts:763` | Migrate documented `.make` calls to the selected case constructor with the same minimal/defaulted input and observed output. |

Graft's direct symbol/field search found these writers/readers and no direct
app references. The privacy import closure also includes ingest, forwarder,
archive, config-snapshot, hook-pulse, identity-registry, retention, scorecard,
telemetry-v2-store, sequence-break, install and compose. Those import edges do
not prove pair consumption; they are regression boundaries whose inputs and
outputs stay compatible. Re-run exhaustive searches after the attribution
and discovery landings. `AgentSession` was handled as a public-schema
dependency in the attribution singleton and must not be narrowed here.

# Guard-deletion accounting

| Existing obligation | Deletion in this singleton | Retained work |
| --- | --- | --- |
| `src/privacy.ts:833`–`:834` copies a correlated pair into two independent constructor slots. | Delete the paired assignment and construct one transcript case from the attribution match. | Summary, hash, timestamp and envelope payload copying. |
| `src/privacy.ts:228`–`:232` exposes nine decoded combinations. | Replace the product declaration with the five-state union, eliminating downstream implication audits. | Primary legacy default and Option encoding. |
| Storage at `src/derived-storage.ts:1268`–`:1269` and `:1377`–`:1379` assumes a legal pair. | The caller-side legality obligation is supplied by the union; these SQL assignments themselves need not be deleted. | Null conversion, SQL parameters and persistence operations remain exactly as before. |

There are no existing contradictory-pair runtime checks: runtime-guard
deletion count is zero. The concrete removals are one independent-pair writer
and one permissive product declaration. Do not claim that privacy safeguards,
raw parsing, hashing, or SQL null handling disappear. Do not count earlier
attribution or later OTLP work as this record's deletion.

# Encoded-side impact

The direct union codec preserves all canonical privacy JSON keys, field order,
values and defaults. Missing role decodes as primary and re-encodes the
explicit role exactly as before. None thread-spawn omits the key; false and
true are emitted literally. Optional timestamps/hashes still omit on None;
all hash validation, redaction results, event-name array order and raw-envelope
contents remain unchanged. None and present undefined are not interchangeable:
retain exact optional-key behavior rather than adopting nullish defaulting.

For SQL, preserve both source-file and session `source_role`/`thread_spawn`
columns. None maps to NULL; Some(false) maps to FALSE; Some(true) to TRUE.
Preserve all other bound parameters, table schemas, exported Parquet column
types/values, task ids, source-file ids, session ids, turn ids and config ids.
Session replacement must continue supporting later metadata discovery;
first-seen turn roles are not rewritten to match it. No backfill or DDL change
is required. Persisted data with supported role flips remains readable by the
separate seven-state OTLP design.

Compare old/new canonical standalone transcript and full privacy-result JSON
for all five states, plus omitted-role primary fixtures. Reject the four
unsupported attribution-style role/Some combinations, including missing role
plus a Boolean that would default to primary; no source or documented default
constructor supplies that tuple. This restriction must not be propagated to
`AgentSession` or OTLP, whose accepted contracts differ. Preserve unrelated
unknown-key and scalar validation behavior.

# Test impact

Add producer-backed cases for primary, Claude subagent, Codex subagent with
None/false/true, and a supported OpenClaw transcript. Retain existing fixtures
at `test/ingest.test.ts:450`, `:1648`–`:1734`, and `:3239`–`:3240` while adding
the missing false/None cases. Assert complete JSON, all hash payloads,
counts/timestamps, event names and envelope identities; include subagent
without parent hashes and payload-level parent fallbacks.

Exercise omitted-role decode through both the union and containing privacy
result; verify canonical encoding writes primary. Migrate the minimal public
constructor examples and prove the same defaults. Add four invalid known-pair
decode tests, explicit-undefined rejection where the existing key schema
rejects it, schema-derived arbitrary/round-trip and case constructor type
checks. Use the earlier absence-only field's schema-owned arbitrary if needed;
do not relax Never.

For all five tuples assert complete source-file and session rows, including
NULL/FALSE/TRUE, then exported table schemas/values. Reingest the same path
with later subagent metadata for false and true while an earlier primary turn
is pending: verify one stable session id, its current metadata, unchanged old
turn id/role and trace identity. These are persistence compatibility tests;
they do not apply the OTLP schema record early. Retain error mapping,
transaction rollback, privacy/redaction and repeated-ingest behavior.

Tests import `@beep/repo-ai-metrics`. At implementation handoff run full
`bun run beep quality package-verify @beep/repo-ai-metrics` and the packet's
Yeet acceptance path. This draft ran no product tests, storage writes or
services; these are future proof requirements.

# Risk

Land after attribution and discovery, before OTLP, as one Tier 2 singleton
marking only this record applied. The union belongs to this class only;
do not narrow the OTLP join or alter the previously preserved `AgentSession`
contract. Recheck the source inventory after each dependency merges.

The material risks are silently changing primary defaults, losing false at
the JSON/SQL boundary, dropping hash refinements, changing task/session/turn
identity, and rewriting historical roles. Full codec and storage comparison
must pass before apply. The frozen draft changes only this design file;
source, tests, git, inventory, lifecycle and services remain outside its work.

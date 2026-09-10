# Instance

- id: `ai-metrics-discovered-transcript-file-thread-spawn`
- source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- corpus source: `663904610cce2a38c06b0619a8c414646b69361c`
- file:line: `packages/tooling/library/ai-metrics/src/source-discovery.ts:165`
- symbol: `AiMetricsDiscoveredTranscriptFile`
- members: `threadSpawn`, `sourceRole`
- classification: E1/E4; derived; wire; tagged-union; Tier 2 singleton
- source receipt: `../data/design-refresh-2026-09-09-r27-observability-carriers.md`
- independent census: `../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-observability-contract-correction1.jsonl`
  and its completed `.execution.json`; this design still requires P3 review.

Source references below are relative to `packages/tooling/library/ai-metrics/`
unless another path is explicit.

# Current shape

`src/source-discovery.ts:150` exports a class whose required `sourceRole`
(`:164`) and optional-key/default-None `threadSpawn` (`:165`) form a flat
product. Its complete remaining payload, in current schema order, is:
`agentNicknameHash`, `agentRoleHash`, `forkedFromIdHash`, `modifiedAtMillis`,
`parentSessionIdHash`, `parentThreadIdHash`, `sessionIdHash`, `sizeBytes`,
`sourceKind`, `sourcePathHash`. The six optional hashes use
`SourceDiscoverySha256` with optional-key/None defaults; the path hash uses
the same SHA-256 refinement, both numeric fields use `S.Natural`, and source
kind uses the existing transcript-source kit.

Ordinary file discovery gets one attribution at `:378` and copies its paired
role/option at `:398`–`:399`. A separate gateway discovery path constructs an
OpenClaw file at `:568`. `AiMetricsDiscoveredSource.files` nests these records
at `:197`; `sourceDiscoveryToJson` encodes the public result at `:691`.
The class is application-owned sanitized discovery output, not a driver
mirror. No persisted artifact containing this exact class was found; wire
exposure follows the JSON and CLI boundary.

# Cardinality gap

Three source roles times None/Some(false)/Some(true) gives **9/5**.

| Role | Thread-spawn alternatives | Witness |
| --- | --- | --- |
| primary | None | Ordinary primary Codex/Claude discovery through `src/privacy.ts:565` or `:624`. |
| subagent | None, Some(false), Some(true) | Claude subagent paths or Codex subagent metadata through `src/privacy.ts:566`; discovery copies the same attribution at `src/source-discovery.ts:398`. |
| gateway_metadata | None | Dedicated file constructor at `src/source-discovery.ts:568`–`:575`. |

The four primary/gateway Some combinations are unsupported. All six hash
Options remain independent payloads on every role; absence of a parent hash
does not make a subagent invalid. The discovery session-hash fallback at
`:393` is a separate policy and must survive.

# Target schema

Replace the flat class with three annotated private class members and the
exported `AiMetricsDiscoveredTranscriptFile` union/type, using the existing
`AiMetricsSourceRole.mapMembers` and `S.toTaggedUnion("sourceRole")`.
Every member retains the complete payload above, in exactly the existing
field order and with the existing refinements/defaults.

This singleton depends on the merged
`ai-metrics-source-attribution-thread-spawn` design. Reuse the
`sourceRole` and `threadSpawn` field schemas from the corresponding
`AiMetricsSourceAttribution.cases.<role>.fields`. Do not spread all attribution
fields: its plain-string hashes are less restrictive than
`SourceDiscoverySha256`.

| Case | Role schema | Thread-spawn schema |
| --- | --- | --- |
| primary | Existing kit's primary tag | Optional-key Never with None constructor default. |
| subagent | Existing kit's subagent tag | Optional-key Boolean with None constructor default. |
| gateway_metadata | Existing kit's gateway tag | Optional-key Never with None constructor default. |

The fixed None view in the two non-owning members is `Option<never>` and
encodes no key. This gives type-safe common field reads without an alias,
getter or nested wire object. Direct union codecs preserve the flat JSON
shape; no custom transformation is necessary. A known incompatible Boolean
field must fail validation, rather than disappear as an excess property.
Role is still required on decode; case constructors fill their `S.tag` value.

Local API basis: `.repos/effect/packages/effect/src/Schema.ts:5896`, `:6105`,
`:13280` and `.repos/effect/packages/effect/SCHEMA.md:2010`. Those sources
confirm constructor-only tag defaults, tagged-union cases and exact optional
key/Option direction. No Effect v3 recipe or untested hand-rolled guard is
needed. The inherited Never/Option composition still requires implementation
round-trip/arbitrary proof.

# Migration inventory

| Surface | Change or preservation |
| --- | --- |
| `src/source-discovery.ts:150`–`:170` | Define all three full-payload members and replace the exported schema/type. Reuse only the pair from attribution. |
| `:360`–`:401` ordinary discovery | Keep stat/content reads, relative-path policy, attribution failure mapping, salted path hash, fallback session hash, size and modification conversion. Match the attribution case once and construct the corresponding discovered-file case; remove independently chosen role/option fields. |
| `:568`–`:575` gateway discovery | Use the gateway case constructor; retain the gateway's file size, timestamps, source/path identity and existing omission defaults. |
| `:193`–`:210` | Nest the union at `AiMetricsDiscoveredSource.files`; preserve all counters, limits, status, message and root hash fields. |
| `:291`–`:299`, `:403` onward | Keep path-hash ordering, modification ordering, newest-time calculation, limits and aggregate discovery behavior. Common payload fields stay readable on every case. |
| `:691`–`:704` | Keep the result's existing schema JSON encoder and `AiMetricsSourceDiscoveryError` mapping; no boundary payload wrapper. |
| `src/index.ts:235` | Preserve source-discovery exports, including the public model name. Private case classes stay private. |
| `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:1328` | Preserve emitted JSON text and CLI behavior; no new argument or mode. |
| `src/source-discovery.ts:133`–`:145` | Migrate the public class-construction example to the selected case constructor and preserve the example's output. |
| `test/ingest.test.ts:2991`–`:3027`, `:3184`–`:3209`, `:3239`–`:3240` | Retain all-source discovery, gateway JSON role and existing subagent true/Claude coverage; extend the pair matrix. |

Graft found the class's two production construction paths, containing
`files` schema, sorting readers and examples, plus the CLI JSON sink. Its app
symbol search found no direct app references. Re-run exhaustive symbol and
field searches at apply time after the dependency merges; arbitrary casts or
parallel permissive compatibility classes are not an acceptable migration.

# Guard-deletion accounting

| Existing obligation | Removal | What remains |
| --- | --- | --- |
| `src/source-discovery.ts:398`–`:399` separately copies a correlated pair into a permissive class. | Delete that flat pair construction and replace it with one attribution-case-to-file-case match. | Full hash copy and the independent fallback at `:393`. |
| Gateway constructor at `:568` relies on omission while manually selecting the role. | Case selection makes the role/absence contract intrinsic; no gateway Boolean payload can be constructed. | File metadata, hashing, optional hash defaults. |
| Nine-state declaration at `:164`–`:165` delegates the implication to all readers. | Remove the product declaration; five states are represented by the union. | JSON option encoding and source-kind dispatch. |

There are zero current contradictory-pair runtime guards. These are two
writer coherence obligations and one product declaration removed, not three
runtime checks. Do not count filtering, max-file limits, filesystem handling
or None/false encoding as guard deletions. Attribution's own constructor
removals belong to its earlier singleton.

# Encoded-side impact

Preserve the current discovered-file key names, values and schema order,
including `sourceRole` and the optional `threadSpawn` key. None omits that
key; both Some values survive unchanged. All optional hashes still omit on
None, and SHA-256 validation remains exact. Missing role remains invalid;
do not introduce a primary decode default just because sanitized transcripts
have one. Keep file-array order and all source/result counters and statuses.

Capture old/new canonical file encodings and full
`sourceDiscoveryToJson` strings for all five states. Assert exact absence with
own-key checks, literal false retention, full hash values, gateway defaults,
mtime/size values and the fallback session hash. Compare whole CLI JSON,
not just the pair. Reject all four unsupported known role/Boolean tuples;
preserve unrelated excess-property behavior rather than globally tightening
the decoder. No DuckDB column or persisted storage migration is needed for
this carrier, and its singleton does not change privacy JSON or OTLP payloads.

# Test impact

Use actual file discovery inputs for primary, Claude subagent, Codex subagent
with missing/false/true `thread_spawn`, and OpenClaw gateway file discovery.
The two subagent-None inputs exercise distinct producer routes. Existing
fixtures prove true and gateway, but dedicated missing/false fixtures are
required. Compare old/new public JSON for all five state tuples and every
payload field. Include an absent attribution session hash to verify the
existing path-derived fallback and representative zero size/mtime values
where currently accepted.

Add four contradictory-pair decode failures, constructor type checks, and
schema-derived union arbitrary/equivalence/round-trip coverage. Inherit the
schema-owned constant-None arbitrary treatment if the earlier dependency
needs it; never widen Never to Boolean to satisfy a generator. Retain
filesystem failures, file limits, counters and sorting tests. Imports use
`@beep/repo-ai-metrics`. At implementation handoff run full
`bun run beep quality package-verify @beep/repo-ai-metrics`, then the packet's
canonical Yeet checks. No product tests were run during this design-only pass.

# Risk

Land this single record after attribution and before sanitized transcript.
Its PR may replace the discovered-file schema and construction/read sites
only; it must not apply the sanitized or OTLP records through shared-field
changes. Reuse the already reviewed attribution case pair without changing
it. Mark only this id applied in this Tier 2 singleton.

Primary risks are broadening hash validation through whole-case spreads,
adding a role default that never existed, losing explicit false and changing
file/property ordering. Full JSON compatibility is required before apply.
All evidence is frozen to the source pins above; only this design document
was authored, with no source/test/git/lifecycle/service mutation.

# Instance

- id: `ai-metrics-otlp-turn-export-row-thread-spawn`
- source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- corpus source: `663904610cce2a38c06b0619a8c414646b69361c`
- file:line: `packages/tooling/library/ai-metrics/src/otlp.ts:375`
- symbol: `AiMetricsOtlpTurnExportRow`
- members: `threadSpawn`, `sourceRole`
- classification: E4; derived; wire; tagged-union; Tier 2 singleton
- source receipt: `../data/design-refresh-2026-09-09-r27-observability-carriers.md`
- independent census: `../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-observability-contract-correction1.jsonl`
  and its completed `.execution.json`; this design still requires P3 review.

Source references below are relative to `packages/tooling/library/ai-metrics/`
unless another path is explicit. The corrected seven-state table supersedes
the raw lane's unsupported Some-implies-subagent claim.

# Current shape

The private SQL row class at `src/otlp.ts:358` independently models
`sourceRole: AiMetricsSourceRole` (`:374`) and
`threadSpawn: S.OptionFromNullOr(S.Boolean)` (`:375`). This is a nullable,
required SQL column: None encodes as null; a missing key is not the same input.
The containing array decoder at `:384` feeds `readTurnRows` at `:443`.

Complete row fields in schema order are `agentNicknameHash`, `agentRoleHash`,
`agentSessionId`, `configSnapshotId`, `eventName`, `forkedFromIdHash`,
`ingestRunId`, `lineNumber`, `parentSessionIdHash`, `parentThreadIdHash`,
`rawEventHash`, `sessionIdHash`, `sourceKind`, `sourcePathHash`, `sourceRole`,
`threadSpawn`, `timestamp`, `turnId`. All six hash payloads and timestamp use
required nullable string codecs, not SHA-256 refinements or optional-key
schemas. Other strings remain strings, line number remains `S.Natural`, and
source kind retains its existing kit.

The row is an application-owned join. SQL at `:454` selects historical
turn-preferred `COALESCE(t.source_role, s.source_role, 'primary')`, while
`:463` independently selects the current session's `s.thread_spawn`.
Those values can differ in provenance after a supported role change.
`readAiMetricsOtlpSpanProjections` (`:653`, exported by `src/index.ts:174`)
turns the rows into public wire projections even though the row class itself
is private.

# Cardinality gap

The product is **9 representable, 7 legal**, not 9/5.

| Role | Thread-spawn value | Supported producer/SQL path |
| --- | --- | --- |
| primary | None | Ordinary primary transcript. |
| primary | Some(false) | Pending first-seen primary turn, then same-path Codex ingest discovers subagent metadata carrying false. |
| primary | Some(true) | The same two-ingest path carrying true. |
| subagent | None | Claude subagent or Codex subagent without the optional Boolean. |
| subagent | Some(false) | Ordinary Codex subagent false. |
| subagent | Some(true) | Ordinary Codex subagent true. |
| gateway_metadata | None | Supported OpenClaw transcript route at `src/ingest.ts:115`/`:148`, using `src/privacy.ts:650`. |

`src/derived-storage.ts:1329` keys sessions by source kind and path hash;
`:1330` replaces current session metadata. Turn identity excludes ingest run,
and `:1404` INSERT OR IGNORE retains first-seen role (`:1435`). The explicit
role-change reasoning is at `:469`–`:479`; OTLP's identity explanation at
`src/otlp.ts:505`–`:510` preserves this divergence. Therefore historical primary
with either Some Boolean is legitimate. Reverse changes can also leave a
historical subagent turn with current primary/None session metadata; that
already belongs to subagent/None and must remain supported.

Only gateway/Some(false) and gateway/Some(true) are unsupported. Gateway role
comes from OpenClaw attribution, which omits thread-spawn. Source kind is part
of the stable session key, so later Codex ingest cannot attach subagent
metadata to that gateway session. The actual implication is gateway => None.

# Target schema

Create three annotated private full-row class members in `src/otlp.ts`,
assembled with the existing `AiMetricsSourceRole.mapMembers` and
`S.toTaggedUnion("sourceRole")`; keep the row union and schema-derived type
private under `AiMetricsOtlpTurnExportRow`. Preserve the full row payload and
schema declaration order above.

| Member | Role schema | Thread-spawn schema |
| --- | --- | --- |
| primary | `S.tag(AiMetricsSourceRole.Enum.primary)` | Existing `S.OptionFromNullOr(S.Boolean)`. |
| subagent | `S.tag(AiMetricsSourceRole.Enum.subagent)` | Existing `S.OptionFromNullOr(S.Boolean)`. |
| gateway_metadata | `S.tag(AiMetricsSourceRole.Enum.gateway_metadata)` | `S.OptionFromNullOr(S.Never)`. |

The gateway field is a fixed None view (`Option<never>`), whose encoded
column is required null. Both other members retain all three option states.
No constructor/decoding default is added to any nullable column. `sourceRole`
remains required during decode; SQL keeps responsibility for its existing
COALESCE default. Do not reuse the attribution/discovery/sanitized union,
their primary restriction, their optional-key codecs or their hash refinements.
The shared concept here is only the already existing role LiteralKit.

The direct union codec restricts the two unsupported joined rows while
retaining the original aliases and all supported null/Boolean values. No
custom schema transform, persisted normalizer, role rewrite or separate
compatibility class is needed. Keep common property reads, using the union's
schema-derived match/guards only when role-specific behavior is actually
needed; do not add branches purely to restate the schema.

Exact local API basis: `.repos/effect/packages/effect/src/Schema.ts:12848`
defines `OptionFromNullOr` as required nullable input and maps None to null;
`:5896` confirms tags default constructors only; `:6105` defines the unique
discriminator/case API. `.repos/effect/packages/effect/SCHEMA.md:2010` provides
the tagged-union contract. The composed Never/null codec must receive the
implementation tests below; this design does not claim it was executed.

# Migration inventory

| Surface | Required change or preservation |
| --- | --- |
| `src/otlp.ts:358`–`:384` | Replace the nine-state class with three complete members and point the array decoder at the seven-state union. No new public export. |
| `:443`–`:477` | Keep SQL aliases, JOIN, pending-watermark predicate, order, COALESCE role selection and session thread-spawn selection unchanged. Retain separate read and decode failure mapping via `exportFailure`. |
| `:404`–`:437` | Keep provider, tool-name and OpenInference span-kind classification based on common row fields. No role/thread-spawn recomputation. |
| `:509`–`:517` | Preserve role-bearing session seed and exact trace/session span digest prefixes and lengths. Keep turn span identity based on `turnId`. |
| `:525`–`:552` | `sessionProjection` consumes the union; the fixed gateway None makes the existing option-to-attribute projection safe. Keep all hash and session attributes, order and allowlisting. |
| `:554`–`:586` | `turnProjection` preserves first-seen role, all event/provider/timestamp/tool attributes, parent span id and turn id. Thread-spawn is not added to turn attributes. |
| `:588`–`:629` | Preserve grouping by `sessionSeed`, first-row session projection, each session adjacent to its turns, all counts and exact batch `turnIds`. |
| `:653`–`:675` | Keep derived-store migration before query and existing typed error behavior. |
| `:1104` onward | Export still consumes the public batch; HTTP/OTLP encoding, chunking, acknowledgements, retry/partial-export handling and watermark closure are unchanged. |
| `src/index.ts:174` | Preserve public projection reader/export names. The row cases remain implementation details. |
| `src/derived-storage.ts:469`, `:1329`, `:1404` | These are compatibility witnesses and regression-test inputs, not rewrite targets. Preserve role-changing sessions and first-seen turns. |

Graft found row consumers in `toolNameFor`, `providerFor`,
`openInferenceSpanKindFor`, `sessionSeed`, id functions, session/turn
projection, grouping and `readTurnRows`. The row is not directly used by CLI
or app code; its public reader/export output is the observable surface.
Re-run symbol/field searches after prior singleton landings. No SQL schema,
storage producer or earlier carrier definition is changed by this PR.

# Guard-deletion accounting

| Existing obligation | Deletion or transfer | Retained code |
| --- | --- | --- |
| `src/otlp.ts:374`–`:375` exposes the role/option Cartesian product. | Delete the single permissive product declaration; the gateway member can no longer carry Some(Boolean). | Required-column/null decoding and all other row validation. |
| SQL aliases at `:454` and `:463` leave every consumer to remember the narrower gateway implication. | The union decoder owns that invariant once; the downstream implication audit is removed. | Both SQL expressions remain unchanged because they encode different temporal facts. |
| `sessionProjection` at `:538`/`:544` emits optional thread-spawn beside role. | Its input is now schema-correlated, so no caller-side role/Boolean coherence assumption is needed. | `O.getSomesStruct` and both attribute assignments remain; they are required encoded projection, not redundant guards. |

Runtime implication guards deleted: **zero**, because none exists in the
frozen source. Concrete source removal: **one permissive product declaration**
replaced with role-owned member schemas. The associated consumer invariant is
absorbed by the type. Do not invent an `if` to remove or count unchanged SQL,
Option handling, identity comments or retry checks as deleted guards. This
record's benefit is rejecting unsupported row states at the application
decoder and removing the nine-state internal model; it does not justify
removing either independent historical/current value from SQL.

# Encoded-side impact

SQL keeps every alias and required column. `threadSpawn: null` decodes None,
false/true decode their Some values, and missing `threadSpawn` still fails.
Do not substitute optional-key decoding or normalize false to null.
Malformed roles, types, missing required columns and the two unsupported
gateway/Some rows fail through the existing
`AiMetricsOtlpExportError` path with the decode-failure message at `:475`;
do not let a new raw Schema error escape. Preserve query-failure precedence.

The OTLP session attribute `ai_metrics.thread_spawn` remains absent for None,
literal false for Some(false), literal true for Some(true). Role is always
emitted as `ai_metrics.source_role`, including primary when session metadata
now says subagent. Other allowlisted attributes and their values/order remain
the same. Turn attributes continue carrying historical role without a new
thread-spawn attribute. Preserve JSON/OTLP resource/scope/span shape and all
provider/OpenInference mappings.

Identity proof compares exact seed bytes
`sourceKind + "\u0000" + sourceRole + "\u0000" + sourcePathHash`, prefixed
`trace:` and `session:` digests, `turn:` digests, nonzero-id protection and
grouping. Do not replace historical role with current session role or group
on `agentSessionId`. Preserve pending-row selection, migration behavior,
partial acknowledgements and watermark updates for exactly the exported
turn ids. No database migration or artifact rewriting accompanies this union.

# Test impact

Build seven positive cases through supported producers, storage and the
public projection reader. Ordinary primary/subagent and OpenClaw cases must
use real supported transcript routes. Do not substitute a systemd unit text
file for an OpenClaw transcript containing turns.

For each false/true role-change case: ingest a primary Codex transcript and
leave one content-identical turn unexported; reingest the same source-kind/path
with later subagent metadata carrying that Boolean; assert the stable session
id/current session pair and retained first-seen primary turn id/role; read
projections and assert primary role plus that Boolean on the session span,
and unchanged role-bearing trace/span seeds. Preserve old turn line/hash
identity when building the second fixture. Also exercise a reverse change to
ensure historical subagent/None remains supported. Codec-only fabricated
rows do not prove these temporal paths.

Add two gateway/Some decoder rejection cases, missing-required-column and
wrong-scalar cases, typed read/decode failure mapping, and an exact
NULL/FALSE/TRUE round-trip table. Compare the entire old/new projection batch,
OTLP request payload, attributes, identities, grouping/counts and `turnIds`
for all seven states. Use public reader tests backed by fixture storage for
the private row; do not export the row just to test it. Derive union guards,
equivalence and arbitraries from schemas where used. If Never requires an
arbitrary override, keep a schema-owned constant-None generator without
relaxing the codec.

Retain `test/ingest.test.ts:888`, `:936`, `:968`, `:980`, `:994` for pending,
retry and partial-export behavior; `:1487`–`:1504` for primary role output;
`:1648`–`:1734` for subagent metadata. The existing duplicated-row fixtures
at `:944`–`:965` are useful export coverage but do not replace the role-change
proof. Tests import through `@beep/repo-ai-metrics`. At implementation handoff
run full `bun run beep quality package-verify @beep/repo-ai-metrics`, then the
packet's Yeet acceptance commands. None was run for this design-only task.

# Risk

Land last among these four records, after attribution, discovery and
sanitized transcript, as a separate Tier 2 singleton marking only this id
applied. The prior five-state carrier changes must already preserve the
storage role-change paths this design tests. Revalidate source citations and
consumer inventory on the merged dependency head; do not merge multiple
record implementations into this PR through a shared-model change.

The highest risk is incorrectly imposing Some => subagent and losing valid
pending primary turns, followed by identity drift, false/None collapse and
watermark regressions. The explicit seven-state producer matrix and exact
wire comparison are apply gates. This frozen design changes only its document;
no source, test, SQL, service, git, inventory or lifecycle mutation was made.

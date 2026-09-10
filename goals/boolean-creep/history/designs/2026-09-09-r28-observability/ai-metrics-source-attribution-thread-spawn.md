# Instance

- id: `ai-metrics-source-attribution-thread-spawn`
- source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- corpus source: `663904610cce2a38c06b0619a8c414646b69361c`
- file:line: `packages/tooling/library/ai-metrics/src/models.ts:379`
- symbol: `AiMetricsSourceAttribution`
- members: `threadSpawn`, `sourceRole`
- classification: E1/E4; derived; internal; tagged-union; Tier 2 singleton
- source receipt: `../data/design-refresh-2026-09-09-r27-observability-carriers.md`
- independent census: `../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-observability-contract-correction1.jsonl`
  and its completed `.execution.json`; this design still requires P3 review.

All source references below are relative to
`packages/tooling/library/ai-metrics/` unless another path is explicit.

# Current shape

The public class at `src/models.ts:370` stores the three-literal
`AiMetricsSourceRole` (`:335`) beside `Option<boolean>` (`:379`). The option
uses `S.OptionFromOptionalKey(S.Boolean)` and `SchemaUtils.withNoneDefault`.
It carries six independent optional string payloads, in this order:
`agentNicknameHash`, `agentRoleHash`, `forkedFromIdHash`,
`parentSessionIdHash`, `parentThreadIdHash`, `sessionIdHash`. All use the same
optional-key/None-default policy. `sourceRole` is required on decode; this
particular class has no primary decoding default.

`makeAiMetricsSourceAttribution` at `src/privacy.ts:610` derives the value
from source content/path metadata and salted hashing. It is not a second store
of user-editable provenance. Its Claude, Codex, and OpenClaw branches are at
`:623`, `:629`, and `:649`. No standalone persistence of this class was found.
The public model and factory are exported through `src/index.ts:165` and
`:183`; downstream carriers encode the result, which makes Tier 2 appropriate.

# Cardinality gap

The independent structural product is three roles times three option states:
**9 representable, 5 legal**. The Boolean payload is not a truthy/falsy proxy
for absence.

| Role | Thread-spawn value | Producer witness |
| --- | --- | --- |
| primary | None | Codex without subagent metadata at `src/privacy.ts:565`; Claude primary path at `:624`. |
| subagent | None | Claude subagent path at `:578`, or Codex subagent object without `thread_spawn`. |
| subagent | Some(false) | Codex `source.subagent.thread_spawn=false`, copied at `:566` and `:639`. |
| subagent | Some(true) | Same producer with true; existing fixture at `test/ingest.test.ts:1648`. |
| gateway_metadata | None | OpenClaw constructor at `src/privacy.ts:650`. |

E1 is the shared Codex metadata choice at `src/privacy.ts:565`; E4 is the
three-branch producer contract. Some(threadSpawn) implies subagent on this
carrier. It does not imply a parent hash: payload-level parent metadata can be
used independently at `:553` and `:557`. This five-state table must not be used
for the seven-state OTLP joined row.

# Target schema

Keep the existing `AiMetricsSourceRole` LiteralKit. Define three annotated
private `S.Class` members in `src/models.ts`, assemble them through that kit's
`mapMembers`, and finalize with `S.toTaggedUnion("sourceRole")`. Export the
union as `AiMetricsSourceAttribution` and its same-name schema-derived type.
Use its `.cases`, `.match`, and `S.is` helpers instead of new predicates.

| Case | Discriminator | Thread-spawn schema |
| --- | --- | --- |
| primary | `S.tag(AiMetricsSourceRole.Enum.primary)` | `S.OptionFromOptionalKey(S.Never).pipe(SchemaUtils.withNoneDefault)` |
| subagent | `S.tag(AiMetricsSourceRole.Enum.subagent)` | Existing `S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault)` |
| gateway_metadata | `S.tag(AiMetricsSourceRole.Enum.gateway_metadata)` | Same absence-only schema as primary. |

The absence-only field is a schema-fixed None view, not another Boolean
decision. Its decoded type is `Option<never>`, which cannot carry a Boolean;
its encoded key cannot be present. Retaining this fixed view keeps existing
flat readers and optional-key encoding without compatibility getters, renamed
wire keys, a nested payload, or a second unrestricted product. All six hash
fields remain present as independent Options in every member, with their
current `S.String` domain and defaults. Keep their declaration order followed
by `sourceRole`, `threadSpawn`.

Extract those six existing hash field definitions into a private annotated
payload class in the same module for reuse by the three cases and
`AgentSession`. No new module or public helper is needed. The union's case
schemas expose the role/thread-spawn field definitions needed by the later
discovery and sanitized-transcript singletons; those consumers must reuse
only this pair, not these broader string hash schemas.

The direct member codecs are the compatibility codecs: flat encoded input
decodes to a correlated case and that case encodes the same flat keys. A
handwritten `decodeTo` normalizer is unnecessary here. Missing role must still
fail decode. `S.tag` supplies the discriminator to the selected case's
constructor; do not pass it again to `.cases.primary.make(...)`.

Exact local API basis: `.repos/effect/packages/effect/SCHEMA.md:2010` and
`:729`; `.repos/effect/packages/effect/src/Schema.ts:6105` (`toTaggedUnion`),
`:5896` (`tag` is a constructor default), and `:13280`
(`OptionFromOptionalKey` maps absence to None and None to omission).
`LiteralKit.mapMembers` follows the local implementation in
`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:792`.
The composed Never/Option codec and its derived arbitrary need implementation
verification; no executable prototype or package test was run for this design.

# Migration inventory

| Surface | Required change or preservation |
| --- | --- |
| `src/models.ts:370` | Replace this product class with the three-case union, retaining the complete payload and encoded property order. |
| `src/privacy.ts:544` | In `codexAttributionMetadata`, derive a correlated role/thread-spawn fragment in one `Option.match` over `firstCodexSubagentSource`. Preserve all six raw metadata selections and parent/session fallback precedence; remove the role ternary plus independent thread-spawn assignment at `:565`–`:566`. |
| `src/privacy.ts:623` | Select primary/subagent case from `pathRoleFor`; preserve Claude's session hash and None thread-spawn. |
| `src/privacy.ts:629` | Preserve each hashing effect, then match the correlated Codex fragment to construct the appropriate attribution case. No truthiness test may replace Some(false). |
| `src/privacy.ts:649` | Construct the gateway case with the existing service-name hash and absent thread-spawn. |
| `src/privacy.ts:726`, `:748` | `rawEventEnvelopes` accepts the union and copies its role. Event names, hashes, line numbers and historical turn metadata remain unchanged. |
| `src/privacy.ts:805`, `:820`, `:833` | Factory result is now a union. The still-unmigrated sanitized class can read its common role/option views and keep its existing flat construction in this PR. Its declaration is owned by its later singleton. |
| `src/source-discovery.ts:378`, `:387`, `:398` | The same temporary flat projection into the existing discovered-file class remains typed and supported; preserve its fallback session hash. Do not migrate its declaration here. |
| `src/models.ts:754`–`:768` | Remove the now-invalid `AiMetricsSourceAttribution.fields` spread from `AgentSession`. Reuse private hash fields and explicitly declare its original unrestricted thread-spawn option and `SourceRoleDefaultPrimary`, preserving old field order. |
| `src/models.ts:364`, `:743` | Update the attribution example to the new case constructor. Keep the `AgentSession.make` example valid with role omitted and observed value primary. |
| `src/index.ts:165`, `:183` | Existing export paths retain the model/factory names. Case classes and hash payload stay private; no compatibility alias. |
| `test/ingest.test.ts:265`–`:271`, `:339` | Preserve `AgentSession` schema-derived arbitrary, guard, equivalence and round-trip tests without narrowing that separate public schema. |

`AgentSession` is a migration dependency, not an additional confirmed carrier.
Graft's exhaustive reference search found its documented default constructor
and generic model tests, but no production constructor. Preserve its whole
current accepted product, including combinations outside attribution's five
states; neither retire this public model nor infer a narrower role invariant
from its name. This avoids both breaking `.fields` and silently applying a new
unreviewed qualification.

Graft searched direct symbol/field consumers in the package and CLI, traced
the attribution import closure, and found no app references. The trace also
reaches archive, config-snapshot, forwarder, hook-pulse, identity-registry,
ingest, retention, scorecard, telemetry-v2-store, sequence-break, install and
compose through privacy imports; this is module coupling, not proof those
modules consume this pair. Their public results remain compatible. CLI
`packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:1328`
and `:1443` print the downstream discovery/privacy JSON.

# Guard-deletion accounting

| Existing obligation | Deletion in this singleton | Retained boundary work |
| --- | --- | --- |
| `src/privacy.ts:565`–`:566` assembles role and option separately. | Remove one ternary/independent-pair assembly; construct one correlated case from the subagent Option. | Reading optional untrusted Codex metadata and preserving false. |
| Three branches at `:623`, `:629`, `:649` must manually uphold the five-state table against a permissive class. | Replace all three unrestricted class constructions with schema case construction. Primary/gateway cannot accept a Boolean thread-spawn payload. | Source-kind/path classification and six hashing effects. |
| `src/models.ts:378`–`:379` exposes a nine-state product to every consumer. | Delete that product declaration and its caller-side implication obligation; the type carries the five-state contract. | Option encoding/omission at actual boundaries. |

There is no existing contradictory-pair runtime guard to delete. Count zero
such guards; do not claim SQL null conversion, role classification or privacy
checks as removals. Discovery/sanitized paired construction is accounted in
their own later designs and is not counted again here.

# Encoded-side impact

For every supported tuple and representative full hash payload, compare the
old/new canonical schema encoding and downstream privacy/discovery JSON.
All existing hash bytes, absent hash keys, `sourceRole` literals, default None
values and property order remain. Some(false) encodes as literal false;
Some(true) as true; None omits `threadSpawn`. Required role stays required.
Reject the four unsupported attribution Boolean/role pairs at its codec;
never silently strip a supplied known `threadSpawn` key. Unknown-key behavior
otherwise follows the current schema policy. This is restriction of the
independently proven unsupported product, not a payload migration.

`AgentSession` retains its old accepted inputs, omitted-role constructor and
decoder default, hash/option defaults and encoded key order. Its compatibility
proof is separate from attribution's five-case positive table. No SQL schema,
column, serialized envelope, task/session/turn id, or OTLP attribute changes
in this PR. Verify all five tuples through the current downstream carriers
and their existing SQL projections as a cross-boundary regression proof.

# Test impact

Add five producer-driven attribution fixtures: primary, path-derived Claude
subagent, Codex subagent missing `thread_spawn`, false, true, plus gateway
coverage (the two None-subagent recipes intentionally share a tuple). Retain
`test/ingest.test.ts:450` and `:1648`–`:1734`; add dedicated false/absent cases.
Assert complete hash payloads, payload-level parent fallback, salted hashing,
and identical raw-envelope role/identity. Add four forbidden-pair decode
failures and compile-time case-constructor checks; do not pass raw booleans to
an absence-only case.

Keep generic `AgentSession` arbitrary/round-trip tests and add the exact
documented minimal constructor plus omitted-role decode and full-payload
round-trip fixtures, including primary/Some(false) to prove this dependency
was not silently narrowed. Verify generated union arbitraries contain only
five supported states; if Never cannot derive an arbitrary automatically,
attach a schema-owned constant-None arbitrary for the fixed field without
widening its runtime/type contract. Tests import through `@beep/repo-ai-metrics`.

At implementation handoff run full
`bun run beep quality package-verify @beep/repo-ai-metrics`; then the canonical
Yeet proof required by the packet. These are future acceptance commands, not
claims of tests performed during this design-only pass.

# Risk

Land first among these four attribution-related records, in one Tier 2 PR
marking only this id applied. Next land discovery, then sanitized transcript,
then OTLP as separate singleton PRs, refreshing their exact-source inventories
and designs after each merged dependency. Keep each other carrier's schema
unchanged until its own PR; the common flat views make intermediate revisions
work without temporary aliases or double application.

The main risks are accidentally narrowing `AgentSession`, losing None versus
Some(false), reusing weak hash schemas in stronger carriers, and altering
encoded order while extracting common fields. The full compatibility matrix
is mandatory before apply. The source is frozen for this draft; no source,
tests, git state, inventory, lifecycle or services were changed by this design.

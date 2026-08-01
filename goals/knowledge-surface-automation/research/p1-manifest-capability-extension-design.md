# P1 design — additive goal-manifest capability extension

Status: schema-slice design only; no implementation is authorized here.

## Scope and binding doctrine

Workstream D requires defaulted `provides`/`requires` arrays, a generated
capability catalog, disposable in-memory `bun:sqlite`, and a pure-TypeScript
differential oracle (`goals/knowledge-surface-automation/SPEC.md:180-216`). The
current census contains 109 tracked manifests, including `_template`; the outer
decoder is intentionally lenient and currently strips unknown keys from decoded
output (`goals/knowledge-surface-automation/research/cli-ground-truth.md:50-68`).

This slice changes only the canonical manifest schema and its schema-derived
projection inputs. It does not implement SQLite, graph commands, Mermaid,
evidence receipts, or naming policy.

## Decided contract

1. `GoalManifest` remains the one canonical initiative-manifest schema and
   `decodeGoalManifest` remains the one decoder. Do not create a parallel
   `InitiativeManifest` class or decoder. “InitiativeManifest” remains the
   domain/documentation name; code imports `GoalManifest` in this slice.
2. Keep `initiative-manifest/v2` canonical. This additive, defaulted modeling
   change does not mint v3, rewrite 109 files, or turn every v2 packet into a
   doctor upgrade advisory. Existing accepted tokens remain unchanged.
3. Add top-level modeled `provides` and `requires` fields. They are decoded
   arrays and constructor/decoder-default to empty arrays.
4. Missing keys therefore decode to present `[]` values. “Existing manifests
   decode unchanged” means every old wire document still succeeds with the same
   existing-field semantics; the normalized output intentionally gains the two
   empty collections.
5. Because the keys are modeled, decode no longer strips them. Encoding a
   decoded manifest emits both arrays, including empty defaults. Byte-preserving
   JSONC editing remains the migration/writer's job, not the schema codec's.
6. Keep the outer manifest's current excess-property behavior. Other bespoke
   keys still do not fail decode and are still absent from decoded output unless
   separately modeled. Correct the misleading “pass through undecoded” comment
   in `Goals.schemas.ts`; raw callers must retain raw JSON when they need it.
7. A manifest's arrays have set semantics for projection. Projection sorts and
   deduplicates exact decoded slugs; doctor/catalog reports duplicate declarations
   so authoring mistakes are visible rather than semantically multiplied.
8. Requirement entries are AND. Multiple providers of one capability are OR.
   Only `completed-retained` providers satisfy nominal readiness. Evidence-backed
   readiness is a separate later projection and must not overwrite nominal state.

The single-schema decision closes the ownership risk identified at
`goals/knowledge-surface-automation/research/cli-ground-truth.md:368-374`.

## Exact schema addition

The field/default structure below is decided. `CapabilitySlug` has two candidate
definitions because its segment grammar is a ratified grill item. The sketch is
illustrative, not implementation.

```ts
import { $RepoCliId } from "@beep/identity/packages"
import { A } from "@beep/utils"
import { Effect } from "effect"
import * as S from "effect/Schema"

const $I = $RepoCliId.create("commands/Goals/Goals.schemas")

// CapabilitySlug definition is selected only after the naming grill.
export const CapabilitySlug = /* Option A or B below */
export type CapabilitySlug = typeof CapabilitySlug.Type
export const isCapabilitySlug = S.is(CapabilitySlug)

const CapabilitySlugList = S.Array(CapabilitySlug).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<CapabilitySlug>())),
  S.withDecodingDefault(Effect.succeed(A.empty<CapabilitySlug>()))
)

export class GoalManifest extends S.Class<GoalManifest>($I`GoalManifest`)({
  // all current fields remain byte-for-byte in this field map
  initiative: GoalInitiative,
  completionGate: GoalCompletionGate,
  // ...existing fields...
  provides: CapabilitySlugList,
  requires: CapabilitySlugList,
}, $I.annote("GoalManifest", {
  description: "Canonical goal-packet manifest with defaulted capability edges.",
})) {}

export const decodeGoalManifest = S.decodeUnknownEffect(GoalManifest)
```

`S.withConstructorDefault(Effect.succeed(...))` and
`S.withDecodingDefault(Effect.succeed(...))` are the current Effect v4 forms
already used for array defaults in, for example,
`packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:155-162`.
The class/default pattern makes both `GoalManifest.make({...})` and unknown-input
decode produce arrays without runtime fallback code.

## Capability slug constraint options

Final names, granularity, hierarchy, aliases, and deprecation rules are not
decided here. These are the schema mechanisms the grill chooses between.

### Option A — constrained `namespace/name` via `S.TemplateLiteral`

```ts
const CapabilitySegment = S.String.check(S.isPattern(
  /^[a-z][a-z0-9-]*$/,
  {
    identifier: $I`CapabilitySegmentPatternCheck`,
    title: "Capability Segment Pattern",
    description: "Illustrative lowercase capability namespace/name segment.",
    message: "Expected a lowercase capability segment",
  }
))

export const CapabilitySlug = S.TemplateLiteral([
  CapabilitySegment,
  "/",
  CapabilitySegment,
]).pipe($I.annoteSchema("CapabilitySlug", {
  description: "Namespaced capability identifier.",
}))
```

Trade-offs:

- Enforces the ratified namespace boundary at decode time and prevents empty,
  whitespace, case-variant, and multi-slash identities from entering SQLite.
- Gives `S.is(CapabilitySlug)` to every writer and projection boundary.
- Exactly two segments may be too coarse; the regex encodes naming policy and
  cannot be ratified accidentally in an implementation PR.
- A future hierarchy or alias grammar would require a deliberate schema-version
  or compatibility plan.

### Option B — free string

```ts
export const CapabilitySlug = S.String.pipe(
  $I.annoteSchema("CapabilitySlug", {
    description: "Capability identifier; naming policy enforced by doctor.",
  })
)
```

Trade-offs:

- Maximally additive and accepts future conventions without a decode migration.
- Admits empty strings, whitespace, missing namespaces, case collisions, and
  task prose into the graph unless a second policy layer rejects them.
- Splits source of truth between schema and doctor and makes deterministic
  normalization more dangerous.

Recommendation: choose Option A after the P2 grill ratifies the segment and
hierarchy grammar. Do not make the illustrative regex a decision by copying it.
If naming cannot be ratified before implementation, use Option B only for a
read-only census/report prototype and do not publish graph state as canonical.
The four current raw values (`knowledge/doctor`, `skills/warehouse`,
`goals/graph`, `goals/bootstrap`) satisfy the illustrative two-segment shape.

## Decode-retention and compatibility test plan

Use production `GoalManifest`, `decodeGoalManifest`, and
`S.encodeUnknownEffect(GoalManifest)`; do not define weaker test schemas.

1. **Evergreen tracked census:** discover every tracked
   `goals/*/ops/manifest.json`, including `_template`, parse with the existing
   JSONC helper, and decode. Record that the current starting census is 109 and
   report every failing path; do not maintain a hand-copied fixture list.
2. **Legacy minimum:** a manifest containing only required `initiative` and
   `completionGate` decodes with `provides: []` and `requires: []`.
3. **Constructor defaults:** `GoalManifest.make` may omit both keys and produces
   the same empty arrays.
4. **Retention:** decode the live-shape fixture with
   `provides: ["knowledge/doctor"]`; assert the decoded value retains it.
5. **Decode→encode→decode:** encode that decoded value, assert encoded
   `provides` is unchanged and encoded `requires` is `[]`, decode again, and
   compare both arrays.
6. **Wrong type:** reject a scalar `provides`, a numeric member, and (under
   Option A) malformed/non-namespaced strings. Unknown unrelated top-level keys
   remain accepted but absent from encoded normalized output.
7. **No mutation:** decoding and encoding tests work in memory; no census file is
   rewritten merely to prove compatibility.
8. **Doctor parity:** run old-manifest and capability-manifest fixtures with the
   same lifecycle/completion data and assert identical goal-doctor findings.
   Capability validation beyond decode belongs to a later explicit doctor rule.
9. **Index parity:** render the existing portfolio index from identical display
   fields with and without capabilities and assert byte equality. Capabilities
   do not enter the current table until the separately designed Mermaid block.
10. **Order independence:** permute manifest discovery order and array order;
    normalized projection rows and reference-evaluator output remain identical.

The current index already sorts status groups and packet slugs deterministically
(`goals/knowledge-surface-automation/research/cli-ground-truth.md:94-107`), and
the canonical inventory is the existing goal-packet census rather than a second
directory walker (`goals/knowledge-surface-automation/research/cli-ground-truth.md:70-78`).

## Deterministic normalized projection

The schema decoder feeds a pure `compileCapabilityProjection` before any SQLite
operation. It accepts decoded manifests in any discovery order and yields four
sorted, duplicate-free row arrays. SQLite consumes only these rows.

| Table/row | Columns and derivation | Key/order |
| --- | --- | --- |
| `packets` | `packet_id = initiative.id`; `status`; `execution_capable = executionCapable ?? null`; `title = initiative.title ?? packet_id`; `mission = mission ?? null`; `updated = initiative.updated ?? null`; phase counts | PK `packet_id`; sort by `packet_id` |
| `capabilities` | `capability_slug`, the union of every normalized provides/requires member | PK `capability_slug`; sort lexically |
| `provides_edges` | `provider_packet_id`, `capability_slug` for each provides member | PK pair; sort capability then provider |
| `requires_edges` | `consumer_packet_id`, `capability_slug` for each requires member | PK pair; sort consumer then capability |

Foreign keys connect both edge tables to `packets` and `capabilities`. Store no
provider/consumer counts, readiness booleans, fog nodes, or Mermaid text in these
normalized tables; those are deterministic queries/projections. A duplicate
array entry yields one edge plus a doctor/catalog finding. Two packets providing
one capability yield two edges and a catalog collision, not last-write-wins.

Decode failures do not create partial packet rows. The command reports the
manifest error and refuses the graph projection, matching the current index's
explicit invalid-manifest treatment rather than silently inventing nodes.

### Nominal evaluator semantics

- `available(capability)` is true when at least one provider row joins to a
  packet whose status is `completed-retained`.
- A requirement is satisfied when its capability is available. Multiple
  providers are OR alternatives.
- A packet's requirements are satisfied only when every requires edge is
  satisfied (AND). An empty requires set is vacuously satisfied.
- The actionable frontier contains active packets with `execution_capable === true`
  and all nominal requirements satisfied. Missing/false is fail-closed; terminal
  or reference packets are never actionable frontier entries.
- A required capability with no provider is an orphan and renders as stable
  `fog:<capability>` outside the actionable frontier.
- Cycle analysis uses consumer→candidate-provider packet edges for currently
  unavailable requirements. Stable SCC output sorts packet IDs.
- Evidence-backed readiness is not inferred from manifest status. A later
  evidence projection is computed beside nominal readiness, as SPEC requires.

## Pure-TypeScript reference evaluator fixtures

Each fixture is inserted into SQLite in forward, reverse, and seeded-shuffle
order. SQL and the pure TS evaluator must produce byte-equivalent sorted JSON.

1. **AND gate:** completed `A` provides `cap/a`; active `B` provides `cap/b`;
   active `C` requires both. `C` stays blocked until `B` becomes
   `completed-retained`; then `C` enters the nominal frontier.
2. **Orphan:** active `C` requires `cap/missing` and no packet provides it.
   Catalog has one orphan, graph has `fog:cap/missing`, and `C` is not frontier.
3. **Cycle:** active `A` provides `cap/a` and requires `cap/b`; active `B`
   provides `cap/b` and requires `cap/a`. Both are one sorted SCC, neither is
   nominally ready, and shortest-unlock reports the cycle rather than a path.
4. **Completed provider:** completed-retained `A` provides `cap/a`; active `B`
   requires it. `cap/a` is nominally available and `B` is ready. `A` is an
   achievement/relic candidate, not a frontier item.
5. **Multi-provider OR control:** active `A1` and completed `A2` both provide
   `cap/a`; `B` requires it. Collision is visible, but `A2` satisfies `B`.
6. **Duplicate/order control:** repeated and permuted capability entries produce
   the same four normalized row sets and one duplicate-declaration finding.

The first four are the required SPEC differential fixtures; multi-provider OR,
collisions, fog nodes, and status controls are reinforced by
`goals/knowledge-surface-automation/research/prior-ritual-lessons.md:217-226`.

## Consumer boundaries

- `beep goals next`, `explain`, catalog JSON, INDEX Mermaid, and the later HTML
  dashboard consume the same compiled projection and query result schemas.
- `PortfolioIndex` should be extended to accept projection output rather than
  rereading manifests independently for Mermaid. Existing Markdown table fields
  remain parity-tested during that later slice.
- `beep goals doctor` consumes decoded arrays for naming, duplicate, collision,
  and orphan findings only after those policies are ratified.
- `scout --bootstrap` passes a typed capability value into the shared bootstrap
  compiler; it never writes an unvalidated free-form string directly.
- Explorations do not become packet rows; graduation provenance remains outside
  this four-table graph, per SPEC.

## Open questions for the P2 grill

The schema owner, v2 token, default behavior, and four normalized row families
above are decided. The following remain open:

1. Exact capability namespace/name grammar: lowercase only, allowed punctuation,
   exactly two segments versus hierarchical names, maximum length, and Unicode.
2. Granularity: durable product ability versus implementation/task milestone;
   provide concrete good/bad examples before ratifying the regex.
3. Alias, rename, deprecation, and split/merge rules. Are aliases forbidden in
   v1 and handled only by governed manifest edits, or explicitly modeled?
4. Collision policy: always informational catalog data, warning above one active
   provider, or blocking only for mutually exclusive ownership namespaces?
5. Duplicate declaration severity: decode-time uniqueness, doctor blocking
   finding, or advisory while projection deduplicates.
6. Self-requirements and self-provision: immediate schema/doctor rejection or a
   one-node cycle reported by the evaluator?
7. Does `executionCapable: false` exclude only frontier selection or also
   shortest-unlock routing through that packet?
8. How are superseded providers redirected before typed substitution routes are
   implemented, and can `reference` packets ever satisfy nominal readiness?
9. Which evidence receipts and Yeet lanes upgrade nominal availability to
   evidence-backed availability? This is the separately ratified D↔C grill item,
   not part of the manifest schema slice.

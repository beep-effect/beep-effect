# goals-packet-migration-kind

P2 after Benjamin's2026-09-22 operation-constraint ruling, source
`0be1f13d62fa00cb65e34ff69ec99043380f8d81`. The prior hold remains historical.
Proposed status designed; independent P3 and implementation remain pending.

## Current shape

GoalPacketMigration at packages/tooling/tool/cli/src/commands/Goals/Migration.ts
343-355 exports slug:String, edits:Array(String), optional manifestText/readmeText/
parked:String and optional isBackfill:Boolean. None of these optional keys has a
default. The producer emits parked366, backfill384 and mechanical602 plans.
SetStatus109 handles parked before writes;116-118 distinguishes backfill only
when its Boolean is true, treating false and absence equivalently.

The new DECISIONS.md ruling establishes the missing contract: parked forbids
backfill and both output texts; backfill requires manifest, with optional README.
False remains a supported non-backfill representation. All String/Array payloads,
including empty values, remain valid. These are authoritative owner constraints,
not conclusions drawn from the six producer-observed tuples.

## Cardinality gap

The complete raw presence domain is3×2×2×2=24: isBackfill absent/false/true,
parked absent/present, manifest absent/present, README absent/present.

- Parked: neither output, flag absent or false:2 legal strata.
- Not parked, not backfill: four output combinations times absent/false:8.
- Not parked, backfill: manifest present, README absent or present:2.

Thus **24 representable /12 legal**. Present empty text is present, including an
empty parking question, manifest or README; it is never tested by truthiness.
Edits remains an arbitrary ordered array, including empty arrays and strings in
all cases. Do not add an emptiness axis or require a changed-text description.
Slug remains the full String domain. The old24/6 figure is superseded.

## Target schema

Create a private LiteralKit for six operation cases: parked, backfill, unchanged,
manifest-change, readme-change, manifest-and-readme-change. Use annotated named
case classes and schema-derived tagged-union helpers; annotate before toTaggedUnion
so generated statics remain. Every case retains slug:String and edits:Array(String).
Parked owns question:String, no output. Backfill owns manifestText:String and
readmeText:Option<String>. Four mechanical cases own exactly their corresponding
output strings, with none in unchanged. No case stores isBackfill or parked as an
independent optional payload.

Preserve explicitfalse versus omission as representation metadata where that
distinction exists: a private two-value LiteralKit, omitted|explicit-false, is
required on parked and mechanical cases. It is independent within these
non-backfill cases and absent from backfill. It is not a Boolean or a second
operation tag, and must not control execution/counters. Producers choose omitted;
boundary decoding of false chooses explicit-false. This retains all12 legal raw
strata without collapsing the user's supported alias or adding invalid states.
Do not expose redundant Boolean getters or manufacture a third flag state.

Keep a private exact flat raw schema with the current optional-key semantics and
public GoalPacketMigration compatibility codec to the canonical cases. Validate
the ruling before projection: reject parked+true, parked+either output, and
backfill without manifest, without dropping fields. Encoding reconstructs the
flat fields and uses metadata to retain false versus omission. Present empty
strings survive. Preserve schema-derived Type/Encoded and migrate constructors
atomically; no second public flat decoded alias. Local Effect decodeTo maps
source Type to target Encoded; target canonical type-side schemas when returning
constructed case instances. Do not pass transformations to Class.extend or assert
unsupported codec constructor statics. Prove construction/encoding API at apply.

## Migration inventory

Paths in this section are relative to packages/tooling/tool/cli/.

- Migration.ts343-355 and example336: replace flat decoded model, preserve full
  slug/edits domains and public schema/type/encoding surface.
- parkedPlan365-366: construct parked with omitted metadata and exact question;
  preserve empty edits from this producer without imposing it on public input.
- planBackfill378-391: construct backfill with optional README None, exact manifest
  bytes and ordered description. Public backfill+Some(README) remains supported.
- planGoalPacketMigration547-608: preserve missing-manifest/backfill, parse failure,
  missing status and unmapped status ordering, then status/supersession/phase/
  mission edits and README rewrite ordering. Select mechanical case by undefined
  presence, not string truthiness; preserve bytes and exact edits.
- SetStatus.ts63-82: log every edit in order, then manifest mkdir/write, then
  README write when enabled. Matching backfill must honor its optional README.
- SetStatus104-122: parked logs only PARKED and increments parked, ignoring its
  supported edits payload as before; nonparked logs edits and writes as above.
  Backfill contributes backfills1 and optional changedReadmes1, never changedManifests.
  Mechanical outputs contribute the respective counters; unchanged still logs
  its arbitrary edits but contributes zero. Representation metadata never changes
  those counts. Retain sequential packet iteration and dry-run summary wording.
- Goals/index.ts98 exports Migration.ts; documented module import and test
  planner helpers remain. No new service or raw compatibility overload.
- test/goals-command.test.ts108 onward retains planner and command fixtures;
  add direct public schema/constructor cases for the broader ruling-supported
  combinations that producer fixtures did not cover. Recheck callers at apply.

## Guard-deletion accounting

Remove four independent decoded optionals and repeated kind/output reconstruction.
Match operation cases for parked handling, writes and counters. Optional README
inside backfill remains an independent payload choice, not an invalidity guard.
Representation metadata only reconstructs encoded false/omission; it is not used
for operation logic. No runtime coherence guard is claimed deleted from current
source, which previously accepted all24 strata. One raw decoding wall enforces
the new explicit constraints; retain request validators, parsing, filesystem
errors, dry-run write suppression and their order.

## Encoded-side impact

Internal planner owner remains Tier1, but its public schema has an encoded
surface. Preserve every legitimate flat key, optional omission, explicitfalse,
full text and edits array exactly; avoid a new persisted/tagged wire claim.
Backward raw decoding accepts12 strata and rejects12 contradictory strata per
the ruling. No false-to-omitted normalization, empty-to-absent conversion or
nonempty checks. Preserve field order where observable through existing encoding;
compare complete encoded objects/serialization in tests. Assess release policy
when implementing the public decoded API migration.

## Test impact

Enumerate all24 raw presence tuples with representative empty and nonempty
payloads. Accept and round-trip12, reject12 without data loss. Compare false and
omitted aliases in every non-backfill operation; exercise backfill with and
without README, including empty strings, parked with nonempty arbitrary edits,
and unchanged with arbitrary edits. Confirm those edits still follow existing
logging/parked short-circuit behavior, not invented payload constraints.

Retain JSONC comments/formatting, P0 backfill bytes, malformed/unmapped questions,
status/phase/supersession changes, README rewrite, idempotence, dry-run counters
and manifest-before-README write order. Run focused goals tests and
`bun run beep quality package-verify @beep/repo-cli` after implementation, then
campaign/Yeet gates. This audit only enumerates finite states and inspects saved
source; no actual migration or runtime codec proof is claimed.

## Risk

The main risk is reinstating the producer-only24/6 restriction despite the user
ruling. Alias metadata must preserve representation without governing semantics;
empty payloads must survive. Keep this owner in the ordered Tier1 tooling batch
and coordinate SetStatus edits with packet transition owners, without deleting
another owner's guards or importing its review credit. Independent P3 must assess
the compatibility construction and all12 accepted strata before implementation.

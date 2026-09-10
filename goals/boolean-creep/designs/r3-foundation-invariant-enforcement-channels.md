# Instance

- id: `r3-foundation-invariant-enforcement-channels`
- file:line: `packages/foundation/modeling/schema/src/Conformance/Conformance.invariant.schema.ts:276`
- symbol: `hasCoherentEnforcement`
- members: `typeLevel`, `runtime`, `staticAnalysis`, `documented`,
  `notEnforced`, `mechanicallyEnforced`, `explicitGap`,
  `gapDoesNotContradictMechanicalEvidence`
- evidence: E4 at `Conformance.invariant.schema.ts:281-283` — the final three
  locals are exact Boolean functions of the first five channel-presence
  observations.

Audited at checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
against main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
Replacement P3 review remains pending.

# Current shape and cardinality

`InvariantDescriptorFields.enforcement` is a nonempty array of the existing
six-case `InvariantEnforcement` tagged schema. `hasCoherentEnforcement` scans
that array five times for type-level, runtime, static-analysis, documented, and
not-enforced evidence. It then derives mechanical evidence as the OR of the
first three, explicit gap evidence as the OR of the last two, and the absence
of contradiction as the NAND of not-enforced and mechanical evidence.

The eight locals have 256 representable Boolean tuples and 32 computed tuples.
All 32 assignments of the first five flags are constructible. In particular,
the all-false assignment is produced by a nonempty array containing only the
sixth `test` enforcement case, which this coherence predicate deliberately does
not treat as deciding evidence. The three derived locals are fixed for each of
those 32 assignments.

This cardinality describes observations inside the validation function,
including inputs the function rejects. It is distinct from post-filter
`InvariantDescriptor` values. Of the 32 source vectors, 17 are accepted for at
least one decidability and 15 reject every decidability. Across five
decidability values, 46 of the 160 vector/decidability pairs pass the coherence
filter.

# Cardinality gap

The expanded eight-local record qualifies at 256/32 because three members are
derived aliases. The former D1 finding remains historically correct for the
first five members alone: enforcement-channel presence is independent and must
not be modeled as five exclusive cases. The replacement models the predicate's
five distinct observable decidability outcomes, not the 32 source-channel
combinations.

# Target schema

Add one private annotated LiteralKit beside the existing enforcement and
decidability owners:

```ts
const InvariantEnforcementDisposition = LiteralKit([
  "rejectsAll",
  "typeLevelOnly",
  "localMechanical",
  "typeAndLocal",
  "explicitGap",
]).pipe(
  $I.annoteSchema("InvariantEnforcementDisposition", {
    description: "Decidability acceptance class derived from invariant enforcement evidence.",
  })
);
type InvariantEnforcementDisposition = typeof InvariantEnforcementDisposition.Type;
```

Derive exactly one disposition from the typed nonempty
`ReadonlyArray<InvariantEnforcement>` without converting the tagged evidence
into a stored bit object. Preserve `test` evidence as neutral when another
deciding channel exists. A test-only array resolves to `rejectsAll`, as does a
not-enforced plus mechanical contradiction; the current validator gives both
the same failure result and message.

The classification and current acceptance matrix are:

| Disposition | Source-vector count | Accepted decidability values |
| --- | ---: | --- |
| `rejectsAll` | 15 | none; 14 contradictory vectors plus the test-only vector |
| `typeLevelOnly` | 1 | `typeLevel` |
| `localMechanical` | 6 | `localRuntime`, `contextualRuntime` |
| `typeAndLocal` | 7 | `typeLevel`, `localRuntime`, `contextualRuntime` |
| `explicitGap` | 3 | `localRuntime`, `contextualRuntime`, `externalAuthority`, `undecidable` |

`localMechanical` means runtime or static-analysis evidence without type-level
evidence; documented evidence may coexist. `typeAndLocal` means type-level plus
runtime, static-analysis, or documented evidence. `explicitGap` has documented
or not-enforced evidence and no mechanical evidence. The contradiction branch
must run before the other classifications.

Match this disposition with the existing `InvariantDecidability` LiteralKit to
produce the same Boolean result. Do not add a disposition field to
`InvariantDescriptor`, export a second enforcement vocabulary, enumerate 32
combination names, or narrow the existing enforcement array.

# Migration inventory

- `Conformance.invariant.schema.ts:99-118` — reuse `InvariantDecidability` and
  its existing literal guards/matcher; its values and encoding do not change.
- `Conformance.invariant.schema.ts:120-257` — reuse the six-case
  `InvariantEnforcement` schema, cases, guards, equivalence, and payload
  classes. Define the private disposition kit nearby without changing the
  public owner.
- `Conformance.invariant.schema.ts:259-273` — retain the exact descriptor
  fields, nonempty enforcement array, nonempty references, and empty-array
  default for `testIds`. Do not store the derived disposition.
- `Conformance.invariant.schema.ts:275-295` — replace all eight sibling locals
  and the nested Boolean/decidability formula with one typed-array-to-disposition
  classifier and one exhaustive disposition/decidability match.
- `Conformance.invariant.schema.ts:297-312` — preserve filter order: unique
  `testIds`, unique references, unique exact enforcement records, then
  coherence. Retain the filter identifier, title, description, and message.
- `Conformance.invariant.schema.ts:314-356` and `Conformance/index.ts:39-49` —
  keep `InvariantDescriptor`, `InvariantEnforcement`, `Invariant`, and
  `Enforcement` public schemas/types/barrels unchanged.
- `Conformance.annotations.ts:18-281` — keep annotation construction,
  `makeAnnotationResult`, throwing `makeAnnotation`, schema attachment, and
  encoded annotation inputs unchanged.
- HTML, Markdown, Lexical, and Pandoc conformance registries — retain every
  encoded enforcement array, its order, payloads, and `satisfies
  Conformance.Annotation.Encoded` boundary.
- `ConformanceLedger.schema.ts:162-218` and
  `ConformanceLedger.test-kit.ts:162-291` — preserve JSON decoding and exact
  annotation/invariant/enforcement-array parity.
- `ConformanceLedger.evidence.ts:17-145` — preserve direct runtime-enforcement
  filtering used to verify cited tests; downstream consumers continue reading
  the original tagged arrays.

# Guard-deletion accounting

Delete the five channel-presence Boolean locals, the three aliases derived from
them, the standalone NAND guard, and the per-decidability Boolean expression.
The replacement classifier returns one five-value disposition directly from
the existing tagged array, and one exhaustive match owns the acceptance matrix.

Keep schema-level nonempty-array validation, exact deduplication checks, and
the coherence filter itself. They enforce separate input and value invariants.
Do not flatten `InvariantEnforcement` back into a new record of flags inside or
outside the classifier.

# Encoded-side impact

None. `InvariantEnforcementDisposition` is transient internal validation state.
`InvariantDescriptor.Encoded`, all six enforcement tags and payload fields,
array order, exact-duplicate behavior, `testIds` defaulting, annotation
encoding, conformance-ledger JSON, equality checks, and public barrels remain
unchanged. Decode acceptance and the existing
`Expected unique testIds, references, and enforcement evidence coherent with decidability`
message remain exact.

# Test impact

Retain `Conformance.test.ts:172-295` invalid and valid descriptor examples,
including local-runtime test-only rejection, external/undecidable mechanical
rejection, type-level requirements, explicit-gap acceptance, duplicate
enforcement rejection, and multiple distinct runtime records. Retain the
standalone six-case enforcement encode/decode arbitrary at lines 391-399.

Add a characterization table over all 32 channel-presence vectors and all five
decidability values. Use one `test` record to realize the all-false vector and
unique payloads when a vector needs multiple enforcement records. Assert the
five disposition counts `15,1,6,7,3`, the accepted vector count 17, the accepted
pair count 46, and exact equivalence with the current predicate matrix. Add
focused rows proving test evidence is neutral beside deciding evidence and
test-only remains rejected without changing its encoded payload.

Retain annotation and conformance-ledger round-trip/parity tests so the helper
cannot alter public encoding or downstream evidence inspection.

# Risk and sequencing

Tier 1 internal derived-state cleanup in `@beep/schema`. The central risk is
mistaking the five independent channel observations for exclusive states or
forgetting that nonempty test-only enforcement realizes the all-false vector.
Land only after replacement P3 confirms the exhaustive matrix and package
verification covers direct schema, annotation, and ledger consumers.

# Qualification recommendation

Promote the stable `r3-foundation-invariant-enforcement-channels` record using
the expanded eight-member evidence and 256/32 cardinality. Preserve the former
D1 note as discovery history: it correctly rejected an exclusive union over
the first five independent flags. Supersede the raw round-26 ID with this
stable canonical ID. Record storage as `derived`, exposure as `internal`,
target shape as `literalkit`, and tier as 1.

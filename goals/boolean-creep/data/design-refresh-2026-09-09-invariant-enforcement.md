# Invariant enforcement disposition design refresh — 2026-09-09

## Scope and source

This audit covers the stable
`r3-foundation-invariant-enforcement-channels` record at
`packages/foundation/modeling/schema/src/Conformance/Conformance.invariant.schema.ts:276-295`.
The source checkout was `7440cb8c4302ce64b87860069a464bafbf65f576`; the
packages/apps main corpus was
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

Only the new design and this handoff were written. Product source, tests,
inventory, lifecycle status, dependencies, generated files, and git refs were
not changed. Formal replacement P3 remains pending.

## Decisive cardinality evidence

The round-26 candidate expands five channel-presence locals with three exact
aliases:

- `mechanicallyEnforced = typeLevel || runtime || staticAnalysis`
- `explicitGap = documented || notEnforced`
- `gapDoesNotContradictMechanicalEvidence = !notEnforced || !mechanicallyEnforced`

This produces 32 legal eight-local tuples out of 256 representable tuples. The
nonempty enforcement-array constraint does not reduce the count to 31 because
`InvariantEnforcement` also has a `test` case. A nonempty test-only array makes
all five observed channel flags false. Every other five-bit assignment can be
constructed with one uniquely populated record of each selected tag; the exact
dedupe rule does not prevent different tags or distinct same-tag payloads.

The 256/32 cardinality concerns computed validation-state observations before
the coherence result is applied. It must include inputs legitimately rejected
by the current filter. Post-filter descriptor acceptance is a separate
projection:

| Derived disposition | Source vectors | Accepted decidability values |
| --- | ---: | --- |
| rejects all | 15 | none |
| type level only | 1 | type level |
| local mechanical | 6 | local and contextual runtime |
| type plus local evidence | 7 | type level, local runtime, contextual runtime |
| explicit gap without mechanical evidence | 3 | local runtime, contextual runtime, external authority, undecidable |

The rejects-all class contains 14 vectors with not-enforced plus mechanical
evidence and one test-only vector with no recognized deciding channel. Thus 17
of 32 vectors are accepted for at least one decidability, and 46 of the 160
vector/decidability pairs pass.

## Qualification and D1 supersession

The original D1 conclusion remains correct for its original five-member
surface: those channel-presence observations are independent and cannot become
five mutually exclusive variants. The expanded record qualifies because its
three additional locals are deterministic aliases. The useful replacement is
an observational quotient of the complete coherence predicate, not a union of
the source channels.

The stable ID should be promoted with members
`typeLevel,runtime,staticAnalysis,documented,notEnforced,mechanicallyEnforced,explicitGap,gapDoesNotContradictMechanicalEvidence`,
cardinality 256/32, `storage=derived`, `exposure=internal`,
`targetShape=literalkit`, and Tier 1. The raw round-26 ID should be superseded by
the stable record. Keep the former D1 rationale as historical discovery
evidence.

## Representation and behavior

The design adds one private five-value `InvariantEnforcementDisposition`
LiteralKit derived from the existing typed nonempty enforcement array:
`rejectsAll`, `typeLevelOnly`, `localMechanical`, `typeAndLocal`, and
`explicitGap`. The neutral `rejectsAll` name is required because the case
includes both contradictions and test-only evidence. Calling it `conflicting`
would misrepresent a legitimate encoded test-only array.

The classifier must consume `InvariantEnforcement` cases directly. It must not
store a disposition on `InvariantDescriptor`, create an enforcement bit
record, duplicate `InvariantDecidability`, or enumerate 32 source combinations.
One exhaustive match between the disposition and existing decidability owner
reproduces the current Boolean matrix.

All eight sibling locals are then removable. The nonempty array check, exact
dedupe checks, and coherence filter remain because they enforce distinct
invariants. The descriptor consistency filter retains its current evaluation
order and exact identifier, title, description, and message.

## Encoded and consumer audit

`InvariantDescriptorFields` at lines 259-273 owns the public encoded boundary:
nonempty `InvariantEnforcement` and `SpecificationReference` arrays plus the
existing empty-array default for `testIds`. The six enforcement classes and
their payload schemas at lines 120-257 remain canonical. The transient
disposition is never encoded or exported.

`Conformance.annotations.ts` decodes unknown annotations in
`makeAnnotationResult`, throws through `makeAnnotation`, and validates values
before schema attachment. HTML, Markdown, Lexical, and Pandoc registries author
encoded arrays against `Conformance.Annotation.Encoded`. The Conformance barrel
exports `InvariantDescriptor`/`InvariantEnforcement` and their concise
`Invariant`/`Enforcement` aliases.

The test-kit Conformance ledger decodes invariant and coverage JSON through the
same schemas, compares enforcement arrays exactly for annotation parity, and
directly filters runtime evidence when checking validator citations. Therefore
the migration must preserve all enforcement tags, payloads, array order,
defaults, exact equivalence, JSON bytes, and reader behavior.

## Test characterization

Existing `Conformance.test.ts:172-295` rows cover the main accepted/rejected
matrix, test-only local rejection, exact duplicates, distinct runtime records,
and explicit gaps. Its standalone `InvariantEnforcement` arbitrary at lines
391-399 proves all enforcement variants retain encode/decode behavior.

Implementation should add an exhaustive 32-by-5 characterization using
representative unique evidence. It should assert disposition counts
15/1/6/7/3, 17 vectors accepted somewhere, 46 accepted pairs, test-only
rejection, test neutrality beside deciding evidence, and exact agreement with
the current predicate. Existing annotation and ledger parity tests remain the
encoded compatibility proof.

## Validation

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed:
`design coverage OK: 149 qualified ids`.

Scoped `git diff --check` passed for the design and this handoff.

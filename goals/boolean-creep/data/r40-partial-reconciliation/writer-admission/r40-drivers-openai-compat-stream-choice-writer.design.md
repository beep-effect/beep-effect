# Proposed companion design: stream-choice writer

Private admission input for `r40-drivers-openai-compat-stream-choice-writer`.
Parent reconciliation and independent review are required before canonical
admission. This draft grants no P3, GATE 2, implementation, or dry-round credit.

## Exact source and existing design

The R40 source is `e624ab45f8ffc5e62ee8be19a94b7e3c1d40d363`, with recorded
main `5bb7754cce8ea58ee540c08d78a4f3bf2e653cfc`. The runtime source is byte-identical
at `58c4c805a2f80998ef5d3f752ba7dce12879ca80`; no claim is made that all live
packet prose remains frozen. `bindings.json` records exact input/output hashes.

This companion depends on `goals/boolean-creep/designs/drivers-stream-state.md`.
Its historical source and reviewed inventory status do not constitute fresh P3.
The existing proposal owns the one private `StreamTextPhase` LiteralKit and the
stored `StreamState` migration. Reuse that domain; create no second text or
finish domain, six/nine-case enum, public schema, or duplicate state record.

## Complete owner and cardinality

The owner is the generator body of `makeStreamChoiceParts`,
`OpenAiCompatLanguageModel.service.ts:826-925`. Its four direct Boolean locals
are `shouldFinish:896`, `textStarted:901`, `textEnded:907`, and `finished:913`.
The inner choice callback's `hasFinish:874` is a different lexical scope.
The incoming `state` object is the existing `StreamState` class owner. The
local usage/finishReason Options and arrays/tool-call records are payloads;
none supplies Boolean recall. Four actual Boolean locals meet the recall net.

There are 16 representable Boolean tuples and exactly 9 reachable tuples:

- `textEnded` implies `textStarted` (E4, emission at888-890 and accumulators
  901-912, starting from `StreamState.initial` at240-247).
- `shouldFinish` implies `finished` (E4, exact assignment at913).

Each pair has three permitted combinations. The finite receipt gives a valid
chunk trace for every cross-product, so the upper bound of nine is attained.
Seven tuples are impossible: four violating each implication with one overlap.
This is the complete four-Boolean projection of reachable successful writer
steps, not a finite count of all payload values or a provider-order restriction.
Thrown/failed choice effects do not produce a next-state return and therefore
do not add completed writer tuples; preserve their existing effects and errors.

`../drivers-n-r-stream-writer-finite.json` is the immutable source-derived
abstract proof. Its hash is bound in `bindings.json`. Its trace notation uses
`text=true` for nonempty content such as "x", `finish=true` for a present reason
such as "stop", and `usage=true` for a present usage object. False means absence
for that chunk, not removal of previously retained usage/reason. Chunk choices
are ordered and may be empty or contain multiple choices. Source schemas
`OpenAiCompat.models.ts:987-1005,1119-1137,1167-1191` admit these constructions;
this draft has not executed decoder or service tests.

In particular, the `(true,true,false,true)` witness uses one chunk containing a
finish-only choice followed by a text-only choice, with usage present. Every
choice reads the same incoming idle text state; the first cannot emit text-end,
while the second emits text-start. Do not replace this witness with assumptions
about typical provider ordering.

## Scope separation and single migration

`drivers-stream-state` describes the stored class's three Boolean fields and
8/6 gap. This proposed record describes the distinct four-local writer scope
and 16/9 gap. The code paths overlap, but the owners and member sets differ.

Land their implementation atomically. Implement the text-phase transition once,
using the existing design; cite that same migration as shared coverage in both
records and count its guard deletions only once. The additional work uniquely
owned here is removing `const finished = state.finished || shouldFinish` and
its shorthand use in the returned object. The existing stored `finished`
Boolean remains independent of text phase. The `finished`/`finishReason` D1
record remains valid and unchanged.

## Target and migration inventory

1. Keep the existing design's `StreamTextPhase` and stored class migration at
   221-248, `finishStreamParts` at818-824, and phase-sensitive reads at846 and888.
2. Preserve the `shouldFinish` formula at896-897 exactly. It controls whether
   to append the finish part at899; retaining this single local avoids duplicate
   computation and does not create a parallel writer-local finish state.
3. Preserve ordered choice processing at835-895, flattening at898, finish-part
   append at899, and `allParts` ordering at900. Derive the one next text phase
   from this same `allParts` and the incoming phase, once after all choices.
4. Replace the accumulators at901-912 with the single phase transition owned by
   the existing design. Do not introduce sibling `started`/`ended` aliases.
5. Delete local `finished` at913. At the existing return property at918 use
   `finished: state.finished || shouldFinish`. Return `textPhase` in place of
   the two text flags. Keep activeToolCalls, finishReason, usage and allParts
   references and payloads unchanged.
6. Preserve `Stream.mapAccumEffect` and `{ onHalt: finishStreamParts }` at932-937.
   No early termination, extra Effect mapping, state mutation, or error recovery
   belongs in this cleanup.

Projection into the already existing stored field is not a replacement local
alias: the writer ends with one Boolean local (`shouldFinish`) and one literal
text phase; the returned stored owner has one independent Boolean plus that
phase. No imported/persisted/wire codec changes are needed.

## Guard-deletion accounting

The existing design receives the shared credit for deleting the parallel text
accumulators and their phase/coherence reads. This companion adds the deletion
of one derived finish alias and its shorthand return dependency at913/918.
The exact Boolean expression remains at the returned stored-owner boundary;
there is no claim to remove a guard or operation that remains necessary.

Retain the independent shouldFinish policy, usage/reason presence tests,
text-part predicates, and nested per-choice hasFinish. Do not add guards
validating the old four-Boolean tuple or a schema encoding nine combinations.

## Preservation requirements and encoded impact

Internal derived-state cleanup, Tier 1. Preserve all public callback inputs,
provider response/chunk schemas and wire JSON. Arbitrary valid late, duplicate,
empty-choice and multi-choice chunks remain supported. Choices continue reading
one common incoming text state; mutable tool-call accumulation and finishReason
continue advancing choice by choice. Text phase is updated only after flattening.

The inline finish read treats both open and closed as previously started,
preserving repeated text-end output on later finish-bearing choices. The onHalt
helper alone emits a synthetic text-end only for an open span and only when
finished is false. Do not suppress late text or process no further chunks after
finished; current behavior intentionally continues. Preserve stored finish
latching, usage selection, finish reason, full tool argument/id/name payloads,
part IDs and order, all usage detail payloads, and existing error mapping.

The direct finished expression reads the same immutable input state and local
shouldFinish at the same synchronous return construction; no Effect boundary
moves. Retain failure/interruption propagation and finalizer/onHalt placement.

## Required implementation verification

After admission and independent P3, extend the existing behavioral language-model
suite with all nine finite witness sequences. Compare output order and full
payloads against current-source characterization; do not expose private state
just for tests or assert only part counts. Also cover repeated finish chunks,
late text after completion, empty/multiple choices, absent/present and retained
usage, delayed reason/usage, tool-call accumulation/errors, provider failure and
interruption with existing onHalt behavior. The existing design's text-phase
fixtures are shared coverage, not a second parallel test implementation.

Run focused openai-compat tests and the full touched-package verification during
implementation. This private proposal runs only inventory shape validation and
proof-receipt consistency checks; those do not establish runtime equivalence.

## Review and admission boundary

Parent review must confirm distinct-owner deduplication, the 16/9 closure,
schema-valid witness interpretation, and coordinated migration with the existing
text-phase design. Independent review must check full payload/error/ordering
preservation. Only then may the parent admit the row and design through the
campaign's normal gates. No canonical file has been changed by this proposal.

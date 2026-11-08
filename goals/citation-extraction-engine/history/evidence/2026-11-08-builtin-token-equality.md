# Builtin retained token equality from original dataclass behavior

The owned native token service previously supported construction, snapshots,
source-compatible merges and nominative choices but lacked builtin equality.
The new equal method follows eyecite's actual generated dataclass comparison
fields, independently captured through dataclasses.fields and source operators.
All nine builtin classes compare exact class, data and positions. Groups are
excluded. CitationToken additionally compares ordered exact edition occurrences,
ordered variation occurrences and the short flag. Plain-token extra attributes
remain outside their generated comparison fields. Equality therefore deliberately
differs from merge compatibility, which compares groups and ignores different data.

The implementation reuses the existing token owner, Effect HashMap identities,
Semaphore serialization and captured timing. Native text equality uses the existing
schema equivalence over already validated canonical storage, preserving literal
surrogate words instead of collapsing them through a JS projection. Edition tuple
comparison reuses the captured immutable equality classes and Effect.findFirst over
ordered paired occurrences. It does not sort, deduplicate, compare only hashes or
invent a collection/equality runtime. Prefix comparison precedes the tuple-length
result, following the pinned Python behavior. Equality reads current owned state
under the same permit as merge, and returns closed failures for unknown handles.
No source anchors, semantic Citation codec, persisted identity or client API is added.

The independent producer requires the clean exact oracle commit/tree, CPython
3.11.15 and eyecite 2.7.6. It reconstructs the existing fourteen source edition
values, verifies their equality facts against the prior frozen profile and uses
actual source operators for expected values. The 1,454 comparisons cover all nine
classes, cross-class pairs, null/empty/native control and astral/surrogate text,
positions, ignored groups, extra fields, order, duplicate lengths, all 196 edition
pairs in each citation edition field and equal-but-distinct edition objects.
Three histories compare before and after actual merge: nonempty text merges,
empty text refuses and None raises without granting a false equality. Histories
contain one edition equality class, so their boolean outcomes do not claim a new
process hash or depend on arbitrary set iteration order. Frozen hash facts remain
the earlier explicit runtime profile, not a universal hash(None) assertion.

All eight focused tests pass, including both new equality tests and the existing
constructor/merge/edition controls. Target comparisons run in both directions.
The three histories retain actual merge return identity/refusal/failure, current
post-merge equality and unknown-handle rejection. Existing native snapshot ownership,
aggregate capacity, captured Clock/deadline, collision and source set/nominative
controls remain passing. Server lint/types and repository-wide lint:oxlint pass.
Fallow new-only passes with zero introduced findings. The corpus reproduces byte
for byte, and portable loading authenticates corpus, frozen profile and actual
producer bytes. Only this immutable corpus is excluded from formatting; native
hex fields retain a narrow typo exception while provenance and prose stay checked.

Corpus SHA-256: 44e0f3ad528c7d939cf48d388f9fd3a6aa4ac4b8b359d789a40a480922414eaa.
Edition profile SHA-256: b42419aa8c06a5ccb3a15ea6e46650219e1f50445dbd827224b4d771e9f2932c.

Command from packages/law-practice/server:
bunx --bun vitest run test/CitationTokenEquality.test.ts test/CitationTokenObjects.test.ts test/CitationTokenEditions.test.ts --reporter=json --outputFile=../../../.beep/token-equality-results.json.

This implements builtin value equality over the owned supported fields. Arbitrary
subclasses, external field/descriptor mutation, dynamic edition comparisons, token
hashes and general inherited UserString protocols remain open. No original canonical
assertion, complete source capability, representation law or fidelity question is
promoted from this finite corpus. Totals remain 182 complete canonical events,
zero nonterminal bindings and 15,316 rows without completion proof. Remaining source
workflows/backend protocols, exhaustive source/donor reconciliation, native identity
and deployment attestation, whole-engine safety/scaling and lifecycle acceptance
remain required. Exact-head hosted acceptance is pending.

Main is integrated through 9140b1f5c4d, including the main-owned 120-minute hosted
integration lane budget and schema-arbitrary test adjustment. These do not alter
this primitive's production limits or individual tests. Main's retained decision
also identifies InputDocument reservation-assertion failures and the full Bun diff
corpus watchdog; those remain pending repairs in this goal and are not reported as
passing by this token receipt. Token equality is published without waiting for the
unrelated full hosted queue or claiming those failures resolved.

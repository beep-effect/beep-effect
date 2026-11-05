# Source candidate-set construction and default callback uniqueness

Date: 2026-10-29. Internal add-only candidate-set and registered callback proof.
This supplies the candidate-set work left open by the host-resource protocol
checkpoint. General native-value normalization, reentrant comparison,
unconditional Layer cutover and final document projection remain open.

## Pinned implementation and observations

RuntimeSet adapts CPython 3.11.15 `Objects/setobject.c` insertion,
linear/perturbation probing, cached-hash growth and bucket iteration. The source
SHA-256 is `01462829ff1e731582656adf49ef1d662a5f48002ac49114acdae1ea3674ce57`.
The existing complete CPython license remains reproduced in THIRD_PARTY_NOTICES;
its affected-material description now includes this helper. The TypeScript
adaptation uses schema-owned numeric identity/hash snapshots, captured Effect
comparison/work services, bounded storage/probes and typed sanitized errors.
It contains no Python runtime dependency.

The maintainer producer checks clean eyecite commit/tree, CPython 3.11.15,
64-bit hashes, seed zero and the frozen dependency versions. The artifact binds
the producer, eyecite source/license and CPython source/license hashes.
`runtime-set.json` has formatted SHA-256
`58ca087e488c94d2db5b6dfef2dfe1d0280f18228b6088a61b14b227d536adfa`.
Fresh replay reproduces the entire parsed artifact; eight corruption controls
reject omitted histories, altered source hashes, lost repeated identities,
missing comparisons, swallowed exceptions, extra callback hooks and false groups.

Eight histories cover seventy-one operations: changed hashes in the same bucket,
distinct equal objects, thirty colliding objects through growth, cached insertion
hashes during rebuild, false equality with pointer identity, signed/wide hashes,
comparison exceptions and live equality after external hash mutation. The target
checks every comparison call and bucket-iteration object identity after every
operation. The collision history alone observes 543 comparison calls.

A set checks stored hash equality before pointer identity. One object whose
current hash changes from 5 to 13 can therefore occupy two entries in the same
initial bucket probe sequence. The dictionary helper deliberately checks pointer
identity earlier. Sharing one table implementation would erase this distinction.
Growing a set reinserts cached keys in old bucket order with no equality calls;
the target preserves that order and the source's ten-slot linear probe window.

## Callback integration

Registered callback owners now expose uniqueResourceCount. Each call builds a
fresh private candidate set, hashes each resource at its source construction
point and performs captured directional comparisons. The legacy adapter path
remains during migration; it is not promoted to mutable host-key parity.
The old equality-key helper remains for existing internal controls, but the
registered default callbacks no longer use hash-string deduplication.

Default short-form resolution now returns immediately when its first candidate
set has one element. On ambiguity, it performs a second set construction only
when a nonempty antecedent triggers party filtering. The former unconditional
second uniqueness pass repeated observable host hash/equality hooks. Supra and
reference callbacks construct one resource set after filtering, as the source
requires. A sole retained resource is the first matching input resource.

Twelve source scenes run actual resolve_citations with controlled host resources
through default short/supra/reference callbacks. Equal distinct resources,
unequal collisions and same-object aliases cover all three callbacks. Three
additional short scenes cover a named antecedent with equal resources, remaining
ambiguity and narrowing to one party. The target compares exact bool/hash/eq
traces and final groups for every scene. Named equal candidates take the same
trace as unnamed equal candidates; narrowing produces groups [0, 2] and [1].

Source normalized numeric hashes are explicit inputs to the backend proof. The
controlled host adapter implements only these source objects; this evidence does
not assert automatic Python built-in hashing/equality or general model behavior.
Set iteration normalization in evidence must never replace the runtime probe,
rebuild or comparison order. Representation-law rows remain unfinished.

## Limits and remaining proof

Entry and iteration ceilings come from the existing engine limits. Shared work
is captured with R = never. Controls reject an additional distinct member at
the entry ceiling, preserve the existing member and stop exhausted work.
Only construction/add and iteration are exposed because these are the resource
set operations used by the resolver. This helper does not expose deletion,
general set operations, Unicode-specific shortcuts or reentrant mutation.
Reentrant source behavior remains an engine obligation, not an approved waiver.

The full server package gate passes: audit 42.8 seconds and documentation
generation 14.0 seconds, including build, source/test type checks, tests and
lint. Source replay and all eight corruption controls pass. Packet accounting
is checked separately. No source,
donor, safety, representation-law or fidelity-question completion row is promoted.
Native-value handling, null-page identities, legacy adapter removal, production
asset/Layer integration, final per-entry document projection, complete parsing
and regex safety, Bluebook laws, exhaustive target accounting, reflection,
hosted proof and the one-PR lifecycle closeout remain required.

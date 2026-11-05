# Capture callback returns and append destinations during dispatch

Date: 2026-10-29. Private execution-history capture for final document projection.
Public CitationResolution conversion, identity/binding production, production
Layer integration and complete engine parity remain open.

## Source observations

The new maintainer probe runs actual pinned resolve_citations with controlled
host objects and an observational list.append subclass. Eight histories record
nineteen per-mention decisions: actual callback result object, optional append
destination, exact hook trace and final entries. The formatted fixture
`dispatch-decisions.json` has SHA-256
`88efa991758699d739ddac709f20efce4ba086da9eb17bca5bb9170e03a79c36`.
Its metadata binds the clean eyecite commit/tree, CPython 3.11.15 and seed zero,
frozen dependency versions, source/license/lock digests and producer hash.
Attribution remains the existing eyecite BSD-2-Clause notice.

The observer only inspects list/key pointer identity through native items; it
performs no extra key hash, equality or truth call. These scenes have unique
per-entry lists. A list allocation ordinal therefore also names its insertion
entry in this evidence. This is a maintainer normalization, not a claim that
Python exposes integer entry IDs or proof of selecting among shared list aliases.
Controlled host objects have no finalizers; general native lifetime behavior is
outside this observation.

The histories prove distinctions unavailable from the final mapping alone:

- A second distinct but equal returned object is host one, while the stored key
  selected for its append remains host zero.
- A falsy host object is retained as a callback result without being appended.
- A hash changes truth during the first append; that append still occurred,
  even though subsequent default Id returns None.
- Clearing an earlier entry does not erase its historical append destination.
- Reinserting the same resource after clear creates a distinct insertion node.
- An unknown citation resets last resolution without invoking a custom callback.
- A None full result remains in dispatch history and prior-full state.
- Later presentation mutation updates every retained reference to that object.

Fresh pinned replay reproduces the entire parsed artifact. Eight corruption
controls reject omitted/duplicated histories, wrong provenance, lost falsy
results, replacing the stored key with the returned object, rewriting a removed
destination, dropping a None decision and retaining a stale presentation.

## Target capture and ownership

CitationCallbackDecision records one ordered occurrence ID, dispatch category,
returned resource reference and optional CitationCallbackAssignment. Assignment
contains the actual selected insertion slot, stored resource key and member-list
slot. It records successful dispatcher append history, not final membership.
A falsy result remains explicit; None has no append. Unknown denotes the source
no-callback branch, not a function invocation.

The runtime dictionary set operation now returns a defensive copy of its
located/inserted entry. CallbackRuntimeIndex carries that entry to the owner.
The owner captures the destination during the existing get/missing/set sequence;
it never performs a second lookup to reconstruct the selected key. That matters
when hashing/equality changes state or a missing lookup's insertion matches a
preexisting key. Existing table operation/hash/comparison semantics are unchanged.

The legacy owner also allocates monotonic insertion slots, retaining them through
value replacement and allocating new slots after remove/clear and reinsert.
The registered path uses the runtime backend's insertion identity. Final session
groups now carry insertion slots separately from resource-object and list slots.
Callback-facing group snapshots keep their existing shape.

At session completion, current presentations are refreshed through the captured
owner for all returned resources and historical stored keys, including keys no
longer listed. Group snapshots also read current presentations instead of a
cached JSON view. Presentation is a pure observer under the host protocol; no
truth/hash/equality hook is replayed. The owner closes after snapshot capture.

Session schema coherence requires exactly one decision per mention in source
order, unique final insertion identities and no append for None. It deliberately
does not require historical destinations to survive in the final mapping.
All methods remain captured with R = never; request schemas gain no functions.
These structural history values are not authority-key or live capability proof.

## Verification and remaining work

The target compares all nineteen decisions, stored keys, insertion/list slots,
final memberships and exact hooks against the new source fixture. Existing
three mutable default-resource scenes now use captured decisions and actual
insertion slots for their receipt graph controls, rather than inventing the
decision set from final mentions. Their assignment histories are [0, 1, 1] in
the two-entry case and repeated zero in the single-entry cases.

The full server package gate passes: audit 33.5 seconds and documentation
13.6 seconds, including build, source/test type checks, tests and lint. Existing
default callbacks, runtime set/dictionary, mutable-resource, retained-list,
prior-full, detached and host-hook suites remain green. No oracle fixture other
than the new observation artifact is changed.

Final document production still needs a captured, trusted identity/binding
producer and semantic resolution/diagnostic translation. General native-value
normalization, shared-list selection evidence, reentrant comparison, finalizer
behavior, legacy migration removal, production assets/Layer, full parsing and
regex safety, Bluebook laws, exhaustive target accounting, reflection, hosted
proof and one-PR lifecycle closeout remain required. No completion row or
semantic waiver is promoted.

# Produce document graphs and bindings from issued callback sessions

Date: 2026-10-29. Conditional document producer with a captured trusted descriptor
port. Default registered-resource descriptor construction, detailed default
resolution diagnostics and production Layer integration remain open.

## Issued snapshot boundary

Successful callback dispatch now captures an immutable structural session image
and separate genuine anchor handles in a private WeakMap keyed by its outward
result object. The image includes final semantics, decisions, insertion/list
identities and detached objects. Reading an issued session reconstructs its data
from that private image and reuses the captured mention/component/footnote proof
handles. Structural decoding does not issue a source proof.

A copied view or serialized receipt cannot authorize projection. Edits to an
original outward view do not edit its issued history: projection uses the
captured snapshot, not the view's mutable properties. The registry is weakly
owned and in-memory; it adds no persisted source image or log. The source's
native resource objects are not rehashed or compared while sealing or reading.

## Producer and identity port

SessionDocument captures Crypto and CitationSessionResourceDescriptors. The
returned project method has R = never. A trusted server composition supplies
pure resource descriptors; no function or descriptor selector enters request
schema data. There is no invented default native identity or equality key.

The producer constructs the authority catalog, one decision per mention,
ordered insertion entries, shared member-list nodes, detached references,
complete resource bindings and receipt. Callers no longer hand-author those
relationships or expected lists. Native entry slots generate cg1 IDs; owned
list slots generate cl1 IDs. Their versioned SHA-256 preimage binds source
identity, engine artifact, node kind and slot. Runtime random resource scopes
are excluded from that node protocol. Independent replays with different
resource scopes produce the same receipts and bindings.

Descriptor IDs label resources; they do not drive registered dictionary lookup.
An external descriptor can preserve distinct native objects even when one
lookup compares them equal. The source's returned object and stored key can
therefore remain distinct in decisions and groups. The legacy fingerprint route
still requires equality-compatible descriptors and is not a general native
comparison implementation. Its contract is now distinguished from registered
lookup and document identity production.

The producer interns registered references only within the already sealed final
snapshot. This does not memoize live citation hashes or alter dispatch behavior.
Accumulation uses persistent chunks and keyed indexes, converting to schema
arrays at the output boundary. Shared list slots must agree on exact members;
logical catalog and list counts obey the captured operation limits.

## Decisions and diagnostics

Every non-None callback result produces a chosen resource decision, even when
falsy and unlisted. Decisions do not imply final membership. Removed historical
results remain represented independently of surviving insertion entries.
Confidence is absent rather than invented.

None produces Unresolved. The source unknown/no-callback branch is explicitly
unsupported-citation; other None returns use the new closed callback-unresolved
reason. The latter records what is known without guessing no-match, ambiguity,
invalid pin or missing antecedent. Detailed default-branch evidence and richer
ambiguity translation still require implementation before final completion.

## Evidence and controls

The unchanged dispatch-decision fixture contains eight actual source histories
and nineteen decisions, SHA-256
`88efa991758699d739ddac709f20efce4ba086da9eb17bca5bb9170e03a79c36`.
Each now also runs through automatic document/binding production and verified
receipt restoration. Complete native truth/hash/equality traces remain unchanged.
The cases include distinct equal returned/stored keys, falsy results, None,
unknown reset, removed/reinserted entries and live presentation changes.

Controls reject a spread-copy session before invoking its descriptor provider.
They edit the original view's decisions/groups and prove the issued receipt
remains unchanged. Component and footnote proof handles/labels survive. A pure
opaque-object descriptor variant keeps two resource identities for the equal
returned/stored objects while retaining one listed entry and both members.
This distinction also restores under the automatically produced bindings.
Typed descriptor failures are recreated as sanitized identity-failed errors;
controls prove that extra details and source-bearing messages are discarded.

All three actual mutable default-resource scenes now use this producer instead
of manually built documents/bindings. Their ordered groups/member lists survive
codec and source restoration; the two-entry case retains separate entry IDs for
one authority. A fresh independent owner/replay has a different random scope
but exactly the same receipt and bindings.

The descriptor implementations in these tests are deliberately controlled.
They do not qualify a general Python built-in normalizer or default canonical
identity adapter. The public production CitationEngine Layer is not wired to
this conditional producer yet.

The complete domain, server and use-cases package gates pass, including build,
source/test type checks, tests, lint and documentation generation. Audit/docs
times are 8.2/9.3 seconds, 31.9/10.4 seconds and 7.9/8.6 seconds respectively.
Fresh replay reproduces all eight dispatch histories and eleven model-mutation
scenes, with eight corruption controls for each source artifact. The new note
and README pass Markdown lint.

Detailed diagnostics, default registered descriptors, native-value handling,
null-page identities, reentrant comparisons, finalizer behavior, legacy removal,
production assets/Layer, full parsing and regex safety, Bluebook laws,
exhaustive target accounting, reflection, hosted proof and one-PR lifecycle
closeout remain required. No completion row or semantic waiver is promoted.

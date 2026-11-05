# Ordered document membership and receipt v2

Date: 2026-10-29. Structural representation and private persistence checkpoint;
full callback execution and engine parity remain open.

The frozen mutation artifact remains unchanged at SHA-256
`26e81eae9bfcd03ef2370be5d22f7241d96eea18591df602cced8dbc12540a63`.
The earlier callback mutation note supplies source provenance and replay.

## Representation

The domain now owns ordered resource groups and identified member lists.
Lists preserve repetitions and independent member order; sharing one list ID
records an explicit alias relation. Empty listed groups differ from absent
catalog-only resources. Resolution decisions remain one per verified mention,
independent of final membership. Optional authority examples may reference a
mention or detached object without implying assignment.

Detached semantic objects reuse Citation and carry separate document-local
object IDs. They have no anchor, occurrence identity or source capability.
Neither the list/object ID format nor graph closure authenticates an alias
history. Shared persisted LawPractice.CitationId remains unchanged.

Receipt v2 is the sole structural format. No compatibility shim is needed for
these unpublished provisional contracts. Schema closure rejects duplicate
mention/resource/list/object/group identities and dangling references, while
preserving ordered multiplicity and shared list links through JSON encoding.
Reordering root mentions does not reorder a group.

## Private persistence

Trusted out-of-band resource bindings now specify unique decision IDs and an
optional exact list node separately. List ID, ordered references, repetitions
and empty-versus-absent presence must match. A receipt cannot supply its own
binding. Every resolved decision still requires exact binding coverage or a
recomputed default full-citation key. All physical occurrence IDs are checked;
restoration reissues genuine anchors against one verified source.

Unbound default groups must equal resolved decisions in occurrence order and
use one document-local list token derived from their authority token by
replacing the ca1 namespace with cl1. This default producer never aliases two
resources and never content-hashes equal lists into one node. Arbitrary custom
list identity requires the trusted adapter's exact expectation. Hard graph
node/reference ceilings apply before asynchronous identity work. Every list
must belong to a listed group at the private persistence boundary.

Detached semantic values, like other semantic classifications, remain
unverified assertions. Their object IDs and references do not attest their
meaning or source origin. Production object/list issuance and adapter equality
proof remain open. Live vocabulary authentication remains open.

## Test scope

The mutation suite now projects and structurally round-trips all 16 frozen
final snapshots, including shared lists, detached returned members and detached
prior-context objects retained independently of returned groups. It compares
exact group/list nodes and ordered member references after encoding and after
root-mention reorder. IDs encode fixture slots only. Resolution decisions are
explicit unresolved placeholders in this representation test: it does not
claim live callback execution, inference or alias-history fidelity.

The separate session value lane still executes ten known-input mutation scenes.
All six alias/detached execution scenes and all live dictionary/list identity
observations remain open. The 18 custom callback traces and 76 default contexts
retain their existing scope. No canonical/donor/divergence/safety row is promoted.

Persistence counterexamples reject changed list order, ID, decision coverage,
empty-versus-absent presence and unbound default list rewrites. Existing stale
occurrence/key/source tests remain required. Domain tests cover shared lists,
repeated references, detached closure, empty groups and optional examples.

## Verification

Both package gates pass: domain audit 7.8 seconds and docgen 8.6 seconds;
server audit 42.8 seconds and docgen 12.2 seconds. These include build, source
and test type checks, tests, lint and documentation. The ten-component source
evidence audit passes with the final target comparator explicitly pending.
Mutation source controls pass all sixteen rows. Goals doctor reports no new
blocking findings; the goals index and new-note/README Markdown checks pass.
Git whitespace checks pass. Verification logs use the membership-domain,
membership-server, membership-source-audit and membership-goals prefixes in
the existing citation-extraction-engine cache. The goal remains active.

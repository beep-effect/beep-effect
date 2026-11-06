# Captured callback dictionary and owned list state

Date: 2026-10-29. Private known-input execution checkpoint; detached objects,
general host mutation and final engine integration remain open.

## Source and architecture

The source remains eyecite 2.7.6 at the recorded clean commit/tree. The frozen
sixteen-scene mutation artifact is unchanged at SHA-256
`26e81eae9bfcd03ef2370be5d22f7241d96eea18591df602cced8dbc12540a63`.
The earlier mutation-shapes note records exporter, license and source provenance.

The existing architecture review assigns live callback state to law-practice
server, pure group data to domain, and eventual public ports to server
use-cases. The service captures operation state and dependencies; callable
behavior is never request data. No package/shared-kernel change is needed.

The private Id. output now contains only its result resource. A captured
operation-owned dictionary service replaces the earlier array-replacement
protocol. Id. inputs contain fresh schema data views. Custom callback adapters
retain the service/owned list handles to express mutable host behavior through
Effect methods with R = never. A full callback may retain and clear that same
service despite receiving no dictionary argument. This is an explicit Effect
service adaptation of the source callable boundary, not a public host-object
normalizer or a second serialized citation model.

## Implemented behavior

The dictionary retains key insertion order and first key presentation. Missing
key lookup creates an empty list, including falsy/None keys inserted explicitly.
Set may share an existing list handle across keys. Append/write updates that
one list node, so all referencing groups observe the change. Different lists
remain distinct even when their values match. Removing a key or clearing the
dictionary retains list nodes while the operation is live; a callback can put
an owned retained list under a later key. New lists get fresh slots throughout
the operation, including after clear.

A private capability registry accepts only handles issued by that owner.
Schema decoding or copying a slot cannot forge handle ownership. Mutating a
handle's displayed slot cannot change its registered target. Read snapshots
copy resources and member arrays so caller mutation does not change the store.

All asynchronous dictionary operations serialize through one semaphore. The
session requires the exact prepared owner and shared work counter; a second
counter with the same ceiling cannot split accounting. The factory snapshots
numeric limits. Current alias multiplicity and retained-list storage are both
bounded. Failed writes/set operations leave the dictionary unchanged. Retained
node allocation is bounded by the iteration ceiling. These controls do not
replace the pending overall clock, regex and process-isolation safety proof.

The session acquires the owner once and releases it on success, failure or
interruption. Release closes further access and clears stored keys/list data.
A closed dictionary cannot be reused for another run.

## Target evidence and limits

The known-input mutation test now executes all 13 applicable scenes, 30 input
occurrences and 30 callback events. It compares complete before/after events,
resource values, ordered/repeated member references, list slots, dictionary
identity observations and final groups directly against the frozen source.
The three alias-family scenes now execute: shared member lists, successive
Id. dictionary identity, and a full callback clearing a retained dictionary.
The remaining three scenes require detached object/prior-full execution.

Independent controls reject forged and cross-owner handles, preserve retained
lists after clear, isolate copied snapshots, serialize concurrent appends,
reject alias/reference budget excess without partial writes, reject work
counter mismatch, and close capabilities after callback failure/interruption.
The existing 18 custom traces, 76 default contexts and all sixteen structural
codec snapshots retain their prior proof scopes. No canonical/donor/safety or
divergence row is promoted by this checkpoint.

Final diagnostics/projection, detached semantic execution, arbitrary host
object/model mutation, production document list/object identity issuance and
public port publication remain open. Runtime list slots are private operation
identities; they are not cl1 document tokens or source evidence capabilities.

## Verification

The final server package gate passes: audit 31.7 seconds, docgen 11.0 seconds.
Build, source/test type checks, all tests, lint and documentation pass, including
the new interruption control. The ten-component source evidence audit passes;
the exhaustive target comparator is explicitly pending. All sixteen source
mutation controls pass. Goals doctor reports no new blocking findings; goals
index, new-note/README Markdown checks and Git whitespace checks pass.
Verification logs use the callback-dictionary prefix in the existing citation
engine cache. The goal remains active; no partial PR is published.

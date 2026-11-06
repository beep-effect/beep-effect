# Retained prior-full lists and immutable pair identity

Date: 2026-10-29. Focused private execution checkpoint; exhaustive parity,
mutable host/model behavior and final projection remain open.

## Source provenance

The new maintainer probe runs against the clean pinned eyecite 2.7.6 commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`. Python 3.11.15, hash seed zero,
reporters-db 3.2.53 and courts-db 0.10.22 are enforced. The artifact binds the
exporter, resolve.py, models.py and the BSD-2-Clause license digest. Strong
references preserve observed object identities without allocator reuse or
emitting process addresses.

Artifact:
`packages/law-practice/use-cases/test/fixtures/eyecite/prior-full-observations.json`.
SHA-256:
`191b4e7f872ffb886f2532aba1a4fc68f25a5022141df7207197906d49c9b2ac`.

The eight scenes contain 31 input occurrences and 31 dispatch events. Source
observations show:

- Short, supra and reference callbacks receive one shared prior-full list.
- A retained view observes later automatic full-citation appends.
- A later full callback can clear, reverse or append through the retained list
  despite receiving no prior-full argument itself.
- A later Id. callback can clear a list retained by an earlier context callback.
- Replacing one pair changes subsequent resource selection without rewriting
  prior group membership.
- A pair is an immutable identity-bearing tuple. Replacing it with an equal
  tuple preserves values but changes identity; a retained old tuple remains
  unchanged. Existing pairs retain their identities across later callbacks.

Inserting the current full citation under a foreign resource before its normal
append produces two resource candidates for that occurrence. The following
supra result becomes None. This distinguishes context mutation from group
assignment and is compared directly in the target.

## Runtime adaptation

The captured operation owner now owns the prior-full list and registered
immutable pair nodes in addition to dictionary/list/semantic-object state.
Context callback outputs contain only their resource result. The earlier
array-replacement output path is removed. All custom adapters and production
defaults use the same live owner; no competing compatibility path remains.

Adapters retain the owner and use its methods rather than mutating schema
snapshots. Private pair slots represent immutable node identity separately from
values. Equal pairs can have different slots; repeated references to one pair
retain its slot. Registered old pairs survive replacement/clear for retained
references during the operation. Pair/node allocation and current list length
are bounded by existing iteration/mention ceilings and share operation work
accounting. All methods capture their dependencies with R = never.

Snapshot data cannot rewrite registered pair values. Altered or unknown pairs
are rejected, and an oversized/invalid list write leaves the prior list intact.
Citation/resource references are snapshotted and checked against the same owner
before registration. Owner release closes access and clears pair/list state on
success, failure or interruption. Pair slots are private operation identities,
not source anchors, occurrence IDs, persisted entity IDs or document tokens.

This is the established Effect-service adaptation of source mutable callback
state. Input arrays are fresh schema views; logical identity observations map
source objects to owner/pair slots. General host normalization and arbitrary
mutable citation-model behavior are not proved by this checkpoint.

## Target proof

The new target suite requires the exact artifact hash, eight names and all 31
events. It compares every source event, before/after context, retained-list and
pair identity observation, result resource, final group and final context. It
uses real production default short/supra/reference/Id. helpers. The reference
witness explicitly supplies the source scene's Smith name before verified
preparation; semantic witness testing does not attest original extraction.

Independent controls preserve equal-but-distinct pair nodes and duplicate
references, isolate read snapshots, reject altered/oversized writes atomically,
and close access after release. The prior 16 mutation scenes, 18 custom traces,
76 default contexts and dictionary/object/lifecycle controls remain green.
No canonical/donor/safety/divergence row is promoted.

## Verification and reproduction

Portable source validation includes eight corruption controls: missing and
extra rows, license drift, missing events, wrong list identity, unknown pair
identity, collapsed equal-pair identity and false retained-pair observations.
Fresh pinned replay matches all decoded artifact values, allowing repository
formatting only.

```sh
python3 goals/citation-extraction-engine/ops/verify-prior-full-controls.py
bun run beep quality package-verify @beep/law-practice-server
```

For fresh replay, run the Python verifier with the pinned interpreter, hash
seed zero and --oracle-root pointing to the clean oracle checkout.

The server package gate passes: audit 34.1 seconds, docgen 11.6 seconds,
including build, source/test type checks, tests, lint and documentation. Logs
use the prior-fulls prefix in the citation engine cache. The ten-component
source audit passes, and goals doctor reports no new blocking findings. Goals
index, new-note/README Markdown checks and Git whitespace checks pass. The
final target comparator remains pending;
the goal stays active and no partial PR is published.

## Remaining work

The full objective still requires general host/model mutation accounting,
trusted artifact integration, unified diagnostics/document projection, public
service/ports, bounded parser and regex safety, Bluebook/schema laws, exhaustive
corpus/donor/divergence closure and the one-PR hosted/reflection/lifecycle proof.
These eight focused traces close their recorded state counterexamples only.

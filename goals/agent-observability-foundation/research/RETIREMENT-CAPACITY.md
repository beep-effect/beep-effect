# Reproduced delivery-capacity retirement deadlock

A valid native intake can accept two unique single-event pages while the delivery
ledger allows only one canonical event. Registering the first page uses the only
slot. Registering the second returns capacity. After the explicit 24-hour expiry
age, the first page expires, preserving its compact pending evidence. Expiring
the second still calls registerPage and fails (mapped to storage), leaving its
payload retained. Seal refuses retained pages, so compact-event capacity cannot
be renewed. No corruption or synthetic forged metadata is required.

The bounded characterization passes all 14 reclamation cases and asserts this
undesired refusal explicitly; it is not a passing acceptance test for retirement.
See ops/history/retirement-capacity-characterization.json. Production source remains at
the query-backoff proof snapshot; the new characterization changes one test file
after that full package gate. The next repair must rerun affected verification.

Native conflicting payloads under the same event identity are separately recorded
in conflictIndices and excluded from canonical export. The reviewer has not yet
established an ordinary owned transcript-reader path to registerPage conflict.
Never treat arbitrary storage or checksum conflict as authorization to delete.

Repair direction: expiry must distinguish enrolled delivery state from fully
validated never-enrolled references, retain their separate counts and provenance,
and allow the evidence epoch to retire without claiming those events reached
Phoenix. Counts of references (including duplicates) must not inflate canonical
enrolled totals. Capacity-only refusal is recoverable; invalid bytes/indexes or
contradictory evidence continue to hold. Recovery snapshots, mixed pages,
duplicates whose owning page was disposed, oversized first batches and rollback
must be tested. No repair or production migration is claimed yet.


## Repair and integrity contract

Explicit age-gated expiry now tolerates only delivery-registration capacity
refusal. It still verifies the complete retained page and canonical metadata,
including contradictory transcript occurrence IDs that an early registration
capacity failure could hide. Missing registration is recorded as
`unenrolledReferences`, separate from all five enrolled delivery-state counts.
Those references are page observations and may repeat across duplicate pages.

Native canonical identities absent from the delivery ledger also receive an
owner-receipt-bound, ordered count and checksum. Only identities canonically
owned by that receipt contribute to `unenrolledNativeEvents`; duplicate page
references cannot inflate it. Retirement verifies that index before removal.

Every new verified or expired disposition additionally records an ordered count
and checksum of the enrolled canonical identities owned by its receipt, including
an explicit zero-count summary. This detects missing pending transcript rows
after payload disposal, even when there is no send/visibility history. Before
expiry, missing membership with registered canonical-owner, send, query or
visibility evidence is an integrity refusal. After expiry, the same contradictions
and all ownership-summary mismatches prevent retirement. Recovery snapshots
preserve both summaries and original compact rows atomically.

Registration attempts are cached only within one expiry transaction, seeded with
the selected receipt. A capacity-refused native owner is checked once rather
than re-decoding its entire page once per event. No durable validation shortcut
or cross-operation cache is introduced.

Intake now reserves terminal-disposition capacity in its existing transaction:
retained pages plus compact dispositions must remain within maxDispositions.
This applies to native and transcript admission after exact-replay handling.
Refusal cannot advance a transcript cursor, and retirement releases capacity.
Installing a retention policy over already overcommitted standalone data refuses
transactionally, preserving the pages and requiring an explicit migration.

## Compatibility and remaining bounds

New summary fields are optional when decoding older dispositions so their bytes,
checksums, backup and logical restore remain readable. They are mandatory proof
for a new seal. An older disposition without enrolled-ownership evidence is held
with a configuration refusal; it is not silently upgraded from its remaining
possibly incomplete rows. Restoring a legacy generation does not make it newly
sealable. Keep those journals/archives intact pending a separately qualified
migration. Earlier binaries may also reject new fields. Operational rollback is
stopping the owned route and preserving its journal, not deleting summaries or
rewriting old evidence.

This repair does not raise configured physical, compact-record or recovery-copy
limits. Those bounds may still require explicit policy/migration work; it does
not promise indefinite renewal under arbitrary policy combinations. The legacy
forwarder store and service hold are separate and untouched.

## Verification

The original valid-input defect receipt remains preserved. Focused v4 tests pass
42 cases across reclamation and retirement, including oversized first batches,
mixed visible/unenrolled events, duplicate ownership, source-cursor preservation,
terminal-slot refusal/reuse, corruption before and after disposal, legacy-summary
holds, logical restore and bounded registration call count. Final full package audit/docgen pass with 167 source/test hashes unchanged:
ops/history/retirement-package-verification.json. Installed proof also passes with 85
unchanged runtime inputs, two labelled synthetic records and two visibility
receipts in project foundation-canary-d8b2289bc828. Owned worker/frontend PIDs
are zero and their units removed; owned collector/health services are cleaned up.
See ops/history/retirement-live-verification.json and retirement-proof-archive.json.
The latter preserves24files in the private same-host archive; retained bundles
were deliberately tampered for integrity-refusal testing and must not be run.
This live proof verifies installed normal operation and maintenance wiring; the
capacity and corruption conditions are proved by synthetic library regressions.
Full CLI/repository delivery and legacy migration are not claimed.

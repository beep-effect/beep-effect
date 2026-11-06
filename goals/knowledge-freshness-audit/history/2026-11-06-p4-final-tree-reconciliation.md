# P4 final-tree reconciliation, first pass

P4 is in progress under the operator instruction of 2026-11-06. This report
accounts for tracked entries and exposes remaining review obligations. It is
not a final coverage certificate or audit completion.

## Immutable inputs

The cloud census used commit
`e462bc12e9fdb6da2db1f7ad8bd3be791f7806b4`, tree
`90524001c0ad48d4f94cda8950821b80ff8325b7`. The original per-entry census
matches all 45,826 Git mode/blob/path tuples at that revision.

This pass uses source snapshot
`914ede95a490cf26e1fe435762ec191fd2e69da1`, tree
`961077366384cd690b5b947957373884fedc3b9e`. The source snapshot precedes this
report and its phase records. A publication comparison must account for those
additions and any intervening main changes separately. The report does not
claim to contain the hash of its own publication commit.

## Tracked-entry accounting

| Relation to the cloud snapshot | Entries |
| --- | ---: |
| Unchanged mode/blob/path tuple | 42,139 |
| Modified at the same path | 3,225 |
| Added path | 1,861 |
| Current tracked total | 47,225 |
| Deleted path, retained in the historical ledger | 462 |

Git's similarity analysis proposes 126 renames. The raw path delta contains
1,735 additions, 336 deletions, 126 rename candidates and 3,225 modifications.
A rename candidate contributes one added and one deleted path to the table.
Similarity is a continuity lead, not accepted semantic lineage.

All 1,642 tracked aliases resolve within this Git tree: 1,503 to tracked
directories and 139 to tracked files. Resolution reads tracked symlink blobs
and tree metadata. It does not follow host filesystem links or read external
targets. This check found no broken alias to repair.

The private ledger gives every current entry an explicit pending extraction or
revalidation disposition, or the separate ADHD provenance hold. Deleted entries
retain their old identities. No file receives a zero-claim verdict by default.
Binary, generated, third-party and historical classifications still need the
appropriate producer, ancestry or applicability evidence before their final
extraction dispositions can be accepted.

## Linkage to collected proposals

A conservative pass over 133 recovered record files linked 739 explicit
`entry` or `entry-update` records to frozen Git blobs. All 739 paths and blob
identities matched. They refer to 365 distinct frozen paths, with this relation
to the current snapshot:

| Current relation | Linked paths |
| --- | ---: |
| Unchanged | 283 |
| Modified | 80 |
| Deleted | 2 |

These are entry-receipt links. They do not count complete body reads, accepted
claims or semantic coverage. Other record families and secondary source reads
are outside this linkage pass. Repeated entries stay visible and do not create
new unique coverage. Even an unchanged blob can need a new determination when
its evidence, authority or method changes.

The two deleted linked documents are the former agent-messaging runbook and its
cache qualification review. Commit `6fad8f6d0f` retired them in PR #2594 when
T3 Code became the cross-session messaging route. Current guidance checked in
this pass does not link to those retired files. Historical removal-map and
inventory references remain historical; this pass does not restore the retired
route or treat deletion as lost audit evidence.

## Reference candidates and false-positive review

The existing read-only Knowledge doctor reported 948 blocking reference
candidates and 41,486 advisory unclassified reference spans at this snapshot.
Those are scanner outputs, not accepted defect or verified-claim totals. The
report's span classification named `verified` is not a claim-verification
verdict. No baseline or scanner behavior changed.

Eleven selected diagnostics were rejected as audited-content repairs:

- Four references to the old cloud bootstrap are explicitly scoped by the
  packet's bootstrap-history preamble and D42. The current bootstrap remains
  `scripts/cloud/bootstrap.sh`; the original acceptance and decision rows stay
  preserved.
- Three references to the future repo-operations app are architecture
  destinations with an explicit transition qualifier. They do not assert that
  its workspace package is already installed.
- The glossary's identity-namespace example is illustrative, not a workspace
  package declaration.
- The design-system stylesheet example is explicitly relative to a package
  directory. Normalizing that stated context resolves to the tracked shared
  stylesheet. Its UI alias is the configured shadcn/lint prefix, not a bare
  module import.
- The shadcn coverage helper exists as a tracked file inside the skill. The
  detailed recipe gives its skill-directory invocation. A root-relative
  reference candidate does not establish a missing helper.

No audited-content defect was validated in this selected sample. The raw
findings, exact review decisions and identity checks remain in the private
archive. The remaining scanner candidates still require review; this sample
neither clears them nor authorizes a broad suppression.

## Record-quality checks and remaining work

An independent replay matched every current and deleted mode/blob/path tuple
against Git and verified the ledger hashes. Four counterfactual corruptions
were rejected: one omitted entry, a duplicate replacing an entry, a wrong blob
identity and an unobserved zero-claim acceptance. These are private
record-quality probes. They do not add a permanent repository gate or establish
semantic extraction completeness.

P4 remains open for:

1. Per-family extraction-quality and omission review, including source/JSDoc,
   manifests, generators, imported skills and active guidance beyond this sample.
2. Revalidation of the 80 changed linked paths and dependent evidence, and
   dispositions for the 1,861 added paths and other required entries.
3. Reviewed rename/deletion lineage and generator ownership. Complete tuple
   accounting alone cannot close those obligations.
4. Accepted determinations and before/after proof for any newly validated
   discrepancy, followed by precise protection in the existing gates.
5. Final aggregate acceptance and exact-head delivery proof. P5 reflection and
   lifecycle closeout remain pending.

PM's missing original report and ADHD's imported-source provenance remain
separate holds. No paid pilot, cloud session, purchase or new paid endpoint was
used. Raw ledgers and full reports remain in the private archive. Public Git
receives this compact accounting and its limits.

## Friction

The reference report contains context-sensitive false positives for historical
paths, planned package names and package-relative examples. Each selected case
was checked against its source context before deciding whether to repair it.
No mechanical candidate was converted directly into a content change. The
record linkage also preserves the distinction between an entry receipt and a
complete extraction, so repeated records cannot inflate coverage.

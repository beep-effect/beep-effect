# CLI internal owners — recall-net correction

Frozen source32f111f3707a63168b68ed04516af800ecc3a66c/main339da1562a2ed52f73a0a693c176fc52cca9ccb6.
All four complete owners have exactly ONE Boolean member, with no inheritance,
base fields or spread fields supplying another. SPEC33-35 requires at least two.

## R33 raw file-read candidates: do not admit

ContainedFileRead at FsGuards125-133 has exists:Boolean128 and contents:Option<String>127.
ContainedBytesRead at150-155 has exists:Boolean and contents:Option<Uint8Array>151.
Option presence is not a second Boolean-typed field. The producer implication
contents⇒exists cannot bypass recall even if it is valid flag/payload evidence.
Both raw rows repeat already resolved R32 ineligibility. Entire FsGuards.ts SHA256
is535387a2fda8ae6fe252144fc8f7930605416ea4a5ff4a4331f4480807034c39, exactly matching
R32 reconciliation-progress source binding. No source change reopened eligibility.
Neither currently exists as a canonical owner row; retain raw reports and do not
add a replacement D1/D2 row or design.

## GhPageInfo: archive canonical row

GhSchema66-74 contains hasNextPage:Boolean69 and endCursor:NullOr<String>68 only.
The footer reports field69 versus inventory61, while the actual declaration
anchor is66. Those different anchor roles are not evidence of a second Boolean
or a classification change. Existing r25-cli-internal-root-gh-page-info D2 may
accurately describe pagination provenance, but an out-of-net owner is not a
Boolean census suspect. Archive/remove its canonical row with no new D1/D2 row.
Retain all GitHub pagination decode/nextCursor error behavior; no API rewrite.

## DiscoveredCandidate: archive canonical row and design

TmpfsReap62-70 has classified:Boolean67, root/path:string, reapClass literal
family, idleSinceMillis:number, shapeSkipReason:Option<literal reason>, and
parentRepo:Option<string>. TmpfsReap.schemas34-41 defines six string classes;
97-110 defines twelve string reasons. There are no other Boolean members in
this complete owner. Presence abstraction and class/reason finite cardinalities
cannot turn these fields into Boolean types. The previous312/13 design domain
is therefore irrelevant to the initial recall prerequisite.

Existing r28-cli-internal-root-tmpfs-discovered-classified-skip must be withdrawn
with its design, despite its recent complete payload audit. The footer's old
inventory anchor66 points at idleSinceMillis, current classified is67, and the
declaration is62. Correcting an anchor does not make this owner eligible. Do not
borrow booleans from the separate discovery observation/helper scope or public
TmpfsReapCandidate report model. This audit makes no classification decision for
those other owners. No tmpfs probe, deletion, worktree operation or safety guard
change is authorized or performed.

## Parent action and preserved evidence

Private originals preserve two canonical rows, candidate design and raw R33
rows. Parent should archive exact current inventory/design after the frozen
round permits it, then remove exactly the two canonical IDs in scope-proposal.
Reconcile R33's seed-retention assertion as incorrect scope classification;
keep the original execution receipt/footer and raw reports unchanged. This
correction is not a new user-contract ambiguity and yields no implementation,
independentP3 or dry-round credit. Do not modify unrelated Tmpfs designs.

All source inspections and hash comparisons were read-only. No tracked files,
HEAD, remotes or proof jobs changed. Runtime tests are unnecessary to establish
these complete schema/type declarations' Boolean member counts.

# P2 refresh: files-person-reference-disposition

Source HEAD `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, refreshed 2026-09-22.
This supersedes the R28 design, including its unsafe proposal to put strict
seven-case conversion directly in worker stdout parsing. P2 evidence only;
replacement independent P3 and GATE 2 remain prerequisites to implementation.

## Current shape

`MatchPerson.schemas.ts:1254-1266` owns `PersonMatchReference`: required
sourceName, sourcePath and NonNegativeInt faceCount, accepted Boolean, optional
FaceDetectionConfidence detectionScore, and optional six-literal
PersonMatchReferenceRejectionReason (`431-450`). Required count and complete
string/number payloads are not additional Boolean axes.

## Cardinality gap

The finite product is 2 accepted values × 7 reason alternatives (absent or six
literals) × 2 score-presence states = **28 representable / 7 legal**. The complete
repo-owned Python producer `collect_references`, worker.py:730-803, establishes:

| Semantic case | accepted | reason | detectionScore |
| --- | --- | --- | --- |
| Accepted | true | absent | present |
| Unreadable image | false | unreadable-image | absent |
| Aligner rejection | false | aligner-confidence-failed | absent |
| No face | false | no-face | absent |
| Multiple faces | false | multiple-faces | absent |
| Missing embedding | false | missing-embedding | present |
| Invalid embedding | false | invalid-embedding | present |

The saved probe executes the extracted actual producer with eight synthetic
branches (two distinct aligner paths), producing seven projections. It preserves
reference order, embeddings/names accumulation, rounded scores and stderr. This
is bounded producer evidence, not package tests, model execution or proof that
every potential public decoder input is a supported producer state. No supported
alternate writer was found in the audited fixtures; permissive decoding alone
is not an eighth case.

## Target schema

Introduce annotated named case schemas retaining sourceName, sourcePath,
faceCount and every owned score value. Reuse the existing rejection reason kit;
do not duplicate its six spellings. Use a private LiteralKit for the top-level
accepted/rejected discriminator, and derive rejected cases from existing reason
members. The accepted case has a required score and no reason; four rejected
members have no score and two have required score. A rejected reason union plus
top-level accepted/rejected union gives seven leaves without an extra stored
Boolean. Use schema-derived matches and guards. Keep kit bases unannotated until
member mapping; annotate the union before `S.toTaggedUnion` so matching statics
survive. Named class members carry `$I.annote`; no ad-hoc interfaces/assertions.

Do not infer new finite count axes. Preserve NonNegativeInt payloads and the
existing accepted faceCount=1 and aligner faceCount=0 validation. The producer's
other observed counts are evidence, not authorization to tighten every exported
payload constraint. Count, path, duplicate, summary and model validations remain
independent obligations.

Crucially, distinguish a raw protocol DTO from the validated domain value.
Retain the current flat field grammar in a clearly named raw worker-boundary
schema. Worker success/report JSON decoding and injected worker service fixtures
use that raw shape through envelope, size and recursive-name validation.
Refine each reference at its existing ordered semantic-validation phase, not
after the whole worker has already passed semantic validation.
Do not install the strict semantic codec as the nested worker stdout schema.
The raw accepted Boolean is justified only at this protocol/validation boundary;
do not copy it into the validated report model or use it downstream there.

The public semantic `PersonMatchReference` and persisted `PersonMatchReport`
use an explicit bidirectional legacy-flat-to-union codec. Encoding reconstructs
the exact accepted/reason/detectionScore keys, omissions, numbers and order;
no new discriminator reaches JSON. Worker DTO schemas remain raw and distinct
from semantic report schemas. Retain existing public worker decoder, service,
test-kit and report encoder entry points. This intentionally changes the
semantic decoded constructor/property API; migrate its callers and examples,
including `.make` uses. Do not falsely promise flat decoded property compatibility
while removing those properties. Assess release-note/changeset policy during
implementation; do not invent an unconditional version bump for this P2 audit.

Use local Effect v4 `Schema.decodeTo` (5387-5408) with explicit SchemaGetter
decode/encode transformations and `toTaggedUnion` (6126). Use Effect/Result
boundary decoding with existing error mapping, not v3 transform APIs or sync
throwing helpers. Every legal legacy shape must round-trip losslessly. Invalid
combinations newly rejected by semantic conversion must report a typed error;
do not claim they already had the same diagnostic under the permissive decoder.

## Migration inventory

1. `MatchPerson.schemas.ts:431-450,1254-1266,1586-1601,1772-1789,1811-1840`:
   reuse reason domain; separate raw worker DTO from semantic reference codec;
   keep worker report nesting raw, report nesting semantic. Preserve worker v3
   and report v2 versions, all other model/parameter/entry/summary fields and
   full error union. Update existing exports through Files.schemas.ts and the
   Files index, all public examples and constructor call sites.
2. Python `worker.py:730-803`: leave byte-producing logic unchanged. Preserve
   all six reasons, score rounding, complete count/name/path payloads and the
   two aligner rejection paths. No tag additions or Python cosmetic rewrite.
3. `MatchPerson.worker-service.ts:506-528`: retain truncation guard, strict
   excess-property JSON parsing, stderr-aware invalid-JSON mapping and exit-code
   checks. `884-901` must retain envelope checks, model-artifact verification,
   then unique accepted-name validation. Envelope `755-763` retains requested
   evidence, compute selection, backend runtime and size evidence in order.
4. **Previously omitted consumer:** worker-service.ts:766-778 filters raw
   references on accepted at line771 for recursive duplicate-name validation.
   Keep it on the raw DTO at this earlier boundary. Replacing it with a strict
   semantic decode would move reference grammar failures ahead of established
   later diagnostics. Preserve recursive=false short circuit and name order.
5. `MatchPerson.ts:1257-1335`: retain path containment/basename/duplicate
   checks first, reference iteration order, accepted count and accepted-name
   accumulation. Immediately after each reference's path check, preserve the
   independent count rules and decode that reference into the seven-case model.
   Accepted count != 1 maps to the existing inconsistent-accepted-evidence
   `FilesCommandError`. This can precede case decoding: the existing OR at1279
   uses the same message for count, missing score and extraneous reason, so their
   relative evaluation does not distinguish observable diagnostics. For a raw
   aligner rejection, preserve faceCount=0 validation and its existing error.
   Its exact-reason guard cannot fire for an absent reason, preserving the old
   missing-reason-before-aligner-count outcome. Do not add count restrictions
   for other rejection cases.

   **One schema conversion at this phase replaces the coherence conditionals.**
   The accepted case decode requires score and absent reason, with its decode
   failure mapped to the existing inconsistent-accepted-evidence error. A
   rejected case decode requires a reason; its structured missing-reason issue
   maps to the existing omitted-rejection-reason error. The six rejected cases
   constrain score presence according to the table. Other rejected case decode
   failures map to a new typed inconsistent-rejected-reference-evidence error.
   Use named case schemas and schema issue metadata/path information for error
   mapping; never restore hand-written score/reason presence guards or inspect
   formatted issue strings. An explicit raw accepted discriminator at this
   transport boundary may select the branch codec/error mapping; it is not
   stored again in the returned domain. Reject forbidden fields before any
   transformation that might discard them. In particular, an accepted reason
   and score on a scoreless rejection must fail, not be silently stripped.

   `validateWorkerReference` returns the refined reference, replacing its
   Boolean result. `validateWorkerReferences` returns ordered refined references
   alongside acceptedCount and acceptedNames; derive acceptance by the union's
   generated match/guard. Update the existing `ValidatedWorkerReferences` model
   to carry these complete domain references, not a reconstructed payload subset.
6. `MatchPerson.ts:1544-1566,2058-2092`: retain model validation before references,
   then entries, summary and completeness in the same order. Return the refined
   references from `validateWorkerSemantics` after all these checks succeed.
   Preserve expected-before/after discovery and changed-files failure before
   semantic validation, then zero-accepted failure, copy plan and materialization.
   Report construction at2080 consumes the returned refined references instead
   of worker.references. **No second later reference decode or coherence pass.**
   No output writes occur before the full existing semantic pipeline succeeds.

7. Report encoding/writing (`1675-1685`), materializeReport (`1994` onward),
   manifest routing, archive/copy planning, JSON/human output and result fields
   retain exact values and encoded bytes. No projected subset of the reference
   payload may replace full report references.

## Guard-deletion accounting

Delete the score-presence and reason-absence predicates from accepted guard1279,
leaving only the independent faceCount=1 rule with its existing error. Delete
rejected reason-presence guard1290: schema case decoding now establishes it and
maps its issue to the same typed diagnostic. Retain aligner count guard1295.
Replace Bool.match1309 plus the Boolean-return validators with the ordered
boundary decode described above and a refined-reference return value. Replace
accepted Boolean accumulation at1323-1326 with the semantic union's generated
match/guard; carry the same decoded reference into the report.

The raw worker service accepted filter771 and envelope/size/recursive-name checks
remain at their earlier transport boundary and are **not** counted deleted.
Path, count, model, entry, summary and completeness validation are independent
payload obligations. The raw DTO must not survive as a semantic report field.
This revision removes actual score/reason coordination predicates at their
existing enforcement phase rather than retaining them and adding a late codec.

## Diagnostic precedence and newly invalid inputs

For the previously diagnosed accepted inconsistencies, absent rejected reason,
aligner count, and path errors, preserve the same typed error and message at
that reference's existing phase. This promise applies when no newly forbidden
reason/score tuple earlier in the sequence now wins. Earlier worker-envelope,
size, recursive-name, discovery and model errors still precede all per-reference
case failures. Path failure for the same reference still precedes its case decode.
An aligner count failure precedes a newly forbidden aligner score on that reference.

The old validator accepted six rejected reason/score contradictions: scores on
unreadable-image, aligner-confidence-failed, no-face or multiple-faces, and missing
scores on missing-embedding or invalid-embedding. These now fail at their own
reference phase, before later reference, entry, summary, completeness or
zero-accepted failures. They were never accepted producer states, but this is an
intentional tightening of permissive external decoding and an observable error
precedence change on malformed inputs. Do not claim otherwise or postpone them
to a late conversion to preserve accidental acceptance. Of the 21 illegal finite
projections, 15 already fail the old accepted/missing-reason rules and six are
newly constrained (holding independent payload validation legal).

## Encoded-side impact

Tier 2 persisted/wire-adjacent singleton. Preserve legacy worker/report keys,
key order, versions, omissions, all six reasons, confidence values including
permitted zero, counts, names/paths, reference ordering, model/parameters,
embeddings and existing typed diagnostics within the precedence scope above. The worker protocol remains raw; persisted
report encoding reverses the semantic transformation. No silent normalization,
default false/zero, dropped scores, renamed wire reasons or new tag bytes.

## Test impact

Implementation tests must:
- Round-trip all seven legal shapes through both boundary/report paths and
  compare exact encoded bytes, omitted keys and full payloads.
- Enumerate all 28 finite projections; reject the other21 in the semantic
  codec with appropriate typed errors, distinguishing newly constrained inputs
  from inputs already rejected by ordered legacy validation.
- Retain the existing faces-limit fixture (`files-command.test.ts:2734-2762`):
  an accepted reference with faceCount65,536 must still yield the aggregate
  `reported more than 65536 faces` error, not an early schema/reference error.
- Test competing invalid fields for truncation, JSON/excess keys, exit status,
  envelope/model, aggregate face count, recursive duplicate names, changed
  discovery, reference path, accepted score/reason/count, aligner count,
  entry semantics, summary and completeness to prove the scoped established precedence and explicitly assert the six new
  rejected-score failures at the per-reference phase. Include a newly invalid
  earlier reference against a later old reference/entry error to document the
  intentional change rather than asserting blanket error equivalence.
- Preserve both ordinary accepted worker fixtures (`492`, `564`), recursive
  duplicate-name fixture (`2921` onward), synthetic image/aligner/embedding
  branches, accepted name/count order, and no-report-written failure behavior.
- Run focused Files/protocol tests and mandatory `@beep/repo-cli` package
  verification after implementation; this P2 refresh ran only the saved Python
  producer probe and artifact checks, not those tests.

## Risk

Primary risks are diagnostic precedence, loss of payloads or omission semantics,
and leaving the raw DTO in the validated domain. The ordered boundary split,
byte fixtures and seven-case semantic report address these risks.

Land this record alone in its Tier 2 PR after independent review/GATE 2.
DetectFacesEntry remains a separate singleton; serialize shared Files module
edits with that migration and threshold work. Shared files do not authorize
combining distinct Tier 2 records.

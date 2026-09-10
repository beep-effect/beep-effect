# PersonMatchReference full reason-domain provisional

Stable id `files-person-reference-disposition`, schema at
`packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.schemas.ts1254–1266`.
Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. This data-only P2 replacement
preserves the current design and archives. Full hashes/provenance are in
`data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md`.

# Current shape

PersonMatchReference owns accepted:Boolean, optional detectionScore and optional
reason from the existing six-value PersonMatchReferenceRejectionReason kit.
It also owns full source name/path and required faceCount. The repo Python
worker emits this protocol; it is not an external SDK mirror. Worker stdout
and persisted PersonMatchReport both contain the schema.

collect_references in python/photo-face/beep_photo_face/worker.py730–803
starts a rejected entry, then produces one of six reasons or acceptance.
Four rejection reasons lack score: unreadable-image, aligner-confidence-failed,
no-face, multiple-faces. Missing/invalid embedding rejections have one detected
face and its score. Acceptance has score, faceCount1 and no reason. Score is
rounded through the existing worker function; all full values remain payload.

# Cardinality gap

Accepted2 × (absent reason +6 literals)7 × score-presence2 = **28**. There are
**7** supported reason-specific projections, one per rejection plus accepted.
The old8/3 count incorrectly replaced the finite reason domain with a Boolean.
The four scoreless rejections and two scored rejections may share schema
building blocks, but they remain six distinct supported literals. Required
faceCount is not a zero/nonzero Boolean axis.

# Target schema

Reuse PersonMatchReferenceRejectionReason; do not create a second spelling list.
Define named accepted and rejected case schemas, with the rejection family
partitioned by score ownership: the four scoreless reasons own no score and
the two scored reasons own the complete FaceDetectionConfidence value.
Use a named LiteralKit for any new top-level accepted/rejected discriminator
and existing reason literals for cases; S.Union plus S.toTaggedUnion and
schema-derived guards provide exhaustive matching. Retain required source
identity and exact faceCount constraints in the relevant cases.

Keep a legacy flat encoded schema feeding the new decoded schema through an
explicit bidirectional codec. Encoding reconstructs accepted, optional score
and optional reason with exact omissions and numeric values. Decoding preserves
all7 supported shapes and rejects contradictory ones with the existing typed
worker/schema error mapping. Required count/path constraints remain separate
from the finite cluster. No omission-to-false/zero default or score coercion.

# Migration inventory

- MatchPerson.schemas.ts431–450/1254–1266: reuse the reason kit, introduce
  named cases/compatibility codec and preserve public PersonMatchReference
  name/identity. Worker success1593 and persisted report1778 continue nesting
  this same codec; report version and field order stay unchanged.
- Python worker730–803 is the complete producer. Its wire fields and branching
  can remain byte-identical; a TS decoded-state refactor does not require a
  Python protocol edit merely to rename internal tags. Retain score rounding,
  aligner exceptions, reference order, embeddings/names accumulation and all
  stderr messages. Any future Python edit must prove the same old wire bytes.
- MatchPerson.worker-service.ts506–528: keep stdout decoding with
  onExcessProperty:error, worker error channel and existing diagnostic mapping.
  Strict decoding must use the codec, not a new raw tag-bearing shape.
- MatchPerson.ts1258–1331: keep path containment, basename identity and duplicate
  path checks. Replace accepted/rejected Option coordination with case matching;
  retain existing accepted faceCount1 and aligner-count checks and exact error
  messages. Keep acceptedNames, acceptedCount and reference order.
- MatchPerson.ts1524–1565 and other worker semantic validation retain all
  model/parameters/report totals and accepted-reference joins. References
  remain full values when materialized at2080; do not strip diagnostic payload.
- Encode/write1675–1685, materializeReport1994 and result/report2080 retain
  exact report bytes, manifest routing, archive/copy plan behavior and errors.
  Files.schemas/index barrels publicly reexport this schema and codecs;
  internal worker services stay on their existing surfaces.
- files-command.test.ts492/564 actual worker fixtures,2731 over-count failure,
 2915 duplicate-name failure and Python synthetic collect_references tests
  retain complete rows. No successful custom fixture installs a contradictory
  rejected reason/score combination; schema permissiveness alone is not proof.

# Guard-deletion accounting

Remove independent decoded accepted/reason/score fields and the source-level
accepted-reference guard1279 that must coordinate score and absent reason.
Replace rejected reason-presence guard1290 with a case-owned reason, preserving
its typed failure mapping at the actual input boundary. Replace outer
Bool.match1309 with schema case matching. Required faceCount and path/duplicate
checks remain because they validate independent full payload semantics; do not
claim their removal just because the cluster is tagged.

Do not claim the whole rejected-reference helper can disappear unchanged:
its aligner-specific faceCount guard1295 must remain or become an equivalent
named case constraint with the same diagnostic path. Do not count Python's
branching over actual detector outcomes as redundant Boolean coherence logic.

# Encoded-side impact

Tier2 singleton across the repo-owned worker/report protocol. Preserve flat
worker JSON and PersonMatchReport version/keys/order/omissions, all six reason
strings, full confidence scores, integer counts, names/paths, reference order,
model/parameter/embedding payloads and exact typed error behavior. Both decode
and encode are mandatory; no new tag appears on stdout or persisted JSON.

The current TypeScript rejected-reference guard is weaker than the Python
producer grammar; it is not sufficient by itself to prove all reason/score
tuples are supported. Before implementation, positive fixture/consumer review
must continue to distinguish a real alternate writer from permissive schema
acceptance. Any discovered supported additional tuple changes the target case
set and count; it must not silently become a new rejection.

Use local Effect v4 Schema.ts5366–5382 decodeTo with SchemaGetter decode and
encode, and tagged APIs6105/6255. Avoid v3 transforms, ad-hoc type assertions
or an always-true opaque schema for face/reference payloads.

# Test impact

Round-trip all7 legal reason-specific shapes, with present numeric0 where
FaceDetectionConfidence allows it, ordinary confidence values, full names/path
strings and the exact count for each worker branch. Verify old/new stdout and
report bytes and required omitted keys. Reject other21 abstract combinations
through the correct existing error boundary, and retain malformed count/path,
excess-property, duplicate accepted-name and model/parameter mismatch fixtures.
Retain synthetic aligner/image/embedding failure tests and accepted order.

No Python or TypeScript tests ran during this audit. Implementation must run
focused worker/Files protocol tests plus mandatory package verification after
independent design review; no user media/model execution is required for these
synthetic compatibility fixtures.

# Risk

The risks are losing a rejection literal, constraining a supported score/count
payload, or changing where a typed diagnostic is produced. The full7-case
protocol map and bidirectional byte fixtures address these risks. No separate
reason-pair record is created. Parent integrates this provisional against the
stable row and obtains replacement independent P3 before any product change.

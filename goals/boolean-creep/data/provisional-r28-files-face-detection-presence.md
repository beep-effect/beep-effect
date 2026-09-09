# DetectFacesEntry complete presence provisional

Stable id `files-face-detection-presence`; source
`packages/tooling/tool/cli/src/commands/Files/internal/DetectFaces.schemas.ts169–189`.
Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Native P2 only. Current design and
archives remain unchanged. Source hashes/constructor inventory are bound in
`data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md`.

# Current shape

The public DetectFacesEntry class owns hasFace plus optional primaryFace,
primaryFaceAreaPct, movedNoFaceName, movedNoFacePath and movedNoFaceRelativePath.
FaceCount/faces/flags are required payloads; there is no stored face-array-empty
Boolean. Source identity, extension, image dimensions and all face payloads are
required and preserved.

Analysis124–142 constructs initial detected/no-face entries. Its primary is the
ordered faces head and area comes from that face. Apply755–780 is a second
constructor copying full entries and adding all three move fields, called only
after the hasFace early-continue825–828. The move phase still returns the final
report only after preflight and actual moves. Generic schema acceptance does
not establish a supported moved detected entry or partial move triple.

# Cardinality gap

One Boolean and five real optional fields yield **64** combinations. **3** are
supported: detected owns both primary fields and no move triple; no-face-unmoved
owns neither; no-face-moved owns the complete triple and no primary. Required
faceCount and array emptiness are not factors; their values remain exact
payload coherence laws. Flags remain an ordered required payload, not another
finite axis. The minimal cluster cannot drop the move fields because their
only writer is gated by this same hasFace value.

# Target schema

Define one named `FaceDetectionDisposition` LiteralKit with `detected`,
`no-face`, `no-face-moved`. Use these literals in named schema cases and
S.toTaggedUnion. Detected owns the complete ordered nonempty faces vector and
primary/area payload; no-face owns empty faces, and moved no-face also owns
full target name/path/relative-path strings. Keep shared source identity,
extension, width/height and independent quality data. Preserve exact count and
primary-head correspondence, deriving redundant encoded fields from their
single payload source rather than keeping Boolean aliases.

Retain the public entry/report names through a legacy flat encoded schema and
explicit bidirectional transformation to the new decoded cases. Incoming
legal flat entries preserve full face data, area values, flags and omissions;
outgoing encoding emits the exact old fields in the old order. Partial primary
or move groups and contradictory hasFace/move groups fail through the actual
schema error channel. Required count, primary-head and flag checks remain
payload validation, not claimed finite Boolean evidence. Do not normalize
unexpected input into another legal case or default missing numeric fields.

# Migration inventory

- DetectFaces.schemas.ts169–189,265–317: implement cases and flat codec in
  the schema owner; entry/report public exports via Files.schemas.ts35 and
  Files/index.ts37 continue. Preserve schema version and codec names.
- Analysis64–91/104–142: construct one case from the same detector result,
  preserving full ordered faces, exact computed area and quality flag order.
  Source detector request/error mapping and dimensions stay unchanged.
- Apply755–780: replace the rebuilding constructor and two primary optional
  spreads with a no-face-to-moved-no-face transition. It accepts an actual
  no-face case; target names/paths remain exact, not recomputed at encoding.
- Apply792–860: keep None destination early return, target-directory creation,
  unique name planning order, face early-continue, all preflight checks before
  any rename, progress/concurrency settings and error behavior. Match detected
  versus either no-face case and preserve idempotent source semantics.
- Files.service2118–2200, especially2166–2168: collect ordered entries, execute
  optional moves, count detected/no-face/moved using cases, construct the same
  report and write the same manifest. Required counters remain numeric.
- Files.render264–277 and report rendering/writing509–550: match case for
  optional area and moved suffix, retain existing flags and exact text. Public
  media reexports of renderDetectFacesEntry remain stable.
- Whole-source search of hasFace/primaryFace/movedNoFace fields finds only
  these changing entry readers. ImageAudit's similar primary fields are a
  different owner and stay unchanged. Public package schemas/test exports
  are retained; unknown external caller completeness is not claimed.
- Files command synthetic detector/no-face move/multiple-face/area/flag/report
  fixtures in files-command.test.ts retain complete payload and order assertions.

# Guard-deletion accounting

Delete decoded hasFace and five independent optional fields; construct cases
instead of Analysis's primary optional spreads. Delete Apply761–762 Option
reconstruction and774–775 optional spreads and replace its hasFace dispatch
with case matching. Replace service2166–2168 three queries and renderer267/272
optional payload reconstruction with exact case reads. These are actual
construction/selection sites. There is no existing five-way coherence guard
to claim deleted: new codec validation must not be misreported as old guard
removal. Count required face-array/count/flag payload constraints separately.
Keep face detector validation, move preflight, unique name and safety guards.

# Encoded-side impact

Tier2 singleton. Preserve exact DetectFacesReport version, flat entry keys and
order, omitted optional keys, full face vector/primary payload, area/counts,
flags and their order, dimensions, names/paths, manifest bytes, summary counts,
JSON output and human suffix formatting. Both decode and encode are required:
a tag must never leak through generic JSON formatting or raw object spreading.
Audit the actual report encoder and any command renderer to ensure it receives
the legacy encoded projection. Empty strings remain strings where presently
accepted; do not invent nonempty path/area defaults.

Local Effect v4 Schema.ts5366–5382 supplies decodeTo with explicit
SchemaGetter decode AND encode;6105/6255 provides tagged unions. Use the local
reference, named schemas, existing LiteralKit conventions and derived guards.
Do not use v3 transform signatures or attach an always-true payload validator.

# Test impact

Add bidirectional fixtures for all3 complete cases, including full moved name,
absolute/relative path strings and nontrivial ordered face payloads. Compare
old/new report bytes, key omission, output order and human text. Reject the
other61 presence combinations at the compatibility boundary, plus existing
payload-incoherent count/head/flags cases without altering supported values.
Retain missing destination, no-face and mixed batches, collisions, failed
preflight, ordered moves, progress, synthetic detector errors and report writes.
No tests ran here; focused Files tests and full repo-CLI verification are
implementation obligations after independent review.

# Risk

The main risk is dropping the second constructor and its complete move triple,
or changing preflight-before-move behavior. Handle all actual writers in one
Tier2 singleton, with the exact legacy projection and full synthetic fixtures.
Do not create a separate move-pair census row that duplicates this owner or
remove required arrays merely to make its cardinality appear smaller.

# Instance

- id: `files-person-reference-disposition`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.schemas.ts:1258`
- symbol: `PersonMatchReference`
- members: `accepted`, `reason`, `detectionScore`
- evidence: E1/E2 at `python/photo-face/beep_photo_face/worker.py:739-803`
  and `MatchPerson.ts:1276-1312` define and validate three presence shapes.

# Current shape

The repo-owned Python worker produces the application protocol. TypeScript
decodes, validates, embeds, encodes, and writes it in PersonMatchReport. This is
therefore not D2 external mirroring. Rejections always own a reason; one-face
embedding rejections also have a score; acceptance owns a score and no reason.

# Cardinality gap

Three presence bits represent eight combinations and three are legal:
rejected-without-score, rejected-with-score, and accepted-with-score.
`faceCount` further refines reason cases but is retained as case payload.

# Target schema

Define a `PersonReferenceDisposition` tagged union. Split rejection reasons by
their worker contract: unreadable-image, aligner-confidence-failed, no-face,
and multiple-faces own no score; missing-embedding and invalid-embedding own a
detection score; accepted owns score and no reason. Retain source identity and
faceCount. Decode/encode the existing flat worker/report JSON.

# Migration inventory

- `MatchPerson.schemas.ts:431-450,1254-1266` — reuse rejection literals and
  introduce the union/compatibility codec.
- Python writer `worker.py:730-803` — migrate protocol construction only when
  implementing both sides; preserve messages, reason strings, rounding,
  reference order, embeddings, and names.
- `MatchPerson.worker-service.ts` worker stdout decode path and
  `MatchPerson.ts:1258-1331` — match cases while retaining path uniqueness,
  face-count constraints, and accepted-name counting.
- `MatchPerson.schemas.ts:1593,1772-1836` and
  `MatchPerson.ts:1675-1685,1994-2090` — preserve nested worker/report schemas,
  final manifest encoding, and writes.
- Python synthetic tests and `test/files-command.test.ts:1750-2100` retain all
  rejection/acceptance paths and orchestration output.

# Guard-deletion accounting

Delete decoded accepted/reason/detectionScore option coordination and the two
TS accepted/rejected coherence helpers. Tagged cases replace them. Keep path,
duplicate, faceCount, embedding, and report-wide validation.

# Encoded-side impact

Tier 2 persisted protocol, not D2. Preserve worker JSON and PersonMatchReport keys, omissions,
reason literals, scores, counts, ordering, and errors. Both Python and TS are
repo-owned ends of the same compatibility boundary.

# Test impact

Round-trip all reason families and acceptance; reject the other five presence
patterns. Retain Python worker tests, TS decode validation, path security,
manifest materialization, and render tests. Use synthetic fixtures only.

# Risk and sequencing

Land as one cross-language Tier 2 change with old-wire compatibility. Do not
change model execution, embeddings, or user media behavior.

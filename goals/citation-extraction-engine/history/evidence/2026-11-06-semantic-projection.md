# Builtin models to semantic Citation

The private extraction models now project legal meaning through the existing
public domain Citation structured codec. No redundant wire hierarchy is added.
All eight builtin families retain textual components and legal metadata;
occurrence coordinates, Document attachment, inferred numeric year and runtime
telemetry stay outside the semantic value. This operation is not an inverse
codec for Python objects and does not close native Unicode or alias laws.

## Publication identity

The runtime asset derives solely from the sealed, reviewed P0 vocabulary mapping
with SHA-256 b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5.
It preserves all 2,533 edition identities, including 1,362 case editions, and the
public version crv1:f353e51400a5:fad63b383b92. Case editions use reviewed ReporterId
bindings. Law and journal editions retain their own families without invented
case reporter identities. Runtime code imports public vocabulary APIs, never
test schemas or generated vocabulary internals.

The runtime asset SHA-256 is
9e3e5f9539e13f0cfce17489ece472686e11c9ccc446ba7d71319d8680c0dba8.
Installation authenticates its bytes, current public version, complete unique
identity count and public reporter membership. Missing or wrong-family editions
fail without a partial semantic citation. Candidate order and multiplicity follow
original exact editions followed by variation editions. Selected edition remains
independent data. Court text becomes a known identity only after public lookup;
unmatched text remains explicit unmapped data.

## Field and resource behavior

Projection uses the existing native Unicode owner and reserves each emitted text
value against the enclosing budget before conversion. It omits only numeric
pincite coordinates from metadata conversion. The original text year remains
text even when the private inferred numeric year differs or is absent. Optional
source-created short-case plaintiff is added to its domain metadata codec:
missing, explicit null and text remain distinct through decode and encode.

The original import-time shortcut projects its legal components, textual 2021
year and additional text, empty publication candidates and absent selected
edition. Its out-of-source span grants no occurrence/mention authority.

## Verification and limits

Five focused tests pass in 1.41 seconds. They compare legal fields in all 80
captured pre-filter models from the sealed extraction-loop corpus across all
eight families, component text, candidate order and selected editions. These
ASCII source models are reconstructed only for projection; this test does not
rerun parsing, validate occurrence spans or prove arbitrary Unicode fidelity.
All 2,533 runtime identities are compared with the independent original P0
mapping. Tests also cover artifact corruption, family confusion, missing local
editions, unmapped court text, the original shortcut, structured-codec roundtrip,
short plaintiff absence/null/text and exhausted enclosing capacity. No native
child is started by projection.

The portable verifier validates complete ordered equality with the sealed source
and exact producer hash; five corruption controls reject omitted/reordered rows,
changed ReporterId, an extra guessed field and stale producer identity. A fresh
export is byte-identical to the committed runtime artifact.

Package quick lint/type/test checks, declaration emission, blocking package
laws and codec-compilation lint pass. Scoped Fallow reports no findings for the
two new production modules; that scope is not a whole-repository quality claim.
Hosted checks for this wave remain pending at publication. The spelling checker
ignores only hexadecimal ReporterId field values in this generated asset;
provenance remains checked and the dedicated identity verifier covers every row.

Reproduction:

```sh
python goals/citation-extraction-engine/ops/verify-semantic-editions.py --self-test
python goals/citation-extraction-engine/ops/export-semantic-editions.py \
  --output .beep/semantic-editions-reproduction.json
cmp .beep/semantic-editions-reproduction.json \
  packages/law-practice/server/assets/citation/semantic-editions.json
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationSemanticProjection.test.ts
```

Public service/Layer composition, source identity and verified mention adaptation,
Bluebook transforms, broad host/subclass/equality/mutation/alias behavior,
exhaustive canonical/donor accounting and whole-engine safety/scaling remain
open. All eleven representation laws, four fidelity questions and fifteen
unfinished proof rows remain open without a semantic waiver or completion claim.

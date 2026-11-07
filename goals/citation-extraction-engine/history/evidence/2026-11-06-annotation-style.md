# Original style-tag proximity expansion

AnnotationStyle.ts now adapts maybe_balance_style_tags from the pinned eyecite
utils.py. The private captured balancer accepts an owned native source and
prepared integer bounds/tolerance. It checks the literal i, em and b tags in the
original order, extends toward the first closing or last opening literal within
the original search windows, and returns adjusted signed coordinates plus a
lossless native slice. Uppercase tags and tags with attributes retain the
original literal behavior rather than being treated as equivalent names.

The original helper computes membership from the initial span once. It does not
refresh that view when an earlier tag changes either endpoint. The target
retains that detail while using the current endpoints for each subsequent
search window. Negative tolerance and Python's independently normalized slice
endpoints retain original results, including reversed/outside intervals and
negative raw-coordinate arithmetic.

## Shared native primitives and allocation

PythonUnicode now owns the shared normalized slice-bounds schema/helper; existing
annotation assembly consumes it directly rather than retaining a second local
normalizer. A cooperative native literal search returns the first/last match
relative to the normalized slice. It uses the existing native point comparison
and replacement matcher, with a common first-point check, without projecting
literal surrogate words or retaining an array of all matches. Last-match lookup
searches backward and returns directly. Scans yield between bounded point runs.

The style helper borrows initial and candidate ranges, materializing only its
final returned slice. The captured CitationTextBudget reserves exact measured
UTF-16 units before that allocation. Failure is reconstructed with operation
annotate and the original exhausted limit. Structural decoding alone grants no
source ownership or allocation capability. The caller retains operation
admission, Scope, prepared integer validation and its captured deadline.

## Original source and proof

probe-annotation-style.py invokes the clean detached official source using
Python 3.11.15. Its 685 cases include 525 explicit combinations of source,
bounds and tolerance plus 160 seeded mixed-tag cases. Inputs include empty and
reversed spans, repeated/mismatched/nested tags, attributes and uppercase names,
NUL/newline content, native-width distinctions, astral scalars and
literal lone/adjacent surrogate points. Expected coordinates and native result
bytes come only from the original helper. A fresh replay is byte-identical.

- Oracle: 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e.
- utils.py SHA-256:
  8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e.
- Producer SHA-256:
  0e13344df5eea8f04867b49cd70cb669304d576baec5f677b4409d3778f44712.
- Fixture SHA-256:
  05639fb7db1d6c30ec48b09f582ba8e318f3fa40db80233f5a0b2124a5acc39e.

Sixteen tests across four files pass in 8.13 seconds: all 685 source style
observations, exact/refused style allocation, annotation ordering/mapping/output,
actual Bun/Node source-map workers, native Unicode and literal composition.
The style budget control refuses a ten-unit expanded result against nine units
without a successful charge, then succeeds at exactly ten. Server lint/type
checks, declaration emission and blocking laws pass. Emitted signatures retain
closed errors, R=never and typed optional boolean/number arguments. Scoped
Fallow passes with zero introduced findings and nine inherited nonblocking clone
groups, without changing its policy, baselines or thresholds. Hosted confirmation
for this new increment remains pending.

```sh
"$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-annotation-style.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" --output /tmp/annotation-style.json
cmp /tmp/annotation-style.json \
  packages/law-practice/use-cases/test/fixtures/eyecite/annotation-style.json
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationStyle.test.ts \
  test/CitationAnnotationAssembly.test.ts test/CitationPythonUnicode.test.ts \
  test/CitationLiteralUnicodeComposition.test.ts
```

This implements proximity expansion, not XML well-formedness checking. The
source skip branch still needs that parser check before and after expansion;
wrap replacement semantics, custom annotators, full dispatch/service/Layer and
whole-operation safety/scaling remain open. General host/numeric protocol
behavior is not qualified by the prepared integer cases. No source/donor row or
representation/fidelity proof is promoted. All eleven representation laws,
four fidelity questions and fifteen unfinished proof rows remain open without
a semantic waiver.

# Original annotation ordering and source-map composition

AnnotationPreparation.ts now orders primitive annotation tuples with Effect
Array.sort and Order.Tuple. Signed start/end positions sort first, then before
and after strings compare in Python native code-point order. The native string
comparison preserves astral/scalar and literal-surrogate distinctions that
JavaScript UTF-16 lexical comparison would reorder. Equal keys retain the
upstream stable sort. No second sorting algorithm is introduced.

The preparer checks the replacement ceiling before sorting or mapping, then
applies an optional captured updater in sorted order: starts use right and ends
use left, exactly as annotate_citations. Original tuple order is not re-sorted
after mapping. The existing SpanOffsets owner supplies all lookup behavior;
this adds no competing offset table or diff implementation. Inputs must be
trusted immutable owner values. The optional updater is server composition,
not a callback-valued request field or proof obtained from structural decoding.

## Actual default map construction

The existing HtmlGeometryPreparation forward placeholder/diff sequence now has
one shared helper. Annotation's changed nonempty source branch can run that
helper and construct the existing SpanOffsets index. It needs one placeholder
regex child and one exact native diff child. The existing Document path reuses
the same helper, then continues its original backward diff and emphasis scan.
Source order, four Document children and worker retirement are preserved.

The supplied-updater path skips map construction; it sorts/maps through the
already captured index. The enclosing operation still owns admission, Scope,
text allocations and deadline. Final raw annotation dispatch must apply the
original source truth/equality guards; this helper is the changed-source branch,
not a claim that all entry paths are integrated.

## Source and verification

The existing 214-case corpus now feeds original unsorted tuples into the target
preparer. Every target sorted tuple sequence matches the recorded original
Python sequence before the unchanged annotation assembly/output comparison.
This includes zero-length insertion ties ordered differently by UTF-16 and
Python points.

probe-annotation-mapping.py invokes the clean pinned oracle, Python 3.11.15 and
four-byte fast-diff-match-patch 2.0.1. Thirty-six new cases capture 54 exact mapped
tuples and original output. Every implicit map result is independently compared
to the original explicitly supplied SpanUpdater result. Cases include inserts,
deletions, markup boundaries, negative/outside/reversed spans, astral text and
literal lone/adjacent surrogates. Fresh replay is byte-identical.

- Oracle: 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e.
- annotate.py SHA-256:
  974bcabb0e7d608540732c42a5f3bf40b2616110bd1aca3d8bc7f09ed044af91.
- Producer SHA-256:
  3fd3ce696955892e699483f13b0383aa9302c04448ffac4d05bd6f2c16a883ed.
- Fixture SHA-256:
  15562e5666859ab936a10c3f0f48e8d6cf665b60b3d11a5b244d915392353d30.

Seven tests across annotation assembly and existing HTML geometry pass in
10.91 seconds. All 36 mapped tuple/output cases replay through the existing
index. Six representative default-map cases also execute actual placeholder
and diff workers on each of Bun and Node, with twelve acknowledged child exits
per runtime and released operation/native permits. The full Document regression
retains both map directions and emphasis output. After strengthening producer
runtime/version metadata, the focused mapped-corpus check passes again.
Server lint/type checks, declaration emission, blocking laws and scoped Fallow
pass. Fallow reports zero introduced findings and nine inherited nonblocking
clone groups; no baselines, thresholds or suppressions change. New-head hosted
qualification remains pending.

```sh
"$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-annotation-mapping.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" --output /tmp/annotation-mapping.json
cmp /tmp/annotation-mapping.json \
  packages/law-practice/use-cases/test/fixtures/eyecite/annotation-mapping.json
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationAssembly.test.ts \
  test/CitationHtmlGeometryPreparation.test.ts
```

## Remaining acceptance

This qualifies primitive tuple ordering and mapped unchecked assembly, not
arbitrary host comparisons, lazy annotation iteration, custom annotators or
HTML skip/wrap balancing. Effect's synchronous tuple sort still requires final
whole-engine timing/isolation/scaling qualification; this increment does not
claim responsive interruption through an adversarial long native comparison.
Complete raw dispatch, public service/Layer, port/native failure translation and
verified annotation evidence remain open. All eleven representation laws, four
fidelity questions and fifteen unfinished proof rows remain open without a
semantic waiver or accounting promotion.

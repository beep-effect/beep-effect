# Original unchecked annotation assembly

The pinned eyecite annotate_citations implementation now has an executable
native-text assembly component in AnnotationAssembly.ts. It adapts the original
zero/overlap/partial/reversed/outside-range behavior and Python slice semantics,
using existing native Unicode ranges and concatCitationPythonRanges. It does not
project source text through JavaScript strings or duplicate the diff kernel.
Effect MutableList holds borrowed ranges and Effect yields between replacements.
The enclosing operation retains admission, Scope, immutable input ownership and
its captured deadline. Only final native output is materialized by this helper.

The helper captures CitationTextBudget and checks replacement/source ceilings.
Exact output and growth ceilings are checked against the measured receiving
layout before allocation, then the same units are reserved from the parent.
Parent budget failure is reconstructed with operation=annotate, without private
causes. No partial output is returned. Prepared native inputs are trusted owner
values; decoding a replacement schema alone grants no ownership or source proof.

## Original source and reproduction

probe-annotation-assembly.py requires the clean detached official commit and
tree, Python 3.11.15, and invokes original annotate_citations for expected output.
It captures original tuples and independently sorted tuples without modifying
source execution. Its 214 cases include 54 explicit edge cases and 160 seeded
cases, with 719 annotations. Inputs include empty/reversed/outside/overlapping
spans, zero-length insertions, tuple ties, NULs, combining/fullwidth text, astral
scalars, lone surrogates and literal adjacent surrogate code points. Native byte
storage preserves distinctions lost by ordinary JSON string round-trips.

- Oracle commit: 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e.
- Oracle tree: a35a58fac03400f71a93a93485b77f1d56f2b02f.
- annotate.py SHA-256:
  974bcabb0e7d608540732c42a5f3bf40b2616110bd1aca3d8bc7f09ed044af91.
- Producer SHA-256:
  77fb9a01de8284f7fedf57c2f62034da8019c805212ee1e66a952abdfc0e2ee6.
- Fixture SHA-256:
  75a32d0456d6ff8e1237a5413f0a007eeb5cb29e6ce6fd7d6e54e0bb67722ecb.

A fresh second execution produces byte-identical fixture output. The target test
checks the fixture digest and source/producer metadata before executing every
original sorted tuple sequence. This establishes assembly only: the target
sorting implementation is not inferred from the source-provided sorted tuples.

## Verification and limits of proof

Two target tests pass in 2.96 seconds. One replays all 214 source outputs. The
other checks output, growth and cumulative-parent refusal without any successful
charge, then proves exact-boundary success with five reserved units. An initial
budget test exposed the generic parent's extract label; the component now
reconstructs the annotation operation while preserving the exhausted limit.
Server lint/type checks, declaration emission and blocking laws pass. The scoped
Fallow check passes with zero introduced findings and nine inherited nonblocking
clone groups, without baseline or policy changes. The new receipt passes Markdown
lint; the existing source-ledger tables retain twelve pre-existing line-length
findings. Hosted qualification of this new increment remains pending.

```sh
"$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-annotation-assembly.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" --output /tmp/annotation-assembly.json
cmp /tmp/annotation-assembly.json \
  packages/law-practice/use-cases/test/fixtures/eyecite/annotation-assembly.json
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationAssembly.test.ts
```

The component deliberately takes prepared ordered tuples and executes only the
unchecked/default-concatenation branch. Target tuple sorting, source/markup offset
mapping, skip/wrap tag handling, custom annotators/host payloads, lazy iteration,
public request/service/Layer, verified annotation evidence and complete operation
safety/scaling remain required. It accepts no mode that it silently ignores.
No canonical/donor row or representation/fidelity proof is promoted. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open without a semantic waiver.

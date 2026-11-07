# Public engine replay of original extraction observations

The original pinned extraction-loop corpus now runs through CitationEngine.extract
installed by the real CitationEngineLive Layer. No expected source observation or
production behavior is changed. A shared test installer retains authenticated
production parser/helper configuration and coherent captured service owners.
Both corpus entrypoints supply Effect platform crypto, including SecureRandom;
the initial missing-service failure was test-layer composition, not a semantic
comparison result.

## Independent comparisons and limits

The focused replay selects original rows 4, 14, 18, 20, 22, 26 and 32. Together
they cover all eight canonical citation families, short/Id./supra/reference
forms, statutes, regulations, journals, non-BMP Unicode and HTML cleaning.
Each operation compares citation kinds and token components against original
source observations, selected plain text against original source text, and
primary/full spans against independent Python-point to UTF-16 conversion.
Diagnostics must contain no unverified citation/component for these cases.
Report semantic/verified counts match original expected counts. The eyecite
shortcut separately retains its unverified semantic result without launching
native children. Source resolution observes the enclosing admission; every
launched child has confirmed exit and all admission is released.

Document resolution completion and mention-count coherence are checked, but
are not independent expected-group equality. This replay does not compare every
metadata field or establish exhaustive extraction/resolution parity. Existing
private semantic tests reuse the same unchanged kind/component assertion.

## Validation

After the complexity refactor, both focused corpus tests pass again in 86.89
seconds. The preceding combined run passes four tests in 99.62 seconds: focused seven-document public corpus replay
on Bun and Node, plus the existing all-four-operation Layer regression on both
runtimes after extracting their shared installer. Package lint and types pass. Blocking package laws pass; scoped Fallow passes
with zero introduced findings and nine inherited duplication groups. The
per-document replay is factored separately after Fallow identified complexity
in the initial combined test function; no threshold or baseline is changed.
The full original 36-document replay is registered for both runtimes in the
integration suite, with a ten-minute per-runtime ceiling. It has not been run
locally; hosted integration results remain required before claiming it passes.

```sh
cd packages/law-practice/server
bunx --bun vitest run test/CitationEngineCorpus.test.ts \
  test/CitationEngineLayer.test.ts
cd ../../..
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
```

All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open. Retained-document/general-host behavior, independent
whole-engine resolution/metadata comparison, lawful transforms, safety/scaling,
source/donor dispositions and deployment/lifecycle qualification remain required.

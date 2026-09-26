# Markdown wave preparation

The isolated codex/effect-vitest-md lane starts at main fb5b01146f. Markdown is
a downstream modeling package of HTML; preserve the HTML-first publication
order while PR #1279 remains open. No production source repair is admitted.

The existing five-file inventory is retained. Comparing its frozen d9f74d230a
source with this base found only the two Arbitrary import-path changes in
Md.test.ts and Md.conformance.test.ts; the other three test files are identical.
This is a per-package source reconciliation, not a new repository census.

The current Node baseline passes 72 tests with zero failed/pending, whole command
5.688s, stable source/manifest/lock hashes. Runtime, load, pressure and limits are
retained in the timing context. The older digest's 71-case run is historical and
is not silently substituted for this current configuration's 72-case baseline.
No performance conclusion follows from the different configurations.

Existing resource review items concern real authored conformance ledger/source
reads, which must stay real. The property item concerns the two native generated
laws without explicit fcRuns options. A bounded Codex gpt-6-astra medium review
is preparing exact helper/property migration guidance, with no source-edit
ownership; the parent owns proofs and Git. D12 order, original assertions,
recursive domains, node budgets, hostile fixtures and run floors remain binding.

The untouched-package baseline proof completed successfully: audit 26.2s and
docgen 7.9s (private md-before-package.log). This establishes a green starting
point before any test migration. Current test sources and manifest remain
unchanged. The Codex preparation review is still in progress and has not yet
supplied a complete migration plan; do not treat its preliminary count as
implementation or ledger closure.

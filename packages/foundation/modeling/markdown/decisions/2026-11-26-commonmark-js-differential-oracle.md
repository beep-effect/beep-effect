---
title: commonmark.js 0.31.2 is a test-only differential oracle with one shared normalizer and no skip list
date: 2026-11-26
reversal: Drop the differential suites, or admit a skip list of disagreeing inputs, or compare raw HTML bytes.
governs:
  - test/support/oracle.ts#renderOracleHtml
  - test/oracle.property.test.ts#renderOurs
  - test/oracle.property.test.ts#agreesWithOracle
  - test/internal/blockParser.property.test.ts#renderOurs
  - test/internal/inlines/inlineRefactor.oracle.test.ts#agreesWithOracle
enforcedBy: []
---

Our parser plus the test-only HTML writer are compared against commonmark.js 0.31.2, the reference implementation this engine ports, over the 652-example spec corpus and generated input. `commonmark` is an exact-pinned devDependency and never appears under `src/`: the product owns its engine. Both sides pass through the same `normalizeHtml`, so the suites assert semantic HTML equivalence, not byte equality.

Disagreement policy: the corpus wins. A generated input that disagrees is a bug in the engine or the writer, investigated and fixed, never skip-listed; no suite has a skip list. The one oracle defect is corrected per `oracle-empty-paragraph-corrected`.

Our side always parses with `dialect: "commonmark"`, because commonmark.js implements no GFM extension and the package default is `"gfm"`. A hardening-guard trip is not a disagreement: commonmark.js has no depth cap, so a guarded input is skipped. Generators draw fragments from the construct vocabulary, because unstructured unicode degenerates to one paragraph; the generated suites run under fixed seeds and high run counts, so each refactor of a pass is checked against the same large input set on every run.

Accepted limit: astral punctuation and symbols stay out of the emphasis generators, because the engine classifies flanking by code point (pinned in `emphasis-astral.test.ts`) where commonmark.js reads UTF-16 halves; the GFM digest in `inline-refactor-differentials` covers them. Raw HTML stays out of the link generator, because commonmark.js writes an inline tag inside an image's `alt` unescaped, a render difference rather than a parse difference.

Rejected: byte-equal HTML comparison, a skip list of known disagreements, per-run random seeds, and diffing our default GFM parse against the CommonMark oracle.

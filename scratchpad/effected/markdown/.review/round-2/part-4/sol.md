### sol-2-1

- file: scratchpad/effected/markdown/internal/inlines/rawHtml.ts:60
- class: perf   severity: required
- standard: D11’s measured-regression and algorithmic-class criteria; D9 and section 14 permit correcting this port-introduced regression.   evidence: The added `["<!", ">"]` precheck calls `scanner.hasAhead(">")` for every `<!` prefix, including invalid declarations such as `<!0`. `hasAhead` caches only unsuccessful searches, so a distant `>` causes every invalid opener to search the remaining suffix again. A read-only probe of the pinned lab and oracle constructs on `"x " + "<!0".repeat(n) + ">"`, using an equivalent instrumented forward search, counted **6,304 / 24,896 / 98,944** examined characters for **64 / 128 / 256** lab openers; the oracle made **zero** closer searches and rejected each opener directly through the regex. Full `parseBlocks` probes confirmed identical output. After one warm-up, median times over five calls were **21.94 / 3.55 ms** at 4,000 openers, **79.76 / 8.99 ms** at 16,000, and **139.01 / 12.68 ms** at 32,000, for lab/oracle respectively.
- failure: A paragraph containing invalid declaration prefixes and one final `>` gains Θ(n²) closer-search work where the oracle rejects those prefixes in Θ(n) total work. The recorded missing-declaration-closer optimization does not cover this case: the existing regression tests use valid `<!A` prefixes with no closer.
- fix: Apply the declaration closer precheck only when the opener matches the declaration grammar’s `<![A-Za-z]` prefix. Retain the separate comment, processing-instruction, and CDATA checks. Add an invalid-prefix regression with a distant `>` that verifies no declaration closer searches occur and preserves the parsed text.

### sol-2-2

- file: scratchpad/effected/markdown/internal/inlines/codeSpan.ts:22
- class: jsdoc   severity: required
- standard: `.patterns/jsdoc-documentation.md`, “Description and section grammar”: every section must be non-empty, and empty sections must not be added merely to fill out the shape; D11 includes JSDoc-law breaks as required.   evidence: Inspection of Git objects at `a12bef261998d2ad92153dada46373be06950692` found `**Details**` immediately followed by an Example section or tags, with no intervening content, at `codeSpan.ts:22`, `emphasis.ts:64`, `emphasis.ts:176`, `entity.ts:21`, `escape.ts:20`, `footnoteReference.ts:64`, `footnoteReference.ts:141`, and `lineBreak.ts:24`. These concrete grammar violations remain in the supplied docgen-green commit, demonstrating that the gate missed them. They are distinct from round one’s closed missing-example/category/since findings.
- failure: Eight exported documentation blocks contain empty Details sections, violating the binding grammar and leaving empty headings in documentation and IDE hovers.
- fix: Remove the eight empty `**Details**` headings and their padding. Preserve the lead descriptions, examples, and tags.

REQUIRED: 2
BACKLOG: 0
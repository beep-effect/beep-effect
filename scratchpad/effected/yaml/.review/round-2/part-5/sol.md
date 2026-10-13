### sol-2-1
- file: scratchpad/effected/yaml/internal/rules/indentation.ts:148
- class: bug   severity: required
- standard: D11; D9 §14 verified upstream bug; this rule’s documented sequence-placement policy.   evidence: Read-only probes against the port and pinned oracle show that `a:\n  - x\n` reports “Sequence under a mapping key should not be indented” with `{ spaces: 2, indentSequences: false }`, while `a: &ref\n  - x\n` and `a: !!seq &ref\n  - x\n` return no diagnostics. All three parse successfully to `{ a: ["x"] }`. With consistent mode, `a:\n  - x\nb: &ref\n- y\n` produces no diagnostic, and strict inference succeeds with `indentSequences: true` despite the mixed placement.
- failure: `opensKey` requires the last significant token to be `block-map-value`. An anchor or tag after the colon replaces that token as `lastKind`, hiding the mapping-to-sequence relationship from both checking and inference. Valid node properties therefore bypass an explicit policy and conceal style conflicts.
- fix: Track whether a block-value separator is followed only by node properties and trivia, with no same-line value content. Treat that case as an opening key. Add anchor/tag regressions for explicit policies, consistent checking, and strict inference; record the verified upstream-bug correction under §14.

### sol-2-2
- file: scratchpad/effected/yaml/internal/rules/indentation.ts:120
- class: bug   severity: required
- standard: D11; D9 §14 verified upstream bug; indentation.ts:12–14 and util.ts:186–192 promise to skip scalar continuations.   evidence: In both the port and pinned oracle, `a: first\n    second\n` parses successfully as `{ a: "first second" }`, but `{ spaces: 2 }` reports “Indent of 4 spaces, expected 2” on line 1. Observation also emits a four-space indentation vote. The captured composed scalar has `sourceMultiline: true`, `offset: 3`, and `length: 16`; the lexical stream instead contains separate scalar tokens for `first` and `second`.
- failure: The continuation test assumes a multiline scalar occupies one lexical token. The composer joins multiline plain scalars from separate tokens, so their continuation lines enter the block-indentation stack. This creates false diagnostics and trains inference on scalar-content indentation.
- fix: Use composed multiline scalar spans to exclude continuation lines in the shared `contentLines` path, collecting the spans once per context traversal. Retain token-based handling where it is sufficient. Add mapping-value and sequence-item regressions proving that continuation lines produce neither indentation diagnostics nor votes; record the verified upstream-bug correction under §14.

### sol-2-3
- file: scratchpad/effected/yaml/internal/rules/util.ts:169
- class: perf   severity: required
- standard: D11 measured regression versus pinned upstream; schema-first-development-prompt.md, Pattern 5 permits hoisting repeatedly used schema guards.   evidence: A read-only Bun 1.4.2 probe parsed a 5,000-scalar sequence once, then measured 100 `walkScalars` traversals per sample with identical counting callbacks. Five samples, in milliseconds: oracle `[1.93, 1.69, 1.68, 1.71, 1.88]`; port `[36.54, 37.73, 43.43, 45.17, 36.37]`. An in-memory control retaining schema guards but binding them once measured `[13.29, 12.58, 13.43, 12.32, 12.00]`. Parsing was excluded, and visitor counts agreed.
- failure: Every recursive visit creates fresh `S.is` closures for scalar/map/sequence dispatch. The median traversal time is approximately 22 times the oracle’s; hoisting alone reduces the port median from 37.73 ms to 12.58 ms. This affects truthy checking and quoted-string checking/inference.
- fix: Bind the three schema-derived guards once at module scope and reuse them in `walkScalars`. Preserve the existing schema semantics, traversal order, roles, and dual signatures.

### sol-2-4
- file: scratchpad/effected/yaml/internal/rules/key-duplicates.ts:53
- class: perf   severity: required
- standard: D11 measured regression versus pinned upstream; schema-first-development-prompt.md, Pattern 5.   evidence: A read-only Bun probe captured already-composed contexts containing 2,000 unique mapping pairs and measured 50 duplicate-key checks per sample, alternating measurement order. Five samples, in milliseconds: oracle `[8.85, 12.91, 7.29, 6.02, 6.38]`; port `[87.12, 87.96, 96.67, 79.72, 71.22]`. A control retaining the port’s `MutableHashSet`, key identities, and traversal while hoisting schema guards measured `[49.32, 56.24, 49.68, 47.65, 55.92]`. Parsing was excluded; all checks found zero duplicates.
- failure: The recursive walk repeatedly constructs map/sequence guards, and the pair loop constructs a scalar guard for every key. The port median is about 12 times the oracle’s; hoisting reduces the port median from 87.12 ms to 49.68 ms without changing the required Effect collection representation.
- fix: Hoist `S.is(YamlMap)`, `S.is(YamlScalar)`, and `S.is(YamlSeq)` once and reuse them throughout `walk`. Retain `MutableHashSet` and the existing key-identity semantics.

### sol-2-5
- file: scratchpad/effected/yaml/internal/rules/indentation.ts:75
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5 and D11.   evidence: `ContentLine` remains a named handwritten interface containing the pure-data payload shared by checking and inference: `line`, `indent`, `firstChar`, `indents`, and `opensKey`. It is neither a service contract nor type-level machinery. In particular, `indents` is declared as an unrestricted `ReadonlyArray<number>`, while lines 170 and 262 assume it is nonempty. The declared green compiler and four-law gates do not supply the missing schema model.
- failure: The shared structural payload’s type and invariants remain outside the required schema-first model. Its nonempty indentation progression is maintained only by procedural construction and unsafe indexed reads, rather than represented by its named data shape.
- fix: Define an annotated internal structural schema for `ContentLine`, derive its same-name type, and model `indents` as a nonempty collection of nonnegative integers. Preserve plain structural construction and existing runtime behavior.

REQUIRED: 5
BACKLOG: 0


### sol-2-1
- file: scratchpad/effected/yaml/YamlFormat.ts:1159
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-31; D11; section 14 verified upstream-bug   evidence: A read-only Bun probe called `modify` with source `"[".repeat(160) + "0" + "]".repeat(160) + "\n"`, path `Array(160).fill(0)`, and a replacement consisting of 160 nested arrays around `"x"`. Both the lab and pinned oracle returned an Exit containing `Die(StringifyDepthExceeded)`, rather than a typed modification failure. The document and replacement are each individually below the 256-level limit.
- failure: Replacement lowering starts its depth counter at zero. Inserting that value into an existing nested document can exceed the stringifier’s limit, contradicting this module’s assumption that lowering prevents every stringifier depth failure. Callers cannot recover through `Effect.catchTag("YamlModificationError", ...)`.
- fix: Wrap the final `stringifyDocument` call in targeted `Effect.try` handling that translates `StringifyDepthExceeded` into a `YamlModificationError` with a `NestingDepthExceeded` diagnostic and the echoed path. Preserve unexpected defects. Add the combined-depth regression and record the verified upstream-bug correction under section 14.

### sol-2-2
- file: scratchpad/effected/yaml/YamlLint.ts:691
- class: bug   severity: required
- standard: D9; D11; section 14 verified upstream-bug; `YamlLint.run`’s documented rule that absent config entries skip a rule   evidence: A read-only Bun probe supplied one custom rule with `id: "toString"` and `YamlLintConfig.make({ rules: {} })`. In both the lab and pinned oracle, its `check` callback ran once and returned one finding. A second probe inferred a custom option with dimension `"__proto__"` and value `"double"`; both implementations returned `{"custom":{}}`, losing the option.
- failure: Config lookups read inherited properties, so an unconfigured custom rule can run. The assignments at lines 588–589 also treat `__proto__` as a prototype setter rather than an ordinary rule or option key, silently discarding valid custom inference data.
- fix: Use own-property-safe Record lookups for rule entries and own-property-safe Record construction for both rule IDs and option dimensions. Add regressions for an absent `toString` rule and a preserved own `__proto__` option; record the upstream-bug correction.

### sol-2-3
- file: scratchpad/effected/yaml/YamlLint.ts:396
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; `StyleEvidence.combine`’s contract to aggregate by distinct `(rule, dimension, value)` tuples   evidence: In a read-only Bun probe, combining votes for rule `"a\u0000b"` / dimension `"c"` and rule `"a"` / dimension `"b\u0000c"`, both with value `"double"`, produced one tally with count `2` in both the lab and pinned oracle. The floor key at line 402 has the same ambiguity. These fields use unrestricted `S.String`.
- failure: NUL-delimited concatenation is not an injective tuple encoding. Evidence belonging to separate custom rules or dimensions merges, losing one identity and producing incorrect counts, floors, conflicts, and inferred settings.
- fix: Replace concatenated keys with nested Effect maps keyed separately by rule, dimension, and value, or an unambiguous tuple encoding. Preserve canonical output order and first-seen positions. Add vote and floor collision regressions and record the upstream-bug correction.

### sol-2-4
- file: scratchpad/effected/yaml/YamlLint.ts:440
- class: perf   severity: required
- standard: D11 algorithmic-class criterion   evidence: For `N` distinct vote values, `fromObservations` calls `combine` once per observation. Iteration `k` traverses and reconstructs all `k` accumulated tallies and sorts them again, giving at least `Ω(N²)` accumulated traversal work. A single histogram accumulation followed by one canonical sort requires `O(N log N)` expected work with hash maps. Bounded read-only probes with 1,000 and 2,000 distinct values took approximately 98 ms and 404 ms in the lab; the oracle showed the same inherited scaling. Required severity rests on the algorithmic-class improvement, not a claimed port regression.
- failure: Custom inference with many distinct values repeatedly rebuilds the entire evidence histogram. Collection migrations and hoisted guards do not remove this quadratic accumulation.
- fix: Accumulate vote counts, first positions, and maximum floors in local Effect maps throughout the observation loop, then materialize and sort the two arrays once. Retain the existing ordering, homomorphism, and first-position semantics.

### sol-2-5
- file: scratchpad/effected/yaml/YamlNode.ts:1005
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6; standards/effect-first-development.md EF-5; D5   evidence: The mapping extraction path still invokes native `Object.defineProperty` for a `__proto__` key despite the declared-green native-runtime gate. A read-only probe confirmed that `R.fromEntries([["__proto__", 1], ["constructor", 2]])` produces both own properties on an ordinary object, preserving the required prototype behavior.
- failure: Production value extraction retains a reachable native Object operation that the full beep-native contract requires replacing.
- fix: Accumulate mapping entries in traversal order and materialize the result with `R.fromEntries`, removing `setOwnProperty`. Preserve anchor registration order, duplicate-key replacement behavior, and the own `__proto__` property.

### sol-2-6
- file: scratchpad/effected/yaml/YamlLintRule.ts:101
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5   evidence: `LintLine` at line 101 and `LintContext` at line 129 remain handwritten interfaces containing only data fields. Their shapes are representable using the existing string, numeric, token, document, and array schemas. They are separate from the callable `YamlRule` extension contract.
- failure: These reusable lint payloads have no schema source of truth, runtime identity, field annotations, or schema-derived types. The green gates missed these remaining pure-data models.
- fix: Define annotated structural schemas for `LintLine` and `LintContext` and derive their types from those schemas. Preserve their current plain-object shapes and keep the callable `YamlRule` contract as an interface.

### sol-2-7
- file: scratchpad/effected/yaml/YamlLint.ts:660
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5   evidence: `YamlLintInference` is a handwritten payload interface containing `config: YamlLintConfig` and `residual: ReadonlyArray<YamlLintDiagnostic>`, both of which already have runtime schemas. `inferLenient` constructs this report as a plain object.
- failure: The public inference report remains outside the schema-first modeling contract even though all its constituent models are schema-backed.
- fix: Add an annotated `YamlLintInference` structural schema from the existing constituent schemas and derive the public type from it, preserving the returned plain-object shape.

### sol-2-8
- file: scratchpad/effected/yaml/YamlNode.ts:1088
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12b and EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5   evidence: `ExpansionBudget` remains a handwritten concrete payload with `count` and `limit`, reused by `defaultBudget`, `nodeToJsValue`, and the recursive extraction walk. It is a named internal model, rather than an overload or type-level utility.
- failure: The alias-expansion budget’s data shape and metadata are defined solely through an interface, leaving this internal model outside the required schema-first pass.
- fix: Define an annotated structural budget schema and derive its writable counter type from that schema. Preserve the current budget calculation, counting behavior, and accepted parse-option semantics.

### sol-2-9
- file: scratchpad/effected/yaml/YamlEdit.ts:22
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md operator revision step 4; standards/effect-first-development.md EF-12; D5   evidence: `YamlEditFailure` and the equivalent `YamlFormatInvariantFailure` at `YamlFormat.ts:57` have composer-derived identifiers but omit `$I.annote(...)` schema metadata and `message.annotateKey(...)` field metadata. A read-only overlap probe showed `YamlEditFailure` schema annotations containing only its generated identifier and tag sentinel; `fields.message.ast.annotations` was `undefined`.
- failure: These newly introduced error schemas received only identifier wiring, leaving the required schema descriptions and field annotations absent. Public docgen and the green gates did not catch the private error schemas.
- fix: Add meaningful `$I.annote(...)` descriptions and `message.annotateKey(...)` metadata to both invariant error classes, preserving their tags, messages, and throwing behavior.

REQUIRED: 9
BACKLOG: 0
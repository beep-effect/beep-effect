### sol-1-1
- file: scratchpad/effected/yaml/internal/rules/hyphen-spacing.ts:55
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug` established by a failing value-preservation property); the rule describes a spacing fix, while the lint pipeline promises surgical fixes.
- evidence: Read-only `bun -e` probes against both the port and pinned oracle reproduced this transformation: input `"-   - one\n    - two\n"` parses as `[["one","two"]]`; `YamlLint.fix` with only `hyphen-spacing` enabled returns `Success("- - one\n    - two\n")`, which parses as `[["one - two"]]`. Likewise, `"-   key: one\n    other: two\n"` changes from `[{"key":"one","other":"two"}]` to `[{"key":"one","":null}]`.
- failure: Removing spaces before a compact block collection moves its first entry without moving continuation entries. A successful lint fix changes the document’s value.
- fix: Retain the diagnostic but omit its fix when shortening the separator would move the start of a block collection with continuation entries. Keep the existing fix for safe scalar items. Add these value-preservation regressions and record the verified upstream-bug deviation before changing behavior.

### sol-1-2
- file: scratchpad/effected/yaml/internal/rules/indentation.ts:79
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); `contentLines` promises to skip document markers, and the rule promises to measure block indentation.
- evidence: In both the port and pinned oracle, `"outer:\n  ---key:\n    x: 1\n"` parses successfully. Running only `indentation` with `{ spaces: 2 }` reports `Indent of 4 spaces, expected 2` at zero-based line 2. Observation records a `spaces: 4` vote. Replacing `---key` with `...key` reproduces the failure; an ordinary key preserves the intermediate level and passes.
- failure: Prefix matching discards valid mapping-key lines beginning with `---` or `...`. This produces false diagnostics and incorrect inferred indentation.
- fix: Identify document markers through their token kinds, or require the complete marker and its legal boundary instead of matching arbitrary prefixes. Apply the correction to the shared `contentLines` path, add both regressions, and record the upstream-bug deviation.

### sol-1-3
- file: scratchpad/effected/yaml/internal/rules/indentation.ts:103
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); `indentSequences: false` must reject sequences indented beneath mapping keys.
- evidence: Read-only probes against both implementations used `"outer:\n  \"has # mark\":\n    - one\n"` with `{ spaces: 2, indentSequences: false }`. Parsing succeeds, but `YamlLint.run` returns no diagnostics and observation emits no `indentSequences` vote. The equivalent document with an ordinary quoted key reports the forbidden indented sequence.
- failure: The regular expression treats ` #` inside quoted scalar content as a trailing comment. It removes the mapping separator from the inspected text, so sequence-policy checking and inference silently miss the key-to-sequence relationship.
- fix: Strip actual comment tokens, or inspect the last significant token on the preceding line for the mapping-value separator. Add the quoted-key regression and record the upstream-bug deviation.

### sol-1-4
- file: scratchpad/effected/yaml/internal/rules/indentation.ts:126
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the documented `spaces` option measures each block-structure level, including mappings inside sequence items.
- evidence: With `{ spaces: 2, indentSequences: true }`, both implementations report `Indent of 4 spaces, expected 2` for `"outer:\n  - two:\n      child: 1\n"`. Expanding the compact item to `"outer:\n  -\n    two:\n      child: 1\n"` produces no diagnostics. Both parse to `{"outer":[{"two":{"child":1}}]}`. The compact form also produces conflicting inference votes of 2 and 4; the expanded form produces only 2.
- failure: The stack tracks line-leading indentation but omits block levels opened after a sequence indicator on the same line. A correctly indented compact mapping is rejected and incorrectly trains style inference.
- fix: Account for the inline mapping’s structural column when advancing the indentation stack, sharing that calculation between checking and inference. Add the compact/expanded regression pair and record the upstream-bug deviation.

### sol-1-5
- file: scratchpad/effected/yaml/internal/rules/util.ts:16
- class: schema   severity: required
- standard: Operator revision step 4 and D5; `standards/effect-first-development.md` EF-12 and EF-12c; `standards/effect-laws-v1.md` laws 17–18.
- evidence: Both `nonNegativeIntegerOption` and `positiveIntegerOption` lack composer annotations. A read-only `S.resolveAnnotations` probe returns no `identifier`, `title`, or `description` for either schema. Their custom filters’ `annotations` are also `undefined`, corresponding to the explicit `undefined` arguments at lines 17 and 30. These concrete omissions remain despite the stated green gates.
- failure: The shared exported constraints have no canonical schema identity or intent metadata, and their reusable validation checks lack the required metadata. Schema introspection exposes only generic finite-number annotations.
- fix: Create the file’s `$ScratchpadId` composer, annotate both exported schemas through the canonical composer helper, and supply identifier/title/description annotations to both reusable custom checks. Preserve their existing acceptance domain and failure messages.

### sol-1-6
- file: scratchpad/effected/yaml/internal/rules/line-length.ts:18
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-3: “For non-class schemas, export type aliases with the same identifier name as the schema value”; D11.
- evidence: Inspection found 12 exported non-class schemas across the focused files: the ten rule-options schemas plus `nonNegativeIntegerOption` and `positiveIntegerOption`. None has a same-name type companion; the only exported type alias in these files is `ScalarRole`. This is a standards obligation that the stated compiler and lint gates have not enforced.
- failure: The exported schema surface does not provide its required schema-derived type companions; consumers cannot use these identifiers directly as imported types.
- fix: Add `export type lineLengthOptions = typeof lineLengthOptions.Type` and the equivalent companion for each of the other 11 schemas. Record the added type exports in Port notes as required by D2.

### sol-1-7
- file: scratchpad/effected/yaml/internal/rules/util.ts:16
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements and Kind-split Example law; port contract section 10.2. Backlog classification follows the explicit S2 deferral.
- evidence: The focused files’ exported schemas, rules, and helper functions have descriptive comments but no canonical `@category`, `@since 0.0.0`, or titled `**Example** (Title)` sections. This includes the exported helpers in `util.ts` and both runtime exports in every focused rule file.
- failure: These exports do not meet the eventual documentation contract: runtime values lack compiling usage examples, and exports lack category/version metadata.
- fix: During S2, retain the upstream prose, add canonical categories and `@since 0.0.0`, and supply an observable compiling example for each value-level export. Pure type exports need metadata and useful prose; their examples remain optional.

### sol-1-8
- file: scratchpad/effected/yaml/internal/rules/util.ts:27
- class: test   severity: backlog
- standard: D10 and port contract section 11.4. Backlog classification follows the explicit S3 deferral.
- evidence: Searching the YAML tests for property registrations, `Arbitrary`, `fcRuns`, and the focused schema names found existing parser/inference properties, but no schema round-trip properties for the 12 exported rule-options and numeric-constraint schemas. The rule fixtures exercise examples rather than the required schema property floor.
- failure: The focused exported schemas lack the required encode/decode round-trip properties, leaving generated combinations of optional options and numeric boundaries outside that acceptance evidence.
- fix: During S3, add round-trip properties for these schemas using the contract’s schema-derived arbitraries, canonical `@effect/vitest` property idioms, and `fcRuns(n)`.

REQUIRED: 6
BACKLOG: 2


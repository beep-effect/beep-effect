### sol-1-1

- file: scratchpad/effected/yaml/internal/composer/scalars.ts:869
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); YAML block-scalar indentation semantics.   evidence: A read-only `bun --no-install -e` probe parsed `"outer:\n  key:\n    !<tag:yaml.org,2002:str>\n    |2\n    hello\n"`. Both this commit and the pinned upstream return success with `{ outer: { key: "" } }`; the installed `yaml` reference parser returns `{ outer: { key: "hello\n" } }` with no errors or warnings. Replacing the verbatim tag with `!!str` makes both implementations preserve the content.
- failure: `findParentIndent` mistakes a colon inside the verbatim tag URI for the mapping’s structural colon. It takes the tag line’s indentation as the parent indentation, computes an excessive content indentation, and silently discards the block scalar’s body.
- fix: Skip tag/property spans when searching backward for the parent’s structural `:` or sequence indicator. Add this regression and record the verified upstream-bug deviation under section 14.

### sol-1-2

- file: scratchpad/effected/yaml/internal/composer/flow.ts:72
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); this function’s stated comma-separation contract.   evidence: A read-only probe of `Yaml.parseResult("{foo: 1 bar: 2}\n")` returns success with `{ foo: "1 bar", "": 2 }` in both the port and pinned upstream. The `yaml` reference parser rejects the input with `BLOCK_IN_FLOW`. The validator increments `colonCount` but resets `contentAfterColon` at every `:`, so the second separator never triggers its error branch.
- failure: A flow mapping missing its comma is accepted, and the parser invents an empty-string key for the second value.
- fix: Detect a second structural value separator within an already populated comma-delimited mapping entry, while keeping nested collection separators scoped to their own CST nodes. Add the failing input as a regression and record the upstream-bug deviation.

### sol-1-3

- file: scratchpad/effected/yaml/internal/composer/flow.ts:90
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the flow-folding contract implemented by `collectMultilinePlainScalar`.   evidence: Read-only probes show that `Yaml.parseResult("{foo: multi\n  line}\n")` fails with `MalformedFlowCollection: Missing comma between flow collection entries` in both the port and pinned upstream. The `yaml` reference parser accepts it as `{ foo: "multi line" }`. The recovered composer AST already contains that correct folded value. The valid implicit mapping sequence `"[foo: multi\n  line]\n"` is also rejected.
- failure: The separator validator counts continuation fragments of one plain scalar as separate collection entries, turning valid multiline flow values into fatal parse failures.
- fix: Use the scalar collector’s continuation boundaries when counting flow values, so fragments of one folded scalar count as one value. Preserve rejection of actual missing separators, add both regressions, and record the upstream-bug deviation.

### sol-1-4

- file: scratchpad/effected/yaml/internal/composer/tags.ts:44
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); shorthand tag suffix resolution.   evidence: A read-only probe of `"%TAG !e! tag:yaml.org,2002:\n---\n!e!%69nt 123\n"` returns the string `"123"` in both the port and pinned upstream. The `yaml` reference parser returns the number `123`, with no errors or warnings. The otherwise equivalent `!e!int` spelling returns the number in all three implementations. The reference resolver explicitly concatenates the prefix with the percent-decoded suffix.
- failure: Percent-encoded shorthand suffixes are concatenated unchanged, so equivalent spellings resolve to different tags and different JavaScript value types.
- fix: Safely percent-decode shorthand suffixes before prefix concatenation, including the default secondary-handle branch. Report malformed encodings through composer diagnostics, add the equivalence regression, and record the upstream-bug deviation.

### sol-1-5

- file: scratchpad/effected/yaml/internal/composer/document.ts:783
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); directive validation’s malformed-input contract.   evidence: Read-only probes show that both the port and pinned upstream successfully parse `"%YAML nope\n---\nfoo\n"`, `"%TAG !!\n---\nfoo\n"`, and `"%TAG !e! tag:example.com,2020:a/ extra\n---\n!e!x bar\n"`. The `yaml` reference parser reports an invalid version for the first and requires exactly two `%TAG` parameters for the other two. Here `%YAML` validation checks only parameter count, and there is no corresponding `%TAG` arity validation.
- failure: Malformed directives are accepted without fatal diagnostics; missing or extra tag parameters and a non-version YAML parameter are silently ignored or used.
- fix: Validate the `%YAML` version token’s grammar and `%TAG`’s exact parameter count, emitting positioned `InvalidDirective` diagnostics. Add these regressions and record the upstream-bug deviation.

### sol-1-6

- file: scratchpad/effected/yaml/internal/rules/comments-spacing.ts:44
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); this rule’s distinction between own-line and trailing comments, and the retained BOM parsing contract.   evidence: A read-only `YamlLint.run` probe with only `comments-spacing` enabled returns no findings for `"# header\nkey: 1\n"`, but returns `Too few spaces before comment (0 < 1)` for `"\uFEFF# header\nkey: 1\n"` in both the port and pinned upstream. Its fix inserts a space at offset 1. The retained `Yaml.test.ts` test explicitly establishes that a comment immediately after a leading BOM is a line-start comment.
- failure: `spacingBefore` treats the BOM as preceding line content, misclassifies an own-line comment as trailing, and produces a false diagnostic and unnecessary edit.
- fix: Treat a leading BOM as non-content when deciding `hasContentBefore`. Add a BOM-prefixed own-line-comment fixture and record the upstream-bug deviation.

### sol-1-7

- file: scratchpad/effected/yaml/internal/composer/scalars.ts:103
- class: bug   severity: required
- standard: D9’s preservation of upstream call behavior; `.patterns/module-organization.md` dual-function contract.   evidence: The pinned upstream declares `resolveScalar(rawValue, style, tag?, state?)`. Read-only probes show that its two-argument call `resolveScalar("123", "plain")` returns the number `123`, and its three-argument call with `"!!str"` returns the string `"123"`. The port uses `dual(4, ...)`: the two-argument call returns a function, and the declared direct overload now requires both formerly optional arguments.
- failure: Existing two- and three-argument direct calls lose their original behavior and type compatibility. Internal callers passing all four arguments conceal the regression from the green tests.
- fix: Restore optional `tag` and `state` on the direct overload and use dispatch that preserves all upstream direct call forms. Give the curried form a distinguishable signature rather than requiring direct callers to pad optional arguments.

### sol-1-8

- file: scratchpad/effected/yaml/internal/composer/state.ts:198
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 6 and its Allowlist Contract; D5 and section 16’s prohibition on native maps in domain logic.   evidence: A read-only `createState` probe prints `anchors native true tagMap native true` for `state.anchors instanceof Map` and `state.tagMap instanceof Map`. Both initializers discard the `MutableHashMap` wrapper and retain `.backing`; composer consumers then call native `.has`, `.get`, and `.set`. The native-runtime detector recognizes native constructor expressions, so these property accesses evade the green gate. The recorded YAML anchor-map exceptions cover the public boundaries in `Yaml.ts` and `YamlDocument.ts`, not these composer-state maps.
- failure: The composer still performs its internal anchor and tag bookkeeping with native maps despite the apparent Effect collection migration.
- fix: Store `MutableHashMap` values in `ComposerState` and migrate their internal consumers to Effect map operations. Keep any necessary native conversion at the separately documented public boundary.

### sol-1-9

- file: scratchpad/effected/yaml/internal/composer/comments.ts:48
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 1; `standards/effect-first-development.md` EF-4’s required aliases.   evidence: This file imports `effect/Schema` as `Schema`, and `internal/composer/document.ts:34` does the same. The cited standards require the namespace alias `S`. These concrete declarations remain on the gate-green commit; the dedicated-path import requirement does not enforce the required alias.
- failure: Both reviewed composer modules violate the canonical Schema namespace binding.
- fix: Rename those namespace imports to `S` and update their qualified references.

### sol-1-10

- file: scratchpad/effected/yaml/internal/composer/comments.ts:53
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; AGENTS.md’s schema-first domain-model rule.   evidence: `CommentFields` and `EscapedComment` at `comments.ts:277`, `NodeMeta` at `state.ts:114`, and `PendingFlowComment` at `flow.ts:546` are handwritten interfaces describing concrete data carried through composition. They have no runtime schemas. They are distinct from the callable `FlowComposers` service contract and function overload surfaces, which fall within the documented interface exceptions.
- failure: These named data models remain type-only, so their shapes cannot supply schema-derived guards or annotations and are maintained independently of the existing node-field schemas.
- fix: Define annotated structural schemas and derive their types. Reuse existing node-field schemas for comment and metadata fields, preserving optionality and writable keys where the composer mutates them.

### sol-1-11

- file: scratchpad/effected/yaml/internal/rules/colon-spacing.ts:23
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”: a non-class schema must export its runtime type from the same identifier.   evidence: `colonSpacingOptions`, `commentsSpacingOptions`, `documentStartOptions`, and `documentEndOptions` export `S.Struct` values without corresponding same-name type exports.
- failure: Consumers cannot use these exported schema names directly as their decoded option types; the prescribed schema-owned value/type API is incomplete.
- fix: Add `export type <name> = typeof <name>.Type` for each of the four option schemas.

### sol-1-12

- file: scratchpad/effected/yaml/internal/composer/comments.ts:64
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements” and “Kind-split Example law”; S2 is deferred by the reviewer brief.   evidence: Exported values throughout the reviewed composer and rule files have absent or prose-only documentation without the required titled Example, canonical `@category`, and `@since 0.0.0`. Examples include `hasBlankLineBetween`, `withCommentFields`, the document composition entry points, and the four rule option schemas. `scratchpad/docgen.effected.template.json` includes `**/*.ts`, does not exclude internals, and enables description, example, and version enforcement.
- failure: These exports do not satisfy the specified documentation contract and remain unfinished work for the deferred S2 pass.
- fix: During S2, preserve the existing prose and add meaningful compilable titled Examples and required metadata to value exports; add required prose and metadata to type exports.

REQUIRED: 11
BACKLOG: 1
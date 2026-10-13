I'll review the yaml port files against the pinned upstream oracle and the round-1 inventory, and report only new findings.Round 1 already recorded a large inventory. I'll check what changed at this commit and read the binding decisions before looking for new defects.Round-1 fixes are already in the ledger. I'll scan the nine files for defects the gates miss and that the inventory did not already close.The review is still open on the nine YAML files. I will confirm the commit, then check the remaining line-break and regional-edit hypotheses against the oracle before writing findings.The checkout is `2f515ae`. Next I will scan the nine files for law misses the gates do not catch, and read the line-break and regional-edit paths against the oracle.Other seats already named three public-behavior splits. I am checking those against the lexer, the line index, and the upstream comment scanner before I keep any of them.The three candidate bugs need a fresh read of the cited lines before I file them. I will check the ledger and the remaining leads the same way.### grok-2-1
- file: scratchpad/effected/yaml/YamlLint.ts:216
- class: bug   severity: required
- standard: D9; D11. The recorded lone-CR deviation covers scanner and public token positions only (README Port notes, `token-cr-positions`).
- evidence: `YamlToken.promoteAll` (`YamlToken.ts:105-108`) treats a lone CR and a CRLF as one line break. `buildLines` (`YamlLint.ts:216-217`) splits only on `\n` and strips a CR only when it sits immediately before that `\n`. `document-start` and `document-end` then read `ctx.lines[token.line]` (`internal/rules/document-start.ts:117`, `internal/rules/document-end.ts:128`). For `"\r---\n"` with `present: false`, the document-start token is at offset 1. `promoteAll` assigns it line 1. `buildLines` keeps one line, `"\r---"`. The lookup is `""`, `trim() === "---"` fails, and the removal fix is omitted. Upstream `promoteAll` splits only on `\n`, so the marker stays on line 0, `"\r---".trim() === "---"`, and the fix is offered. `"\r...\n"` with document-end `present: false` drops the same way. CRLF already agrees on both sides.
- failure: After the admitted CR token fix, `token.line` no longer indexes `ctx.lines`. A marker alone on a lone-CR line loses the autofix upstream emits.
- fix: Split `buildLines` with the same lone-CR and CRLF convention as `promoteAll`, and keep the trailing-break rule that a final empty segment is not a line. Leave U+2028 and U+2029 as non-breaks. `eof-newline` still keys off `endsWith("\n")`; only its reported line and character move when a file contains a lone CR.

### grok-2-2
- file: scratchpad/effected/yaml/Yaml.ts:1051
- class: bug   severity: required
- standard: D9; D11. Upstream `Yaml.allFromString` decodes through `Yaml.parseAll` (oracle `packages/yaml/src/Yaml.ts:802-803`). No ledger or Port-notes entry covers an empty-string branch.
- evidence: `Yaml.parseAllResult` documents empty input as `[null]` (`Yaml.ts:772-774`), and `scratchpad/test/yaml/Yaml.test.ts:331` locks that result. The codec decodes `input === ""` to `[]` before `parseAll`. Encoding `[]` is still `""`, matching the oracle encode. `scratchpad/test/yaml/Yaml.property.test.ts:20` round-trips `allFromString` only through `S.Array(Value)`, so the property exercises `[]` and never compares the empty decode with `parseAll("")`.
- failure: Decoding `""` through `Yaml.allFromString` yields `[]`. `Yaml.parseAll` / `parseAllResult("")` and the pinned upstream codec yield `[null]`.
- fix: Delete the `input === ""` branch and decode through `Yaml.parseAll`. Stop the lab property from treating `[]` as a YAML stream.

### grok-2-3
- file: scratchpad/effected/yaml/Yaml.ts:882
- class: bug   severity: required
- standard: D9; D11. Distinct from the three recorded comment deviations (block-scalar content hashes, apostrophe comments, CRLF replacement bytes) and from round-1 `yaml-comments`.
- evidence: `stripComments` removes comment tokens, and re-lexes a header only when the token kind is `scalar` and the source starts with `|` or `>` (`Yaml.ts:882-890`). For `"> hello # comment\n"`, `scanBlockScalar` (`internal/lexer.ts:737-749`) takes the invalid-header branch and returns one `error` token covering the whole line, including the whitespace-preceded `# comment`. The scalar re-lex does not run, so the source is unchanged. Upstream's character scanner (oracle `packages/yaml/src/Yaml.ts:701-708`) is outside quotes, sees a `#` preceded by a space, and returns `"> hello \n"`. A `#` without preceding whitespace, and a `#` inside another error token such as an unterminated quote, stays on both sides.
- failure: A real comment on an invalid block-scalar header survives `Yaml.stripComments`. Upstream removes it.
- fix: In the invalid-header branch, end the error token at a whitespace-preceded `#` and emit `scanComment` for the rest. The existing comment walk then strips it. Leave `#` inside block-scalar bodies and inside other error tokens in place.

### grok-2-4
- file: scratchpad/effected/yaml/YamlFormat.ts:1159
- class: bug   severity: required
- standard: D9; D11; section 14 `upstream-bug`. `YamlFormat.modify` fails in `YamlModificationError`. `jsValueToNode` already reports `NestingDepthExceeded` for a replacement deeper than 256 (`YamlFormat.ts:458-463`).
- evidence: `lowerValue` starts `jsValueToNode` at depth 0 and throws only when `depth > 256`, so a replacement whose innermost scalar is visited at depth 256 is accepted. `stringifyDocument` starts the root at depth 0 (`internal/stringifier.ts:2162`) and `stringifyNodeLines` throws `StringifyDepthExceeded` when `depth > 256` (`internal/stringifier.ts:1208`). A path `[0]` grafts that replacement under the root sequence, so the leaf is stringified at depth 257. The `stringifyDocument` call sits outside the `Effect.try` that converts `ModifyFailure` (`YamlFormat.ts:1142-1156`). The header at `YamlFormat.ts:9-16` says the lowering guard makes this throw unreachable. Oracle `YamlFormat.ts:1003` is the same unguarded call, and oracle `stringifier.ts:1961` also starts at 0. A composer-bounded tree alone stays within the stringifier: `enterNesting` stops at `depth >= 256` before incrementing (`internal/composer/state.ts:456`).
- failure: `YamlFormat.modify` defects with `StringifyDepthExceeded` when a document and a replacement are each within the limit and their combined depth is not. Callers that catch `YamlModificationError` miss it.
- fix: Catch `StringifyDepthExceeded` from that `stringifyDocument` call and fail with `YamlModificationError` carrying a `NestingDepthExceeded` diagnostic. Correct the header comment. Record the upstream-bug deviation. Leave `format` on the composer-bounded path.

### grok-2-5
- file: scratchpad/effected/yaml/YamlLint.ts:692
- class: bug   severity: required
- standard: D9; D11; section 14 `upstream-bug`. Absent config entries skip a rule (`YamlLint.ts:692-693`). `effect/Record.get` and `effect/Record.has` use `Object.hasOwn` (`Record.ts:444`, `Record.ts:471`). `Record.fromEntries` is `Object.fromEntries` (`Record.ts:343`), which stores `"__proto__"` as an own data property.
- evidence: `runRules` reads `config.rules[rule.id]` (`YamlLint.ts:692`). A custom rule id `"toString"` with `rules: {}` reads `Function.prototype.toString`. That value is neither `undefined` nor `"off"`, so the rule runs. `overlayConfig` copies with `{ ...base.rules }`, then assigns `rules[ruleId] = merged` and `merged[dimension] = value` (`YamlLint.ts:582-589`). A rule id or dimension of `"__proto__"` sets `[[Prototype]]` and drops the own key. Oracle `YamlLint.ts:403-409` and `YamlLint.ts:508` use the same bracket access. Rule ids and dimensions are `S.String` (`YamlLintRule.ts:256`, `YamlLintRule.ts:178`).
- failure: A custom rule whose id is an inherited property name runs when the config has no own entry. An inferred rule id or dimension of `"__proto__"` is stored as a prototype change and disappears as config.
- fix: Read rule entries with `R.get`. Build the overlaid map with `R.fromEntries` and `R.assignProperty` so every rule id and dimension is an own key. Record the upstream-bug correction.

### grok-2-6
- file: scratchpad/effected/yaml/YamlLint.ts:396
- class: bug   severity: required
- standard: D9; D11; section 14 `upstream-bug`. `StyleEvidence.combine` must keep one tally per `(rule, dimension, value)` and one floor per `(rule, dimension)` (`YamlLint.ts:377-379`).
- evidence: Vote keys are `` `${tally.rule}\0${tally.dimension}\0${valueKey(tally.value)}` `` (`YamlLint.ts:396`). Floor keys are `` `${floor.rule}\0${floor.dimension}` `` (`YamlLint.ts:402`). `rule` and `dimension` are `S.String`. The pair `(rule: "a\0b", dimension: "c")` and the pair `(rule: "a", dimension: "b\0c")` produce one key, so counts add and the first-seen position wins. `groupVotes` then sees one group. Oracle `YamlLint.ts:277` and `YamlLint.ts:283` use the same templates.
- failure: Two distinct spellings collapse into one tally when a rule id, dimension, or value contains NUL. Strict resolve misses the conflict.
- fix: Key the histogram with nested `MutableHashMap`s (rule, then dimension, then `valueKey`). Preserve sort order and the left operand's first-seen position. Record the upstream-bug correction.

### grok-2-7
- file: scratchpad/effected/yaml/YamlLint.ts:440
- class: perf   severity: required
- standard: D11 algorithmic-class win. `fromObservations` documents a monoid homomorphism (`YamlLint.ts:414-416`).
- evidence: Each observation calls `StyleEvidence.combine` (`YamlLint.ts:440`). `combine` copies every accumulated tally and sorts the whole map (`YamlLint.ts:395-408`). For N distinct votes that is Θ(N² log N) comparisons. One histogram, then one materialize-and-sort, is Θ(N log N) and yields the same counts, first positions, max floors, and order. Oracle `YamlLint.ts:307` folds the same way. `observeContext` (`YamlLint.ts:599`) pays it once per rule.
- failure: Config inference and `StyleEvidence.fromObservations` scale quadratically with the number of distinct observations.
- fix: Accumulate counts, first positions, and max floors in local maps inside `fromObservations`, then materialize and sort once. Keep `combine` as the public monoid.

### grok-2-8
- file: scratchpad/effected/yaml/YamlNode.ts:1005
- class: law   severity: required
- standard: effect-laws-v1 law 6. `NoNativeRuntime` `OBJECT_METHODS` is `keys`, `values`, `entries`, `fromEntries`, `assign`, `hasOwn`, `freeze`, `seal`, `create` (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:56-66`), so `Object.defineProperty` passes the gate. Round-1 inventory: concrete scanner misses stay required. `Record.assignProperty` creates an own data property when the key is `"__proto__"` (`effect/packages/effect/src/Record.ts:1086-1104`).
- evidence: `setOwnProperty` calls `Object.defineProperty` for the key `"__proto__"` (`YamlNode.ts:1002-1005`). `nodeToValue` uses it for every mapping key (`YamlNode.ts:1166`).
- failure: Domain object construction still calls a native `Object` method. The scratchpad law gate does not see it.
- fix: Replace the body with `R.assignProperty(obj, key, value)`. Own `"__proto__"`, last-wins, and first-seen key order stay.

### grok-2-9
- file: scratchpad/effected/yaml/YamlEdit.ts:22
- class: schema   severity: required
- standard: effect-first-development EF-12 (`standards/effect-first-development.md:260-263`). Docgen covers exported symbols, so this private schema is outside the green gate.
- evidence: `YamlEditFailure` is `S.TaggedError` with `{ message: S.String }` and no `$I.annote` or `message.annotateKey` (`YamlEdit.ts:22-24`). `YamlEdit` and `YamlRange` in the same file carry both.
- failure: The overlap defect schema has no identity annotation and no field description.
- fix: Add `$I.annote("YamlEditFailure", { description })` and `message.annotateKey({ description })`. Keep the tag, the message text, and the throw sites.

### grok-2-10
- file: scratchpad/effected/yaml/YamlFormat.ts:57
- class: schema   severity: required
- standard: effect-first-development EF-12. `ModifyFailure` and `YamlModificationError` in the same file are annotated (`YamlFormat.ts:188-229`). Docgen does not see this private class.
- evidence: `YamlFormatInvariantFailure` is `S.TaggedError` with `{ message: S.String }` and no `$I.annote` or `message.annotateKey` (`YamlFormat.ts:57-59`).
- failure: The format invariant schema has no identity annotation and no field description.
- fix: Add `$I.annote("YamlFormatInvariantFailure", { description })` and `message.annotateKey({ description })`. Keep the tag, the message text, and the throw at `YamlFormat.ts:611`.

### grok-2-11
- file: scratchpad/effected/yaml/YamlLintRule.ts:101
- class: schema   severity: required
- standard: schema-first-development-prompt "Schema owns pure data" (`standards/schema-first-development-prompt.md:183-191`). `YamlRule` stays an interface: it is the callable rule port. The schema-first lint scans `packages/**`, so this scratchpad model is outside the green gate.
- evidence: `LintLine` is a public `@category models` interface of `text`, `offset`, and `number` (`YamlLintRule.ts:101-105`). `buildLines` constructs it as a plain object (`YamlLint.ts:220`).
- failure: The line model is a TypeScript interface with no schema, guard, or annotation.
- fix: Replace it with an `S.Class` (`text: S.String`, `offset: S.Finite`, `number: S.Finite`), `$I.annote`, and `LintLine.make` at the construction site. `LintContext` can keep the interface and hold `ReadonlyArray<LintLine>`.

### grok-2-12
- file: scratchpad/effected/yaml/YamlLint.ts:660
- class: schema   severity: required
- standard: schema-first-development-prompt "Schema owns pure data". Both constituent types already have schemas (`YamlLintConfig`, `YamlLintDiagnostic`). The schema-first lint does not scan scratchpad.
- evidence: `YamlLintInference` is a public interface `{ config, residual }` (`YamlLint.ts:660-663`), returned as a plain object (`YamlLint.ts:992`).
- failure: The inference result is a TypeScript interface with no schema, guard, or annotation.
- fix: Replace it with an `S.Class` of those two fields, `$I.annote`, and `YamlLintInference.make` at the return site.

REQUIRED: 12
BACKLOG: 0

### sol-2-1
- file: scratchpad/effected/yaml/internal/composer/document.ts:818
- class: bug   severity: required
- standard: D9 behaviour preservation; D11; section 14.   evidence: A read-only `bun -e` probe of `Yaml.parseResult("%TAG !e! tag:example.com,2026:foo#\n---\n!e!bar x\n")` succeeds with `"x"` in the pinned oracle but fails in the port with `InvalidDirective`, `"Comment in directive requires preceding whitespace"`, at offset 0. The independent `yaml` parser reports no errors and resolves the node tag to `tag:example.com,2026:foo#bar`. Upstream applied this comment check only to `%YAML`; extending it to `%TAG` introduced the regression.
- failure: A hash inside a valid tag-prefix URI is mistaken for a comment indicator, so valid documents accepted upstream are rejected. The recorded TAG-arity correction does not justify rejecting these valid parameters.
- fix: For `%TAG`, recognize a comment only at a whitespace-separated `#`; retain embedded hashes in the URI parameter. Preserve the `%YAML` malformed-comment check and TAG-arity validation. Add the reproduced URI-fragment regression.

### sol-2-2
- file: scratchpad/effected/yaml/internal/rules/document-start.ts:132
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; the rule’s documented requirement to preserve multi-document structure.   evidence: With only `document-start` enabled and `{ present: false }`, `YamlLint.fix("---\n---\na: 1\n", …)` returns `"---\na: 1\n"` in both the port and pinned oracle. Read-only probes show `Yaml.parseAllResult` changes from `[null, { a: 1 }]` to `[{ a: 1 }]`; independent `yaml.parseAllDocuments` confirms the same loss.
- failure: Removing the stream’s first marker deletes an empty first document. A marker being alone on its line is insufficient to establish that its removal preserves the document sequence.
- fix: Withhold the removal fix when the first marker establishes an empty document that would disappear after removal. Keep the diagnostic. Add a regression asserting preservation of document count and values for consecutive start markers, including a preceding header comment, and record the upstream-bug correction under section 14.

### sol-2-3
- file: scratchpad/effected/yaml/internal/rules/document-start.ts:109
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; lint-fix semantic fidelity.   evidence: For `"\uFEFFa: 1\n"`, enabling `document-start` produces `"---\n\uFEFFa: 1\n"` in both the port and pinned oracle. An independent `yaml.parseDocument` probe returns `{ a: 1 }` before the fix and `{ "\uFEFFa": 1 }` afterward, with no parse errors. The port’s own parser ignores the relocated BOM, masking the change.
- failure: Inserting the marker before the stream-leading BOM moves that character into document content and changes the mapping key for another YAML parser.
- fix: Insert the missing marker immediately after an initial BOM, using offset 1 when `ctx.text` begins with `\uFEFF`, otherwise offset 0. Add an independent-parser value-fidelity regression and record the upstream-bug correction under section 14.

### sol-2-4
- file: scratchpad/effected/yaml/internal/composer/scalars.ts:93
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; the existing precision-preserving integer resolver.   evidence: Read-only probes against both the port and pinned oracle show `Yaml.parseResult("n: 9007199254740993\n")` returns `{ n: 9007199254740993n }`, while adding the explicit integer tag—`"n: !!int 9007199254740993\n"`—returns `{ n: 9007199254740992 }`. `"n: !!int 0x20000000000001\n"` also rounds to `9007199254740992`. The independent `yaml` parser with `{ intAsBigInt: true }` preserves `9007199254740993n` for both tagged spellings.
- failure: Explicitly declaring an integer changes its mathematical value. The tagged resolver bypasses `safeParseInt`, although the implicit resolver already preserves these integers exactly. The earlier bigint-stringification finding concerns a different execution site and does not cover this parsing loss.
- fix: Use the existing `safeParseInt` for valid decimal, hexadecimal, and octal spellings in the explicit integer branch, preserving the existing fallback behavior for other inputs. Add tagged-versus-implicit integer fidelity regressions above the safe-number boundary and record the upstream-bug correction under section 14.

### sol-2-5
- file: scratchpad/effected/yaml/internal/composer/state.ts:53
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; consistency with the lexer’s supported CR/LF/CRLF line breaks.   evidence: `lineCol("a: 1\rb: 2\r", 5)` returns `{ line: 0, column: 5 }` instead of the second line’s column zero. A read-only line-ending-equivalence probe shows both the port and pinned oracle reject `"a:\n  first\nbare\n"` but accept its CR-only equivalent, `"a:\r  first\rbare\r"`, as `{ a: "first bare" }`. The scalar continuation collector uses `lineCol` to enforce its indentation floor.
- failure: The LF-only line index gives dedented CR-only continuation text an artificially large column, allowing malformed input to be absorbed into the preceding scalar. This is composer acceptance behavior beyond the closed lexer/token-position correction.
- fix: Index lone CR as a line break and CRLF as one line break. Align the state helpers that determine physical line boundaries with that convention. Add the reproduced CR-versus-LF acceptance regression and record the upstream-bug correction under section 14.

### sol-2-6
- file: scratchpad/effected/yaml/internal/composer/flow.ts:112
- class: perf   severity: required
- standard: D11 algorithmic-class and measured-regression criteria.   evidence: For `"{k: " + "x [b] ".repeat(n) + "}"`, each plain `x` makes `validateFlowSeparators` scan to the same closing brace and copy the remaining entry with `children.slice(i, end)`. The scalar collector stops at the following nested sequence, so this repeats for every `x`: total scanning and copying are Θ(n²), whereas the pinned oracle’s separator validation is linear. Read-only `composeFirstDocument(source, { uniqueKeys: false })` probes measured oracle/port times of 62.7/112.6 ms at n=1,000, 131.5/230.6 ms at n=4,000, and 274.1/1,675.3 ms at n=16,000. Both versions produced the same diagnostic counts at each size.
- failure: The new separator validation adds quadratic work and allocation on malformed comma-free flow collections, substantially increasing the cost of error recovery. The earlier continuation correction did not assess this newly introduced complexity.
- fix: Determine each comma-delimited segment boundary once and reuse a bounded segment with a cursor when calling the scalar collectors. Avoid rescanning and copying the remaining segment for every plain scalar. Retain the existing diagnostics and add a scaling regression or benchmark for the reproduced input.

REQUIRED: 6
BACKLOG: 0
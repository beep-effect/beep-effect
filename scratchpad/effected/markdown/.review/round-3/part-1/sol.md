### sol-3-1
- file: scratchpad/effected/markdown/MarkdownFormat.ts:1061
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and `MarkdownFormat.modify`’s node-replacement contract.   evidence: Read-only `bun -e` probes against the reviewed source and pinned oracle parsed `"# title\nbody\n"` and replaced the heading with `"new"`. Both returned `"new\nbody\n"` successfully. Reparsing produced one paragraph with text `"new\nbody"`, absorbing the original following paragraph. The current contextual check compares only block type and start offset, so this enlarged paragraph passes. This is new following-boundary evidence; round-2 req-10 and its regressions cover absorption by preceding blocks.
- failure: Replacing one flow node can silently absorb an untouched following sibling. The added context validator accepts the result because the replacement still begins at the expected offset and retains its standalone category.
- fix: Extend the contextual check to verify replacement block end offsets and preservation of the following sibling boundary. Return typed `UnsupportedTarget` when the replacement absorbs following content. Add the heading-followed-immediately-by-paragraph regression and record the verified upstream bug under section 14.

### sol-3-2
- file: scratchpad/effected/markdown/MarkdownFormat.ts:1023
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and the modifier’s promise to splice literal text into the target’s existing content slot.   evidence: Read-only `bun -e` probes against both implementations parsed `"*old*\n"` and replaced its text child with `"new "`. Both succeeded with `"*new *\n"`. Reparsing yielded a plain text node containing `"*new *"`; the enclosing emphasis disappeared. The same failure occurs with strong emphasis and strikethrough. A separate probe confirmed that `"*new&#32;*\n"` preserves an emphasis node whose text is `"new "`.
- failure: Rendering replacement text as an isolated paragraph leaves trailing whitespace active beside the surrounding closing delimiter. Splicing that result into an emphasis, strong, or delete node invalidates the ancestor’s delimiter flanking and changes markup outside the target.
- fix: When the replacement reaches a delimiter-bearing ancestor’s closing boundary, encode its terminal whitespace as character references so the closing delimiter remains valid, or return typed `UnsupportedTarget` for that unsafe splice. Add regressions for emphasis, strong, and delete text children and record the upstream bug.

### sol-3-3
- file: scratchpad/effected/markdown/MarkdownFormat.ts:498
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and the formatter’s documented conservative semantic-preservation policy.   evidence: Read-only `bun -e` probes against both implementations formatted `"\u0301*hi*\u0301\n"` with `{ emphasisChar: "_" }` into `"\u0301_hi_\u0301\n"`. Before formatting, the paragraph contained text, an emphasis node around `"hi"`, and text. After formatting, it contained only literal text. U+200C neighbors reproduce the same failure. The current guard recognizes only Unicode letters and numbers; combining marks and format characters also create unsafe underscore boundaries. This is distinct from round-2 req-4’s repaired surrogate-half classification.
- failure: Underscore normalization removes valid emphasis beside non-whitespace, non-punctuation characters outside `\p{L}` and `\p{N}`. Reading complete code points does not make the alphanumeric test equivalent to underscore delimiter-flanking rules.
- fix: Evaluate the proposed underscore delimiters using the parser’s actual whitespace, punctuation, and flanking rules, and skip unsafe rewrites. Add U+0301 and U+200C regressions, including one-sided and two-sided neighbors, and record the upstream bug.

### sol-3-4
- file: scratchpad/effected/markdown/MarkdownFormat.ts:987
- class: bug   severity: required
- standard: D9, D11, the existing nesting-depth hardening contract, and `MarkdownModificationErrorCode.FragmentUnrenderable`.   evidence: A read-only `bun -e` probe built a fragment through schema constructors: start with `Text.make({ value: "new" })`, then wrap it in 30,000 `Emphasis.make({ children: [fragment] })` nodes. Replacing the text inside `"[old](/a)\n"` in the port produced an `Exit` containing `Die(RangeError: Maximum call stack size exceeded)`, with the stack at `MarkdownFormat.ts:280–281`. The same port fragment in an ordinary paragraph returned typed `FragmentUnrenderable` with `NestingDepthExceeded`. The pinned oracle, using its own node constructors, returned that typed failure in both contexts.
- failure: The nested-link safeguard recursively walks the replacement before the guarded stringifier validates its depth. A validly constructed over-deep fragment therefore escapes the typed failure channel specifically when the target has a link ancestor. The recorded nested-link deviation does not authorize this hardening regression.
- fix: Run the descendant-link check after `Markdown.stringifyResult` has successfully validated the fragment’s depth, or make that check iterative and depth bounded with a typed `FragmentUnrenderable` result. Add a regression proving that an over-deep fragment inside a link fails through the typed channel.

### sol-3-5
- file: scratchpad/effected/markdown/MarkdownFormat.ts:354
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-33; D5 and D11.   evidence: The reviewed, gate-green source still defines `TaggedEdit` as a six-field interface. `FormatEmitter` constructs and accumulates these records, and the formatter repeatedly consumes their owner spans and bullet classification during range filtering and hazard suppression. No schema owns this named intermediate formatting model. This surviving interface demonstrates a schema-ownership gap beyond the green compiler and law gates.
- failure: The named, reused formatting payload has only a compile-time shape. Its edit fields, owning-node span, and bullet classification have no executable schema from which its type, validation, or property generators can derive.
- fix: Define a module-local annotated `TaggedEdit` schema and derive its type from that schema, reusing the existing edit field schemas where practical. Keep emitted records as plain objects to preserve behavior, and extend the existing schema-first deviation record to include this model.

REQUIRED: 5
BACKLOG: 0